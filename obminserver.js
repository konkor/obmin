#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
//const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const System = imports.system;

imports.searchPath.unshift(getCurrentFile ()[1]);
const Convenience = imports.convenience;
const APPDIR = getCurrentFile ()[1];

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

const html_head = "<head><meta charset=\"utf-8\"><title>Obmin - Gnome File Sharing</title><link href=\"style.css\" rel=\"stylesheet\" type=\"text/css\"></head>";

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
        this.add_handler (null, Lang.bind (this, this._default_handler));
    },

    _default_handler: function (server, msg, path, query, client) {
        let self = server, drop = false;
        debug ("\n" + msg.method + " " + path + " HTTP/1." + msg.get_http_version ());
        msg.request_headers.foreach ( (n, v) => {
            debug (n + ": " + v);
        });
        if (msg.method == "POST") return;
        if (msg.request_body.length > 0) debug (msg.request_body);
        this.access_counter++;
        debug ("Default handler start (" + this.access_counter + ")\n");
        GLib.timeout_add_seconds (0, 0, Lang.bind (this, function () {
            if (path == '/') this._root_handler (server, msg);
            else this._send_content (self, msg, path);
            debug ("Default handler end " + this.access_counter);
            return false;
        }));
        self.pause_message (msg);
    },

    _send_content: function (server, msg, path) {
        let self = server;
        let file, r, info;
        [file, r] = this.get_file (path);
        if (file) {
            info = file.query_info ("*", 0, null);
            if (info.get_file_type () == 2) {
                this.get_dir (self, msg, file, r, path);
            } else {
                if (info.get_size () < 10*1048576) {
                    msg.set_status (200);
                    msg.response_headers.set_content_length (info.get_size ());
                    msg.set_response (info.get_content_type (), Soup.MemoryUse.COPY, file.load_contents (null)[1]);
                } else {
                    debug ("start chunking");
                    let st = new ContentStream (self, msg, file, info, this.access_counter);
                    msg.connect ("finished", (o)=>{
                        debug ("st finished" + st);
                        //o.destroy ();
                        delete st;
                        delete o;
                        st = null;
                        o = null;
                        System.gc();
                        //this.dispose ();
                    });
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
        } else if (path == '/favicon.ico') {
            msg.set_status (200);
            msg.set_response ("image/vnd.microsoft.icon", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/favicon.ico")[1]);
            self.unpause_message (msg);
            return;
        } else if (path.endsWith ('style.css')) {
            msg.set_status (200);
            msg.set_response ("text/css", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/style.css")[1]);
            self.unpause_message (msg);
            return;
        } else if (path.endsWith ('obmin.png')) {
            msg.set_status (200);
            msg.set_response ("image/png", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/obmin.png")[1]);
            self.unpause_message (msg);
            return;
        } else {
            msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html><head><title>404</title></head><body><h1>404</h1></body></html>");
            msg.set_status (404);
            self.unpause_message (msg);
        }
        return;
    },

    get_file: function (path) {
        let s = path, file, id, src, i, res = [null, null];
        if (s.length == 0) return res;
        if (s[0] != '/') return res;
        s = s.slice (1);
        i = s.indexOf ('/');
        if (i == -1) {
            if (!this.is_int (s)) return res;
            id = parseInt (s);
            if (id >= sources.length) return res;
            file = Gio.File.new_for_path (sources[id].path);
            if (file.query_exists (null)) return [file, false];
        } else {
            src = s.substring (0, i);
            s = s.slice (i + 1);
            if (!this.is_int (src)) return res;
            id = parseInt (src);
            if (id >= sources.length) return res;
            if (s.indexOf ('/') > -1 && !sources[id].recursive) return res;
            if (s.length == 0) src = sources[id].path;
            else src = sources[id].path + '/' + s;
            file = Gio.File.new_for_path (src);
            if (file.query_exists (null)) return [file, sources[id].recursive];
        }
        return res;
    },

    is_int: function (str) {
        for (let i = 0; i < str.length; i++) {
            if (str[i] < '0' || str[i] > '9') return false;
        };
        return true;
    },

    get_dir: function (server, msg, dir, r, path) {
        let self = server, slash, size, d = new Date(0),ds;
        debug ("LOCAL PATH:"+dir.get_path ());
        this.list_dir ({path: dir.get_path (), recursive: r});
        let html_body = "<body><div class=\"path\"><img src=\"obmin.png\">" + path.replace (/\u002f/g,"> ") + "</div><div class=\"contents\">";
        files.forEach (f => {
            if (f.type == 2) { slash = "/"; size = "Folder";}
            else {slash = ""; size = " " + GLib.format_size (f.size);}
            d.setTime (f.date*1000);
            ds = d.toString();
            if (ds.indexOf(" GMT")) ds = ds.substring(0,ds.indexOf(" GMT"));
            //html_body += "<li><a href=\"" + f.name + slash + "\">" + f.name + slash + "</a>" + size;
            /*html_body += "<div class=\"content\" onclick=\"location.href=\'" + f.name + slash + "\';\">";
            html_body += "<div class=\"file\">" + f.name + slash + "</div>";
            html_body += "<section class=\"fileinfo\"><div class=\"date\">" + f.date + "</div>";
            html_body += "<div class=\"size\">" + size + "</div></section></div>";*/
            html_body += "<a href=\"" + f.name + slash + "\"><div class=\"content\">";
            html_body += "<div class=\"file\">" + f.name + slash + "</div>";
            html_body += "<section class=\"fileinfo\"><div class=\"date\">" + ds + "</div>";
            html_body += "<div class=\"size\">" + size + "</div></section></div></a>";
        });
        html_body += "</div></body>";
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
            size: info.get_size (),
            date: info.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED)});
    }
});

