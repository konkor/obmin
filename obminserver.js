#!/usr/bin/gjs
/*
 * Obmin - Simple File Sharing Server For GNOME Desktop
 *
 * Copyright (C) 2017 Kostiantyn Korienkov <kapa76@gmail.com>
 *
 * This file is part of Obmin File Server.
 *
 * Obmin is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Filefinder is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const System = imports.system;

imports.searchPath.unshift(getCurrentFile ()[1]);
const Convenience = imports.convenience;
const APPDIR = getCurrentFile ()[1];

const ATTRIBUTES = "standard," +
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED + "," +
    Gio.FILE_ATTRIBUTE_UNIX_NLINK + "," +
    Gio.FILE_ATTRIBUTE_UNIX_MODE + "," +
    Gio.FILE_ATTRIBUTE_UNIX_INODE + "," +
    Gio.FILE_ATTRIBUTE_UNIX_DEVICE + "," +
    Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ;

const LINKS_KEY = 'links-settings';
const MOUNTS_KEY = 'mounts-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const PORT_KEY = 'port';
const DEBUG_KEY = 'debug';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';

const html_head = "<head><meta charset=\"utf-8\"><title>Obmin - Simple File Sharing</title><meta name=\"viewport\" content=\"width=device-width\"><link href=\"style.css\" rel=\"stylesheet\" type=\"text/css\"></head>";

let mounts = true;
let follow_links = true;
let check_hidden = false;
let check_backup = false;
let port = 8088;
let DEBUG = 1;

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
        try {
            this.listen_all (port, 0);
            info ("Obmin server started at 127.0.0.1:" + port);
        } catch (err) {
            error (err);
        }
    },

    _default_handler: function (server, msg, path, query, client) {
        let self = server, drop = false;
        this.access_counter++;
        info ("Request (" + this.access_counter + ") from " + client.get_host () +
            " " + msg.method + " " + path + " HTTP/1." + msg.get_http_version ());
        msg.request_headers.foreach ( (n, v) => {
            debug (n + ": " + v);
        });
        if (msg.method == "POST") return;
        if (msg.request_body.length > 0) debug (msg.request_body);
        debug ("Default handler start (" + this.access_counter + ")");
        GLib.timeout_add_seconds (0, 0, Lang.bind (this, function () {
            if (path == '/') this._root_handler (server, msg);
            else this._send_content (self, msg, path);
            return false;
        }));
        self.pause_message (msg);
    },

    _send_content: function (server, msg, path) {
        let self = server;
        let file, r, finfo;
        [file, r] = this.get_file (path);
        if (file) {
            finfo = file.query_info ("*", 0, null);
            if (finfo.get_file_type () == 2) {
                this.get_dir (self, msg, file, r, path);
            } else {
                if (finfo.get_size () < 64*1024) {
                    msg.set_status (200);
                    msg.response_headers.append ("Server", "Obmin");
                    msg.response_headers.set_content_length (finfo.get_size ());
                    msg.set_response (finfo.get_content_type (), Soup.MemoryUse.COPY, file.load_contents (null)[1]);
                } else {
                    debug ("start chunking");
                    let st = new ContentStream (self, msg, file, finfo, this.access_counter);
                    msg.connect ("finished", (o)=>{
                        debug ("st finished" + st);
                        st = null;
                        System.gc();
                    });
                    return;
                }
            }
            self.unpause_message (msg);
        } else if (path == '/favicon.ico') {
            msg.set_status (200);
            msg.response_headers.append ("Server", "Obmin");
            msg.set_response ("image/vnd.microsoft.icon", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/favicon.ico")[1]);
            self.unpause_message (msg);
            return;
        } else if (path.endsWith ('style.css')) {
            msg.set_status (200);
            msg.response_headers.append ("Server", "Obmin");
            msg.set_response ("text/css", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/style.css")[1]);
            self.unpause_message (msg);
            return;
        } else if (path.endsWith ('home.png')) {
            msg.set_status (200);
            msg.response_headers.append ("Server", "Obmin");
            msg.set_response ("image/png", Soup.MemoryUse.COPY, GLib.file_get_contents (APPDIR + "/data/www/home.png")[1]);
            self.unpause_message (msg);
            return;
        } else {
            msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html><head><title>404</title></head><body><h1>404</h1></body></html>");
            msg.set_status (404);
            msg.response_headers.append ("Server", "Obmin");
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

    get_path: function (path) {
        let res = "", ref = "/", dirs = path.substring (1, path.length - 1).split ("/");
        debug (dirs);
        for (let i = 0; i < dirs.length; i++) {
            if (i == 0) {
                ref += dirs[i] + "/";
                res += "<a href=\"" + ref + "\">" + Gio.File.new_for_path (sources[parseInt (dirs[i])].path).get_basename () + "> </a>";
            } else {
                ref += dirs[i] + "/";
                res += "<a href=\"" + ref + "\">" + dirs[i].replace (/\u002e/g,".&#8203;") + "> </a>";
            }
        };
        return res;
    },

    get_dir: function (server, msg, dir, r, path) {
        let self = server, slash, size, d = new Date(0), ds;
        debug ("LOCAL PATH:"+dir.get_path ());
        this.list_dir ({path: dir.get_path (), recursive: r});
        let html_body = "<body><div class=\"path\"><a href=\"/\"><img src=\"home.png\" class=\"home\">> </a>" + this.get_path (path) + "</div><div class=\"contents\">";
        files.forEach (f => {
            if (f.type == 2) { slash = "/"; size = "Folder";}
            else {slash = ""; size = " " + GLib.format_size (f.size);}
            d.setTime (f.date*1000);
            ds = d.toString();
            if (ds.indexOf (" GMT")) ds = ds.substring (0, ds.indexOf (" GMT"));
            html_body += "<a href=\"" + f.name + slash + "\"><div class=\"content\">";
            html_body += "<div class=\"file\">" + f.name.replace (/\u002e/g,".&#8203;") + slash + "</div>";
            html_body += "<section class=\"fileinfo\"><div class=\"date\">" + ds + "</div>";
            html_body += "<div class=\"size\">" + size + "</div></section></div></a>";
        });
        html_body += "</div></body>";
        msg.response_headers.append ("Server", "Obmin");
        msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html>" + html_head + html_body + "</html>");
        msg.set_status (200);
    },

    _root_handler: function (server, msg) {
        let self = server, i = 0, slash, size, d = new Date(0), ds;
        let html_body = "<body><div class=\"path\"><a href=\"/\"><img src=\"home.png\" class=\"home\">> </a></div><div class=\"contents\">";
        files = [];
        sources.forEach (s => {
            var fl = Gio.File.new_for_path (s.path);
            if (fl.query_exists (null)) {
                this.add_file (fl.query_info ("*", 0, null), s.path);
            }
        });
        files.forEach (f => {
            if (f.type == 2) { slash = "/"; size = "Folder";}
            else {slash = ""; size = " " + GLib.format_size (f.size);}
            d.setTime (f.date*1000);
            ds = d.toString();
            if (ds.indexOf (" GMT")) ds = ds.substring (0, ds.indexOf (" GMT"));
            html_body += "<a href=\"" + i + slash + "\"><div class=\"content\">";
            html_body += "<div class=\"file\">" + f.name.replace (/\u002e/g,".&#8203;") + slash + "</div>";
            html_body += "<section class=\"fileinfo\"><div class=\"date\">" + ds + "</div>";
            html_body += "<div class=\"size\">" + size + "</div></section></div></a>";
            i++;
        });
        html_body += "</div></body>";
        msg.response_headers.append ("Server", "Obmin");
        msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html>" + html_head + html_body + "</html>");
        msg.set_status (200);
        self.unpause_message (msg);
    },

    list_dir: function (loc) {
        var finfo;
        var dir = Gio.File.new_for_path (loc.path);
        files = [];
        if (!dir.query_exists (null)) return;
        try {
            finfo = dir.query_info ("*", 0, null);
            if (finfo.get_is_symlink ()) {
                if (follow_links) {
                    loc.path = finfo.get_symlink_target ();
                    debug ("Symlink Target " + loc.path);
                    dir = Gio.File.new_for_path (loc.path);
                    finfo = dir.query_info ("*", 0, null);
                } else return;
            }
            if (!finfo.get_attribute_boolean (Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ)) return;
            if (finfo.get_file_type () == Gio.FileType.REGULAR) {
                this.add_file (finfo, loc.path);
                return;
            }
            var e = dir.enumerate_children (ATTRIBUTES, follow_links?Gio.FileQueryInfoFlags.NONE:Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            while ((finfo = e.next_file (null)) != null) {
                if (!check_hidden) {
                    if (finfo.get_name ().startsWith ("."))
                        continue;
                }
                if (!check_backup) {
                    if (finfo.get_is_backup ())
                        continue;
                }
                switch (finfo.get_file_type ()) {
                    case Gio.FileType.DIRECTORY:
                        if (loc.recursive) {
                            let l = {path: loc.path + "/" + finfo.get_name (), recursive: true};
                            this.add_file (finfo, loc.path);
                        }
                        break;
                    case Gio.FileType.REGULAR:
                        this.add_file (finfo, loc.path);
                        break;
                    default:
                        print ("DEFAULT", finfo.get_name (), finfo.get_file_type (), Gio.FILE_TYPE_DIRECTORY, Gio.FILE_TYPE_REGULAR);
                        break;
                }
            }
        } catch (err) {
            error (err);
        }
        files.sort (sorting);
    },

    add_file: function (finfo, path) {
        debug ("add_file " + finfo.get_name ());
        files.push ({path: path,
            name: finfo.get_name (),
            type: finfo.get_file_type (),
            mime: finfo.get_content_type (),
            size: finfo.get_size (),
            date: finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED)});
    }
});

const ContentStream = new Lang.Class({
    Name: 'ContentStream',
    _init: function (server, message, file, finfo, count) {
        this.server = server;
        this.msg = message;
        this.version = message.get_http_version ();
        this.msg.connect ("wrote-chunk", Lang.bind (this, this.wrote_chunk));
        this.msg.connect ("finished", ()=>{
            debug ("ContentStream " + this.num + " finished");
            this.done = true;
            if (this.read_event != 0) {
                Mainloop.source_remove (this.read_event);
                this.read_event = 0;
            }
            try{this.stream.close (null);
            }catch (err) {
            error ("Error close stream " + err);
            }
            this.b = [];
            try{this.msg.set_status (200);
            }catch (err) {
            error ("Error set status " + err);
            }
            try{
            this.msg.response_body.complete ();
            }catch (err) {
            error ("Error complete " + err);
            }
            try{this.msg.response_body.free();
            }catch (err) {
            error ("Error free body " + err);
            }
            System.gc ();
        });
        this.file = file;
        this.mime = finfo.get_content_type ();
        this.size = finfo.get_size ();
        this.date = new Date (finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED)*1000).toUTCString();
        this.num = count.toString();
        this.stream = null;
        this.offset = 0;
        this.wrotes = 0;
        this.reads = 0;
        this.read_event = 0;
        this.done = false;
        debug ("Start steamimg");
        this.file.read_async (GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.opened));
        //System.gc();
    },

    wrote_chunk: function (sender, msg) {
        this.wrotes++;
        debug ("Request(" + this.num + ") wrote_chunk: " + this.wrotes + "/" + this.reads);
    },

    opened: function (sender, result) {
        try {
            this.msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
            this.msg.response_headers.set_content_type (this.mime, null);
            this.msg.response_headers.set_content_length (this.size);
            this.msg.response_headers.append ("Last-Modified", this.date);
            this.msg.response_headers.append ("Accept-Ranges", "bytes");
            this.msg.response_headers.append ("Server", "Obmin");
            this.msg.response_body.set_accumulate (false);
            this.stream = this.file.read_finish (result);
            if (this.version == 1) this.msg.set_status (206);
            else this.msg.set_status (200)
            this.msg.request_headers.foreach ( (n, v) => {
                if (n.indexOf ("Range") > -1)
                    if (v.indexOf ("bytes=") > -1) {
                        let s = v.slice (6).split("-");
                        if (s[0]) this.offset = parseInt(s[0]);
                    }
            });
            debug ("Request(" + this.num + ") offset " + this.offset);
            this.read_more (this.offset > 0);
        } catch (err) {
            error (err);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    read_more: function (seek) {
        if (this.read_event != 0) {
            Mainloop.source_remove (this.read_event);
            this.read_event = 0;
        }
        if (this.done) return;
        if (seek) this.stream.seek (this.offset, GLib.SeekType.SET, null);
        if ((this.reads - this.wrotes) > 32) {
            this.read_event = Mainloop.timeout_add (250, Lang.bind (this, this.read_more));
            return;
        }
        this.stream.read_bytes_async (64*1024, GLib.PRIORITY_DEFAULT, null, Lang.bind (this, this.read_done));
        this.reads++;
    },

    read_done: function (sender, result) {
        try {
            this.b = this.stream.read_bytes_finish (result);
            if (this.done) {
                debug ("Stream " + this.num + " done");
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
                this.msg.response_headers.set_content_range (this.offset - this.b.get_size(),this.offset-1,this.size);
                //this.msg.response_headers.set_range (this.offset - this.b.get_size(),-1);
                this.msg.response_body.append_buffer (new Soup.Buffer (this.b.get_data()));
                /*debug ("Request(" + this.num + ")\n" + this.msg.method + " HTTP/1." + this.msg.get_http_version ());
                this.msg.request_headers.foreach ( (n, v) => {debug (n + ": " + v);});*/
                //if (this.msg.request_body.length > 0) debug (this.msg.request_body);
                /*debug ("Response(" + this.num + ")");
                this.msg.response_headers.foreach ( (n, v) => {debug (n + ": " + v);});*/
                debug ("Stream " + this.num + " " + this.offset + ":" + this.size);
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

function info (msg) {
    if (DEBUG > 0) print ("[obmin] " + msg);
}

function debug (msg) {
    if (DEBUG > 1) print ("[obmin] " + msg);
}

function error (msg) {
    print ("[obmin] (EE) " + msg);
}

let settings = Convenience.getSettings();
mounts = settings.get_boolean (MOUNTS_KEY);
follow_links = settings.get_boolean (LINKS_KEY);
check_hidden = settings.get_boolean (HIDDENS_KEY);
check_backup = settings.get_boolean (BACKUPS_KEY);
port = settings.get_int (PORT_KEY);
DEBUG = settings.get_int (DEBUG_KEY);
let srcs =  settings.get_string (SOURCES_KEY);
if (srcs.length > 0) sources = JSON.parse (srcs);
else sources.push ({path: GLib.get_home_dir (), recursive: true});

let obmin = new ObminServer ();

Mainloop.run ('obminMainloop');
