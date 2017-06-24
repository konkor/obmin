#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

imports.searchPath.unshift(getCurrentFile ()[1]);
const Convenience = imports.convenience;

const DEBUG = true;
const ATTRIBUTES = "standard," +
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED + "," +
	Gio.FILE_ATTRIBUTE_UNIX_NLINK + "," +
	Gio.FILE_ATTRIBUTE_UNIX_MODE + "," +
	Gio.FILE_ATTRIBUTE_UNIX_INODE + "," +
	Gio.FILE_ATTRIBUTE_UNIX_DEVICE + "," +
	Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ;
const SAVE_SETTINGS_KEY = 'save-settings';
const ENABLED_KEY = 'enabled';
const LINKS_KEY = 'links-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';


let save = false;
let follow_links = true;
let check_hidden = false;
let check_backup = false;

let server = null;
let files = [];
let sources = [];

const ObminServer = new Lang.Class({
    Name: 'ObminServer',
    Extends: Soup.Server,

    _init: function () {
        this.parent ();
        this.access_counter = 0;
        //this.add_handler ("/index.html", Lang.bind (this, this._root_handler));
		//this.add_handler ("/", Lang.bind (this, this._root_handler));
        this.add_handler (null, Lang.bind (this, this._default_handler));
    },

    _default_handler: function (server, msg, path, query, client) {
        let self = server;
        debug (msg.method);
        debug (path);
        this.access_counter++;
        debug ("Default handler start (" + this.access_counter + ")\n");
        GLib.timeout_add_seconds (0, 0, Lang.bind (this, function () {
            if (path == '/' || path == '/index.html') this._root_handler (server, msg);
            else this._send_content (self, msg, path);
            debug ("Default handler end", this.access_counter);
            return false;
        }));
        msg.connect ("content-sniffed", ()=>{debug ("content-sniffed");});
        
        msg.connect ("got-body", ()=>{debug ("got-body");});
        
        
        msg.connect ("got-informational", ()=>{debug ("got-informational");});
        msg.connect ("network-event", ()=>{debug ("network-event");});
        msg.connect ("restarted", ()=>{debug ("restarted");});
        msg.connect ("wrote-body", ()=>{debug ("wrote-body");});
        msg.connect ("wrote-body-data", ()=>{debug ("wrote-body-data");});
        msg.connect ("wrote-headers", ()=>{debug ("wrote-headers");});
        msg.connect ("wrote-informational", ()=>{debug ("wrote-informational");});
        self.pause_message (msg);
    },

    _send_content: function (server, msg, path) {
        let self = server;
        if (path == '/favicon.ico') {
            msg.set_status (200);
            msg.set_response ("image/vnd.microsoft.icon", Soup.MemoryUse.COPY, GLib.file_get_contents ("./data/www/favicon.ico")[1]);
            self.unpause_message (msg);
            //debug (EXTENSIONDIR+"/data/www/favicon.ico");
            return;
        }
        let file, r, info;
        [file, r] = this.get_file (path);
        if (file) {
            info = file.query_info ("*", 0, null);
            if (info.get_file_type () == 2) {
                this.get_dir (self, msg, file, r, path);
            } else {
                if (info.get_size () < 10*1048576) {
                    msg.set_status (200);
                    msg.set_response (info.get_content_type (), Soup.MemoryUse.COPY, GLib.file_get_contents (file.get_path())[1]);
                } else {
                    debug ("start chunking");
                    let st = new ContentStream (self, msg, file, info.get_content_type ());
                    return;
                    //msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
                    //msg.response_headers.set_content_type (info.get_content_type ());
                    
                    //msg.connect ("got-headers", ()=>{debug ("got-headers");});
                    //msg.connect ("got-chunk", ()=>{debug ("got-chunk");});
                    //msg.connect ("finished", ()=>{debug ("finished");});
                    /*if (!mapping) {
                        msg.set_status (500);
                        self.unpause_message (msg);
                        return;
                    }*/
                }
            }
            self.unpause_message (msg);
        } else {
            msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html><head><title>404</title></head><body><h1>404</h1></body></html>");
            msg.set_status (404);
            self.unpause_message (msg);
        }
        return;
    },

    get_file: function (path) {
        let s = path, file, id, src, i;
        if (s.length == 0) return null;
        if (s[0] != '/') return null;
        s = s.slice (1);
        i = s.indexOf ('/');
        if (i == -1) {
            if (!this.is_int (s)) return null;
            id = parseInt (s);
            if (id >= sources.length) return null;
            file = Gio.File.new_for_path (sources[id].path);
            if (file.query_exists (null)) return [file, false];
        } else {
            src = s.substring (0, i);
            s = s.slice (i + 1);
            if (!this.is_int (src)) return null;
            id = parseInt (src);
            if (id >= sources.length) return null;
            if (s.indexOf ('/') > -1 && !sources[id].recursive) return null;
            if (s.length == 0) src = sources[id].path;
            else src = sources[id].path + '/' + s;
            file = Gio.File.new_for_path (src);
            if (file.query_exists (null)) return [file, sources[id].recursive];
        }
        return null;
    },

    is_int: function (str) {
        for (let i = 0; i < str.length; i++) {
            if (str[i] < '0' || str[i] > '9') return false;
        };
        return true;
    },

    get_dir: function (server, msg, dir, r, path) {
        let self = server, slash, size;
        debug ("LOCAL PATH:"+dir.get_path ());
        this.list_dir ({path: dir.get_path (), recursive: r});
        let html_head = "<head><meta charset=\"utf-8\"><title>Obmin - Gnome File Sharing</title></head>";
        let html_body = "<body><h1>Directory listing " + path + "</h1><hr><ul>";
        files.forEach (f => {
            if (f.type == 2) { slash = "/"; size = "";}
            else {slash = ""; size = " <i>" + GLib.format_size (f.size) + "</i>";}
            html_body += "<li><a href=\"" + f.name + slash + "\">" + f.name + slash + "</a>" + size;
        });
        html_body += "</ul><hr></body>";
        msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html>" + html_head + html_body + "</html>");
        msg.set_status (200);

    },

    _root_handler: function (server, msg) {
        let self = server, i = 0, slash;
        let html_head = "<head><meta charset=\"utf-8\"><title>Obmin - Gnome File Sharing</title></head>";
        let html_body = "<body><h1>Directory listing /</h1><hr><ul>";
        files = [];
        sources.forEach (s => {
            var fl = Gio.File.new_for_path (s.path);
            if (fl.query_exists (null)) {
                this.add_file (fl.query_info ("*", 0, null), s.path);
            }
        });
        files.forEach (f => {
            if (f.type == 2) slash = "/";
            else slash = "";
            html_body += "<li><a href=\"" + i + slash + "\">" + f.name + slash + "</a>";
            i++;
        });
        html_body += "</ul><hr></body>";
        msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html>" + html_head + html_body + "</html>");
        msg.set_status (200);
        self.unpause_message (msg);
    },

    list_dir: function (loc) {
        var info;
        var dir = Gio.File.new_for_path (loc.path);
        files = [];
        if (!dir.query_exists (null)) return;
        try {
            info = dir.query_info ("*", 0, null);
            if (info.get_is_symlink ()) {
                debug ("Symlink " + loc.folder);
				loc.folder = info.get_symlink_target ();
				debug ("Target " + loc.folder);
				dir = File.new_for_path (loc.folder);
				info = dir.query_info ("*", 0, null);
			}
			if (!info.get_attribute_boolean (Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ)) return;
            if (info.get_file_type () == Gio.FileType.REGULAR) {
				this.add_file (info, loc.path);
                return;
			}
			var e = dir.enumerate_children (ATTRIBUTES, follow_links?Gio.FileQueryInfoFlags.NONE:Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
			while ((info = e.next_file (null)) != null) {
			    if (!check_hidden) {
					if (info.get_name ().startsWith ("."))
						continue;
				}
				if (!check_backup) {
					if (info.get_is_backup ())
						continue;
				}
				/*if (info.has_attribute (Gio.FILE_ATTRIBUTE_UNIX_NLINK)) {
					if (info.get_attribute_uint32 (Gio.FILE_ATTRIBUTE_UNIX_NLINK) > 1) {
						let hl = {inode: info.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_UNIX_INODE),
						          device: info.get_attribute_uint32 (Gio.FILE_ATTRIBUTE_UNIX_DEVICE)};
						print (hl);
						if (hl in hardlinks) {
							continue;
						}
						hardlinks.push (hl);
					}
				}*/
				switch (info.get_file_type ()) {
					case Gio.FileType.DIRECTORY:
						if (loc.recursive) {
							let l = {path: loc.path + "/" + info.get_name (), recursive: true};
							this.add_file (info, loc.path);
						}
						break;
					case Gio.FileType.REGULAR:
						this.add_file (info, loc.path);
						break;
					default:
					    print ("DEFAULT", info.get_name (), info.get_file_type (), Gio.FILE_TYPE_DIRECTORY, Gio.FILE_TYPE_REGULAR);
						break;
				}
			}
        } catch (err) {
            error (err);
        }
        files.sort (sorting);
    },

    add_file: function (info, path) {
        debug ("add_file " + info.get_name ());
        files.push ({path: path,
            name: info.get_name (),
            type: info.get_file_type (),
            mime: info.get_content_type (),
            size: info.get_size ()});
    }
});

const ContentStream = new Lang.Class({
    Name: 'ContentStream',
    _init: function (server, message, file, mime) {
        this.server = server;
        this.msg = message;
        this.msg.connect ("wrote-chunk", Lang.bind (this, this.wrote_chunk));
        this.file = file;
        this.mime = mime;
        this.stream = null;
        this.offset = 0;
        this.done = false;
        debug ("Start steamimg");
        this.file.read_async (GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.opened));
    },

    wrote_chunk: function (sender, msg) {
        //if (!this.done) this.server.pause_message (this.msg);
        debug ("wrote_chunk");
    },

    opened: function (sender, result) {
        try {
            debug ("file opened");
            this.msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
            //this.msg.response_headers.set_content_type (this.mime, null);
            this.msg.response_headers.set_content_type ('application/octet-stream', null);
            this.msg.response_body.set_accumulate (false);
            this.stream = this.file.read_finish (result);
            debug ("typeof stream " + (typeof this.stream));
            this.msg.set_status (200);
            this.read_more ();
        } catch (err) {
            error (err);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    read_more: function () {
        //debug ("file read next chunk");
        this.stream.read_bytes_async (65536, GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.read_done));
    },

    read_done: function (sender, result, d) {
        try {
            //debug ("file read chunk done");
            let b = this.stream.read_bytes_finish (result);
            if (b.get_size() == 0) {
                debug (b + " " + b.get_size());
                this.done = true;
                this.msg.response_body.complete ();
                this.server.unpause_message (this.msg);
            } else {
                this.offset += b.get_size();
                this.msg.response_body.append (b.get_data()); //# uh..
                if (this.msg.is_keepalive()){ 
                    this.server.unpause_message (this.msg);
                    this.read_more ();
                } else {
                    this.done = true;
                    this.destroy();
                }
            }
            
        } catch (err) {
            error ("read_done" + err);
            //if (this.offset == 0) this.msg.set_status (500);
            //else this.msg.response_body.complete ();
            //this.server.unpause_message (this.msg);
            this.destroy();
            //this = null;
        }
    }
});

function getCurrentFile () {
    let stack = (new Error()).stack;

    let stackLine = stack.split('\n')[1];
    if (!stackLine)
        throw new Error ('Could not find current file');

    let match = new RegExp ('@(.+):\\d+').exec(stackLine);
    if (!match)
        throw new Error ('Could not find current file');

    let path = match[1];
    let file = Gio.File.new_for_path (path);
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}

function sorting (a, b) {
    if (a.type != b.type) return b.type - a.type;
    if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
}

function debug (msg) {
    if (DEBUG) print ("[obmin] " + msg);
}

function error (msg) {
    print ("[obmin] (EE) " + msg);
}

let settings = Convenience.getSettings();
save = settings.get_boolean (SAVE_SETTINGS_KEY);
follow_links = settings.get_boolean (LINKS_KEY);
check_hidden = settings.get_boolean (HIDDENS_KEY);
check_backup = settings.get_boolean (BACKUPS_KEY);
let srcs =  settings.get_string (SOURCES_KEY);
if (srcs.length > 0) sources = JSON.parse (srcs);
//sources.push ({path: '/home', recursive: true});

let server = new ObminServer ();
server.listen_all (8088, 0);

Mainloop.run('serverMainloop');