const ContentStream = new Lang.Class({
    Name: 'ContentStream',
    /*Extends: GObject.Object,
    Signals: {
        'finised': {},
    },*/
    _init: function (server, message, file, info, count) {
        this.server = server;
        this.msg = message;
        this.msg.connect ("wrote-chunk", Lang.bind (this, this.wrote_chunk));
        this.msg.connect ("got-headers", ()=>{debug ("got-headers");});
        this.msg.connect ("got-chunk", ()=>{debug ("got-chunk");});
        this.msg.connect ("finished", ()=>{
            debug ("finished ContentStream");
            this.done = true;
            if (this.read_event != 0) {
            Mainloop.source_remove (this.read_event);
            this.read_event = 0;
        }
        });
        this.file = file;
        this.mime = info.get_content_type ();
        this.size = info.get_size ();
        this.num = count.toString();
        this.stream = null;
        this.offset = 0;
        this.wrotes = 0;
        this.reads = 0;
        this.read_event = 0;
        this.done = false;
        debug ("Start steamimg");
        this.file.read_async (GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.opened));
    },

    wrote_chunk: function (sender, msg) {
        //if (!this.done) this.server.pause_message (this.msg);
        this.wrotes++;
        debug ("Request(" + this.num + ") wrote_chunk: " + this.wrotes);
    },

    opened: function (sender, result) {
        try {
            debug ("file opened");
            //this.seek_request = this.msg.request_headers.get_content_range (this.seek_start, this.seek_end, this.seek_total);
            //debug ("seek " + this.msg.request_headers.get_content_range ());
            this.msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
            this.msg.response_headers.set_content_type (this.mime, null);
            this.msg.response_headers.set_content_length (this.size);
            //this.msg.response_headers.set_content_type ('application/octet-stream', null);
            this.msg.response_body.set_accumulate (false);
            this.stream = this.file.read_finish (result);
            debug ("typeof stream " + (typeof this.stream));
            this.msg.set_status (200);
            this.msg.request_headers.foreach ( (n, v) => {
                if (n.indexOf ("Range") > -1)
                    if (v.indexOf ("bytes=") > -1) {
                        let s = v.slice (6).split("-");
                        if (s[0]) this.offset = parseInt(s[0]);
                    }
            });
            debug ("Request(" + this.num + ") offset " + this.offset);
            this.read_more (this.offset>0);
        } catch (err) {
            error (err);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    read_more: function (seek) {
        //debug ("file read next chunk");
        if (this.read_event != 0) {
            Mainloop.source_remove (this.read_event);
            this.read_event = 0;
        }
        this.b = [];
        if (seek) this.stream.seek (this.offset, GLib.SeekType.SET, null);
        //if ((this.reads - this.wrotes) > 12) this.read_event = Mainloop.timeout_add (50, Lang.bind (this, this.read_more));
        this.stream.read_bytes_async (1*1048576, GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.read_done));
        this.reads++;
    },

    read_done: function (sender, result) {
        try {
            //debug ("file read chunk done");
            this.b = this.stream.read_bytes_finish (result);
            if (this.done) {
                debug ("this.msg.response_body.complete ();");
                this.b = [];
                this.msg.response_body.complete ();
                this.stream.close (null);
                return;
            }
            if (this.b.get_size() == 0) {
                debug (this.b + " " + this.b.get_size());
                this.done = true;
                this.msg.response_body.complete ();
                this.server.unpause_message (this.msg);
                this.stream.close (null);
            } else {
                this.offset += this.b.get_size();
                this.msg.response_headers.set_content_range (this.offset - this.b.get_size(),
                                                        this.offset,
                                                        this.size);
                this.msg.response_headers.append ("Accept-Ranges", "bytes");
                this.msg.response_headers.set_content_length (this.size);
                //this.msg.response_body.append (this.b.get_data());
                this.msg.response_body.append_buffer (new Soup.Buffer (this.b.get_data()));
                /*debug ("Request(" + this.num + ") on read done\n" + this.msg.method + " HTTP/1." + this.msg.get_http_version ());
                this.msg.request_headers.foreach ( (n, v) => {
                    debug (n + ": " + v);
                });*/
                if (this.msg.request_body.length > 0) debug (this.msg.request_body);
                /*this.msg.response_headers.foreach ( (n, v) => {
                    debug (n + ": " + v);
                });*/
                debug ("Stream " + this.num + " " + this.offset + ":" + this.seek_start);
                this.server.unpause_message (this.msg);
                this.read_event = Mainloop.timeout_add (10, Lang.bind (this, this.read_more));//this.read_more ();
                }
            
        } catch (err) {
            error ("read_done" + err);
            if (this.offset == 0) this.msg.set_status (500);
            else this.msg.response_body.complete ();
            this.server.unpause_message (this.msg);
            this.done = true;
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

