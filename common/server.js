/*
 * Obmin - Simple File Sharing Server
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
 * Obmin is distributed in the hope that it will be useful, but
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

const APPDIR = get_appdir ();
//debug ("APPDIR:" + APPDIR);
imports.searchPath.unshift (APPDIR);
const Convenience = imports.convenience;
const Stream = imports.common.stream;
const Plugs = imports.plugins.base;

String.prototype.format = Convenience.Format.format;
const md5 = Convenience.md5;

var CONFIG_PATH = GLib.get_user_config_dir() + "/obmin";

const ATTRIBUTES = "standard," +
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED + "," +
    Gio.FILE_ATTRIBUTE_UNIX_NLINK + "," +
    Gio.FILE_ATTRIBUTE_UNIX_MODE + "," +
    Gio.FILE_ATTRIBUTE_UNIX_INODE + "," +
    Gio.FILE_ATTRIBUTE_UNIX_DEVICE + "," +
    Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT + "," +
    Gio.FILE_ATTRIBUTE_ID_FILESYSTEM + "," +
    Gio.FILE_ATTRIBUTE_GVFS_BACKEND + "," +
    Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ;

//const ATTRIBUTES = "standard::*,access::*,mountable::*,time::*,unix::*,owner::*,selinux::*,thumbnail::*,id::filesystem,trash::orig-path,trash::deletion-date,metadata::*";
const vfss = ["afp", "google-drive", "sftp", "webdav", "ftp", "nfs", "cifs"];

const HTTPS_KEY = 'https';
const AUTH_KEY = 'authentication';
const USER_KEY = 'username';
const PASS_KEY = 'password';
const LINKS_KEY = 'links-settings';
const MOUNTS_KEY = 'mounts-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const UUID_KEY = 'user-id';
const JOURNAL_KEY = 'logs';
const STATS_MONITOR_KEY = 'stats-monitor';
const STATS_DATA_KEY = 'stats';
const SUPPORT_KEY = 'support';
const THEME_KEY = 'theme';
const MODE_KEY = 'server-mode';
const PORT_KEY = 'port';
const DEBUG_KEY = 'debug';
const ENABLED_KEY = "enabled-extensions";
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';
const LOG_DOMAIN = 'server';

const html_head = "<head><meta charset=\"utf-8\"><title>Obmin - Simple File Sharing</title><meta name=\"viewport\" content=\"width=device-width\"><link href=\"/style.css\" rel=\"stylesheet\" type=\"text/css\"></head>";
const h_menu_btn = "<a class=\"nmenu-button\" href=\"javascript:void(0);\" onclick=\"toggle()\" title=\"Toggle Menu\">&#x2630;</a>";
var html_menu = "<div id=\"navmenu\" class=\"nmenu hide\">";
const h_menu = "<a href=\"https://github.com/konkor/obmin/wiki\" class=\"nmenu-item right\" onclick=\"toggle()\" title=\"About Obmin\">About ...</a>";
const h_js = "<script>function toggle(id){id = (typeof id !== \'undefined\')?id:\'navmenu\'; var x=document.getElementById(id);if(x.className.indexOf(\"show\")==-1){x.className += \" show\";}else{x.className=x.className.replace(\" show\",\"\");}}function hide(id){if (!id) return; var x=document.getElementById(id);if(x.className.indexOf(\"hide\")==-1){x.className += \" hide\";}}</script>";

let https = false;
let mounts = true;
let follow_links = true;
let check_hidden = false;
let check_backup = false;
let theme = APPDIR + "/data/themes/www/default/";
let support = 0;
let uuid = '';
let journal = true;
let stats_monitor = true;
let contest = true;
let mode = 0;
let port = 8088;
var DEBUG_LVL = 1;
var S_TIMEOUT = 50;
var P_TIMEOUT = 500;

let server = null;
let files = [];
let sources = [];
let excluded = [];
var counter = {access:0, ready:0, upload:0};

//TODO PLUG MANAGER
let enabled_plugs = [
"f7d92e608a582d0fe0313bb959e3d51f",
"bd269ad77d725c4e8fa19ecd59e5dd68",
"6a3c0b97ba5450736bc9ebad59eb27ff",
"d33096fb1a680b6709e01fea59f31bb1"
];
var plugins = null;
var plug_events = null;

let authentication = false;
let user = "test";
let pass = "123456";
let htdigest = "";

var ObminServer = new Lang.Class({
    Name: 'ObminServer',
    Extends: Soup.Server,

    _init: function () {
        GLib.set_prgname ("obmin-server");
        this.parent ({tls_certificate:tls_cert});
        settings.set_string (STATS_DATA_KEY, JSON.stringify (counter));
        this.plugs_init ();
        this.add_handler (null, Lang.bind (this, this._default_handler));
        try {
            this.listen_all (port, https?Soup.ServerListenOptions.HTTPS:0);
            info ("Server started at ::1:" + port + (https?" HTTPS":" HTTP"));
        } catch (err) {
            throw err;
        }
        if (authentication) {
            let auth = new Soup.AuthDomainDigest ({realm: Convenience.realm});
            auth.add_path ("/");
            auth.digest_set_auth_callback (this.digest_auth_callback);
            auth.set_filter (this.filter_callback);
            this.add_auth_domain (auth);
        }
    },

    digest_auth_callback: function (domain, msg, username) {
        if (user == username) return htdigest;
        return null;
    },

    filter_callback: function (domain, msg) {
        /*print (msg.uri.to_string(true), domain.accepts(msg));
        msg.request_headers.foreach ( (n, v) => {
            print (n + ": " + v);
        });*/
        if (!domain.accepts(msg)) return obmin.check_response (msg);
        return true;
    },

    check_response: function (msg) {
        let dig = {}, s = "", i = -1;
        let auth = msg.request_headers.get_one ("Authorization");
        debug ("fix digest", auth);
        if (!auth) return true;
        if (auth.indexOf ("Digest") != 0) return true;
        auth = auth.substring (7);
        i = auth.indexOf ("nonce=\"");
        if (i == -1) return true;
        s = auth.substring (i+7, auth.indexOf ("\", ", i + 7));
        if (!s) return true;
        dig.nonce = s;
        i = auth.indexOf ("uri=\"");
        if (i == -1) return true;
        s = auth.substring (i+5, auth.indexOf ("\", ", i + 5));
        if (!s) return true;
        dig.uri = s;
        i = auth.indexOf ("response=\"");
        if (i == -1) return true;
        s = auth.substring (i+10, auth.indexOf ("\", ", i + 10));
        if (!s) return true;
        dig.response = s;
        i = auth.indexOf (", qop=auth, ");
        if (i > -1)
            dig.qop = "auth";
        else if (auth.indexOf (", qop=auth-int, ") > -1)
            dig.qop = "auth-int";
        else return true;
        i = auth.indexOf (", nc=");
        if (i == -1) return true;
        s = auth.substring (i+5, auth.indexOf (", ", i + 5));
        if (!s) return true;
        dig.nc = s;
        i = auth.indexOf ("cnonce=\"");
        if (i == -1) return true;
        s = auth.substring (i+8, auth.indexOf ("\"", i + 8));
        if (!s) return true;
        dig.cnonce = s;

        dig.ha2 = md5 ("%s:%s".format (msg.method.toUpperCase(), dig.uri));
        s = md5 ("%s:%s:%s:%s:%s:%s".format (htdigest,dig.nonce,dig.nc,dig.cnonce,dig.qop,dig.ha2));
        if (s == dig.response) return false;

        return true;
    },

    plugs_init: function () {
        plugins = new Map ();
        plug_events = new Map ();
        let finfo;
        let dir = Gio.File.new_for_path (APPDIR + "/plugins");
        if (!dir.query_exists (null)) return;
        var e = dir.enumerate_children ("standard::*", Gio.FileQueryInfoFlags.NONE, null);
        while ((finfo = e.next_file (null)) != null) {
            if (finfo.get_file_type () != Gio.FileType.DIRECTORY) continue;
            if (!Gio.File.new_for_path(dir.get_path() + "/" + finfo.get_name() + "/plugin.js").query_exists (null))
                continue;
            try {
                let P = imports.plugins[finfo.get_name ()].plugin;
                if (P.hasOwnProperty("METADATA")) {
                    if (enabled_plugs.indexOf (P.METADATA.uuid) == -1) continue;
                    let plug = new P.Plugin (this);
                    plugins.set (plug.puid, plug);
                }
            } catch (e) {
                error (e);
            }
        }
        for (let p of plugins.values()) debug ("plugin: " + p.name);
        this.init_html_menu ();
    },

    init_html_menu: function () {
        for (let p of plugins.values()) if (p.has (Plugs.PlugType.MENU_ITEM))
            html_menu += p.menu_item ("nmenu-item");
        html_menu += h_menu;
        html_menu += "</div>";
    },

    _default_handler: function (server, msg, path, query, client) {
        counter.access++;
        let drop = false, num = counter.access;
        let request = {msg:msg, path:path, query:query, client:client, num:counter.access};
        //info ("Request (" + counter.access + ") " + client.get_host () + " HTTP/1." + msg.get_http_version () + " " + msg.method + " " + path );
        info ("Request (%d) %d %s HTTP/1.%d %s %s".format (counter.access, port, client.get_host (), msg.get_http_version (), msg.method, path ));
        msg.request_headers.foreach ( (n, v) => {
            debug (n + ": " + v);
        });
        if (query && query.plug && plugins.has (query.plug)) {
            debug ("plug response " + plugins.get (query.plug).puid);
            if (plug_events.has (query.plug) && (plug_events.get (query.plug) != 0)) {
                //Mainloop.source_remove (plug_events.get (query.plug));
                plug_events.set (query.plug, 0);
            }
            plug_events.set (query.plug, Mainloop.timeout_add (P_TIMEOUT, Lang.bind (this, function () {
                plug_events.set (query.plug, 0);
                if (!plugins.get (query.plug).response (request)) {
                    debug ("plugin not responding: " + query.plug);
                    this.not_found (msg);
                }
                counter.ready++;
                counter.upload += msg.response_body.length;
                this.update_stats ();
                return false;
            })));
            this.pause_message (msg);
            this.update_stats ();
            return;
        }
        if (msg.method == "POST") {
            counter.ready++;
            this.update_stats ();
            return;
        }
        if (msg.request_body.length > 0) debug (msg.request_body);
        debug ("Default handler start (" + counter.access + ")");
        Mainloop.timeout_add (S_TIMEOUT, Lang.bind (this, function () {
            if (path == '/') {
                msg.response_headers.append ("Server", "Obmin");
                msg.set_response ("text/html", Soup.MemoryUse.COPY, this._root_handler (msg));
                msg.set_status (200);
                this.unpause_message (msg);
                counter.ready++;
                this.update_stats ();
            } else this._send_content (request);

            return false;
        }));
        this.pause_message (msg);
        this.update_stats ();
    },

    _send_content: function (request) {
        let file, r, finfo;
        [file, r] = this.get_file (request.path);
        if (!file) [file, r] = this.get_file (GLib.uri_unescape_string (request.path, null));
        if (file) {
            finfo = file.query_info (ATTRIBUTES, 0, null);
            if (finfo.get_file_type () == 2) {
                if (mode > 0) {
                    request.path += "index.html";
                    if (this._send_content (request) || (mode == 2)) return true;
                    request.path = request.path.substring(0,request.path.length-10);
                }
                this.send_data (request.msg, this.get_dir (file, r, request.path));
            } else {
                if (!this.is_remote (finfo) && !finfo.get_attribute_boolean (Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ)) {
                    debug ("not found: " + finfo.get_name ());
                    this.not_found (request.msg);
                    counter.ready++;
                    counter.upload += msg.response_body.length;
                    this.update_stats ();
                    return true;
                }
                if (finfo.get_size () < 65536) {
                    try {
                        this.send_data (request.msg,
                            file.load_contents (null)[1],finfo.get_content_type (),finfo.get_name ());
                    } catch (e) {
                        error (e.message);
                        this.not_found (request);
                    }
                } else this.send_file_async (request, file, finfo);
            }
        } else if (request.path == '/favicon.ico') {
            this.send_data (request.msg, GLib.file_get_contents (APPDIR + "/data/www/favicon.ico")[1], "image/vnd.microsoft.icon");
        } else if (request.path.endsWith ('style.css')) {
            this.send_data (request.msg, GLib.file_get_contents (theme + "style.css")[1], "text/css");
        } else if (request.path.endsWith ('home.png')) {
            this.send_data (request.msg, GLib.file_get_contents (theme + "home.png")[1], "image/png");
        } else if (request.path.endsWith ('index.html') && (mode == 1)) {
            return false;
        } else {
            this.not_found (request.msg);
        }
        counter.ready++;
        counter.upload += request.msg.response_body.length;
        this.update_stats ();
        return true;
    },

    not_found: function (msg) {
        //msg.set_response ("text/html", Soup.MemoryUse.COPY, "<html><head><title>404</title></head><body><h1>404</h1></body></html>");
        //msg.response_headers.append ("Server", "Obmin");
        msg.set_status (404);
        this.unpause_message (msg);
        return true;
    },

    redirect: function (msg, path) {
        path = path || "/";
        msg.set_status (302);
        msg.response_headers.append ("Location", path);
        this.unpause_message (msg);
        return true;
    },

    send_data: function (msg, text, mime, filename, attachment) {
        mime = mime || "text/html";
        filename = filename?("filename=\"" + filename + "\";"):"";
        if (attachment) filename = "attachment;" + filename;
        if (filename) msg.response_headers.append ("Content-Disposition", filename);
        //msg.response_headers.set_content_type (mime, null);
        //msg.response_headers.set_content_length (text.length);
        msg.response_headers.append ("Server", "Obmin");
        msg.set_response (mime, 2, text);
        msg.set_status (200);
        this.unpause_message (msg);
        return true;
    },

    send_file: function (msg, path) {
        if (!path) return this.not_found (msg);
        var f = Gio.File.new_for_path (path);
        if (!f.query_exists (null)) this.not_found (msg);
        var finfo = f.query_info ("standard::*", 0, null);
        if (finfo.get_size () < 65536) {
            try {
                msg.set_response (finfo.get_content_type (), Soup.MemoryUse.COPY, f.load_contents (null)[1]);
                msg.response_headers.append ("Server", "Obmin");
                msg.response_headers.append ("Content-Disposition", "filename=\"" + finfo.get_name () + "\"");
                msg.response_headers.set_content_length (finfo.get_size ());
                msg.set_status (200);
            } catch (e) {
                error (e.message);
                return this.not_found (msg);
            }
            this.unpause_message (msg);
        } else this.send_file_async (request, f, finfo);
        return true;
    },

    send_file_async: function (request, file, finfo) {
        if (!file) return this.not_found (request.msg);
        finfo = finfo || file.query_info ("standard::*", 0, null);
        let st = new Stream.FileStream (this, request, file, finfo);
        request.msg.connect ("finished", (o)=> {
            debug ("file stream finished:" + st.num);
            counter.ready++;
            this.upload (st.uploaded);
            st = null;
            System.gc();
        });
        counter.ready--;
        return true;
    },

    send_pipe_async: function (request, args, name, mime, dir) {
        let st = new Stream.PipeStream (this, request, args, name, mime, dir);
        counter.ready--;
        request.msg.connect ("finished", Lang.bind (this, (o)=> {
            debug ("pipe finished %s:%d".format(st.num,st.offset));
            counter.ready++;
            this.upload (st.offset);
            st = null;
        }));
        return true;
    },

    update_stats: function () {
        if (!stats_monitor) return;
        settings.set_string (STATS_DATA_KEY, JSON.stringify (counter));
    },

    get_file: function (path) {
        let s = path, file, id = -1, src, i, res = [null, null], index = null;
        if (s.length == 0) return res;
        if (s[0] != '/') return res;
        s = s.slice (1);
        i = s.indexOf ('/');
        if (i == -1) {
            if (mode > 0) {
                sources.forEach (p => {
                    var fl = Gio.File.new_for_path (p.path);
                    if (fl.query_exists (null) && (fl.get_basename () == s)) index = fl;
                });
                if (index) return [index, false];
            }
            if (!this.is_int (s)) return res;
            id = parseInt (s);
            if (id >= sources.length) return res;
            file = Gio.File.new_for_path (sources[id].path);
            if (file.query_exists (null)) return [file, false];
        } else {
            src = s.substring (0, i);
            s = s.slice (i + 1);
            if (mode > 0) {
                i = 0;
                sources.forEach (p => {
                    var fl = Gio.File.new_for_path (p.path);
                    if (fl.query_exists (null) && (fl.get_basename () == src)) id = i;
                    i++;
                });
            }
            if (id == -1) {
                if (!this.is_int (src)) return res;
                id = parseInt (src);
            }
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
        if (!path) return "";
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

    get_dir: function (dir, r, path) {
        let slash, size, d = new Date(0), ds, link, i = 0, item = "";
        files = [];
        if (dir) files = this.list_dir ({path: dir.get_path (), recursive: r});
        else sources.forEach (s => {
            var fl = Gio.File.new_for_path (s.path), finfo;
            if (fl.query_exists (null)) {
                finfo = fl.query_info ("*", 0, null);
                files.push (this.add_file (finfo, s.path));
                if ((files.length > 0) && this.is_remote(finfo))
                    files[files.length - 1].name = this.remote_name (finfo);
            }
        });
        let html_body = "<body><div class=\"path\"><a href=\"/\"><img src=\"/home.png\" class=\"home\">> </a>" +
            this.get_path (path) + h_menu_btn + "</div>" + html_menu;
        for (let p of plugins.values()) if (p.has (Plugs.PlugType.NOTIFY))
            html_body += p.notify (files);
        html_body += "<div class=\"contents\">";
        files.forEach (f => {
            item = "";
            link = dir?f.name.toString():i.toString();
            if (f.type == 2) { slash = "/"; size = "Folder";}
            else {slash = ""; size = " " + GLib.format_size (f.size);}
            d.setTime (f.date*1000);
            ds = d.toString();
            if (ds.indexOf (" GMT")) ds = ds.substring (0, ds.indexOf (" GMT"));
            item += "<a href=\"" + link + slash + "\"><div class=\"content\">";
            item += "<div class=\"file\">" + f.name.replace (/\u002e/g,".&#8203;") + slash + "</div>";
            item += "<section class=\"fileinfo\"><div class=\"date\">" + ds + "</div>";
            item += "<div class=\"size\">" + size + "</div></section></div></a>";
            for (let p of plugins.values()) if (p.has (Plugs.PlugType.LINK))
                item = p.link (f,item);
            html_body += item;
            i++;
        });
        html_body += "</div>" + h_js + "</body>";
        return "<html>" + html_head + html_body + "</html>";
    },

    _root_handler: function (msg) {
        if (mode > 0)
            if (this._send_content ({msg:msg, path:'/index.html', num:this.access_counter}) || (mode == 2)) return '';
        return this.get_dir (null, false, null);
    },

    list_dir: function (loc, recursive, filter) {
        var finfo;
        var dir = Gio.File.new_for_path (loc.path);
        let files = [], item;
        //debug ("path: %s <-> %s".format (loc.path, dir.get_path()));
        if (!dir.query_exists (null)) return files;
        try {
            finfo = dir.query_info (ATTRIBUTES, 0, null);
            if (finfo.get_is_symlink ()) {
                if (follow_links) {
                    debug ("Symlink Target " + loc.path);
                    if (this.is_remote (finfo)) {
                        //Let the path route to the backend
                        debug (dir.resolve_relative_path (finfo.get_symlink_target ()).get_path());
                    } else {
                        loc.path = finfo.get_symlink_target ();
                        dir = Gio.File.new_for_path (loc.path);
                    }
                    finfo = dir.query_info (ATTRIBUTES, 0, null);
                } else return files;
            }
            if (!this.is_remote (finfo) && !finfo.get_attribute_boolean (Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ)) return files;
            if (!mounts && finfo.get_attribute_boolean (Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT)) return files;
            if (finfo.get_file_type () == Gio.FileType.REGULAR) {
                item = this.add_file (finfo, loc.path, filter);
                if (item) files.push (item);
                return files;
            }
            var e = dir.enumerate_children (ATTRIBUTES, follow_links?Gio.FileQueryInfoFlags.NONE:Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            while ((finfo = e.next_file (null)) != null) {
                if (!this.is_remote (finfo) && !finfo.get_attribute_boolean (Gio.FILE_ATTRIBUTE_ACCESS_CAN_READ)) continue;
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
                            let l = {path: dir.get_path() + "/" + finfo.get_name (), recursive: true};
                            item = this.add_file (finfo, dir.get_path(), filter);
                            if (item) files.push (item);
                            if (recursive) files = files.concat (this.list_dir (l,true));
                        }
                        break;
                    case Gio.FileType.REGULAR:
                        item = this.add_file (finfo, loc.path, filter);
                        if (item) files.push (item);
                        break;
                    default:
                        info ("DEFAULT %s filetype %d".format (finfo.get_name (), finfo.get_file_type ()));
                        break;
                }
            }
        } catch (err) {
            error (err);
        }
        if (!recursive) files.sort (sorting);
        return files;
    },

    add_file: function (finfo, path, filter) {
        //debug ("add_file:" + finfo.get_name ());
        //debug ("unix_mode:"+finfo.get_attribute_uint32 (Gio.FILE_ATTRIBUTE_UNIX_MODE));
        var size_condition = 0;
        let item = {path: path,
            name: finfo.get_name (),
            type: finfo.get_file_type (),
            mime: finfo.get_content_type (),
            size: finfo.get_size (),
            date: finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED)};
        if (filter) {
            if (filter.mime && filter.mime.indexOf (item.mime) == -1) item = null;
            if (item && filter.mask && item.name.indexOf (filter.mask) == -1) item = null;
            if (item && (filter.size !== 'undefined') && (filter.size !== null)) {
                if (filter.size_condition) size_condition = filter.size_condition;
                switch (size_condition) {
                    case Plugs.Condition.NOT_EQUAL:
                        if (filter.size == item.size) item = null;
                        break;
                    case Plugs.Condition.LESS:
                        if (filter.size <= item.size) item = null;
                        break;
                    case Plugs.Condition.LESS_EQUAL:
                        if (filter.size < item.size) item = null;
                        break;
                    case Plugs.Condition.MORE:
                        if (filter.size >= item.size) item = null;
                        break;
                    case Plugs.Condition.MORE_EQUAL:
                        if (filter.size > item.size) item = null;
                        break;
                    default:
                        if (filter.size != item.size) item = null;
                }
            }
        }
        return item;
    },

    is_remote: function (finfo) {
        let fs = finfo.get_attribute_string (Gio.FILE_ATTRIBUTE_ID_FILESYSTEM);
        for (let i = 0; i < vfss.length; i++) {
            if (fs.toLowerCase().indexOf (vfss[i]) > -1) return true;
        }
        return false;
    },

    remote_name: function (finfo) {
        let fs = finfo.get_attribute_string (Gio.FILE_ATTRIBUTE_ID_FILESYSTEM);
        if (fs.indexOf("host=") > -1) return fs.substring (fs.indexOf("host=") + 5);
        return fs;
    },

    check_backup: function () {
        return check_backup;
    },

    check_hidden: function () {
        return check_hidden;
    },

    ready: function (val) {
        if (val) {
            counter.ready += val;
            if (val > 0) this.update_stats ();
        }
        System.gc();
    },

    upload: function (val) {
        if (val) {
            counter.upload += val;
            if (val > 0) this.update_stats ();
        }
        System.gc();
    },

    debug_lvl: function () {
        return DEBUG_LVL;
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
    let file = Gio.File.new_for_path (path).get_parent();
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}

function get_appdir () {
    let s = getCurrentFile ()[1];
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    s = GLib.get_home_dir () + "/.local/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    s = "/usr/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    throw "Obmin installation not found...";
    return s;
}

let cmd_out, info_out;
function get_info_string (cmd) {
    cmd_out = GLib.spawn_command_line_sync (cmd);
    print (cmd_out[0],cmd_out[1],cmd_out[2],cmd_out[3]);
    if (cmd_out[1]) info_out = cmd_out[1].toString().split("\n")[0];
    if (info_out) return info_out;
    return "";
}

function sorting (a, b) {
    if (a.type != b.type) return b.type - a.type;
    if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
}

function info (msg) {
    Convenience.info (LOG_DOMAIN, msg);
}

function debug (msg) {
    if (DEBUG_LVL > 1) Convenience.debug (LOG_DOMAIN, msg);
}

function error (msg) {
    Convenience.error (LOG_DOMAIN, msg);
}

let settings = Convenience.getSettings();
let config = {};

function load_settings () {
    let cfg = false, s, f, srcs;
    for (let i = 0; i < ARGV.length; i++) {
        s = ARGV[i];
        if (cfg) {
            cfg = false;
            f = Gio.File.new_for_path (s);
            if (f.query_exists (null)) {
                try {
                srcs = f.load_contents (null)[1];
                if (srcs && (srcs.length > 0)) {
                    debug (srcs);
                    config = JSON.parse (srcs);
                }
                } catch (e) {error (e);}
            }
        }
        if ((s == "-h") || (s == "--help")) {
            print ("obmin-server [[OPTIONS] [PARAMETERS]]\n" +
            " --help : Show this screen\n" +
            " --config FILENAME : Load JSON configuration from the FILENAME\n");
            return false;
        }
        if (s == "--config") {
            cfg = true;
        }
    }
    if (config.mounts) mounts = config.mounts;
    else mounts = settings.get_boolean (MOUNTS_KEY);
    get_excluded_locations ();
    if (config.links) follow_links = config.links;
    else follow_links = settings.get_boolean (LINKS_KEY);
    if (config.hiddens) check_hidden = config.hiddens;
    else check_hidden = settings.get_boolean (HIDDENS_KEY);
    if (config.backups) check_backup = config.backups;
    else check_backup = settings.get_boolean (BACKUPS_KEY);
    if (config.mode) mode = config.mode;
    else mode = settings.get_int (MODE_KEY);
    if (config.port) port = config.port;
    else port = settings.get_int (PORT_KEY);
    if (config.debug) DEBUG_LVL = config.debug;
    else DEBUG_LVL = settings.get_int (DEBUG_KEY);
    support = settings.get_int (SUPPORT_KEY);
    if (config.logs) journal = config.logs;
    else journal = settings.get_boolean (JOURNAL_KEY);
    if (config.https) https = config.https;
    else https = settings.get_boolean (HTTPS_KEY);
    if (config.authentication) authentication = config.authentication;
    else authentication = settings.get_boolean (AUTH_KEY);
    if (config.user) user = config.user;
    else user = settings.get_string (USER_KEY);
    if (config.password) {
        pass = config.password;
        config.htdigest = Soup.AuthDomainDigest.encode_password (user, Convenience.realm, pass);
    }
    if (config.htdigest) htdigest = config.htdigest;
    else htdigest = settings.get_string (PASS_KEY);
    uuid = settings.get_string (UUID_KEY);
    if (!uuid) {
        uuid = Gio.dbus_generate_guid ();
        settings.set_string (UUID_KEY, uuid);
    }
    if (config.theme) theme = APPDIR + "/data/www/themes/" + config.theme + "/";
    else {
        theme = APPDIR + "/data/www/themes/" + settings.get_string (THEME_KEY) + "/";
        settings.connect ("changed::" + THEME_KEY, Lang.bind (this, function() {
            theme = APPDIR + "/data/www/themes/" + settings.get_string (THEME_KEY) + "/";
        }));
    }
    if (config.sources)
        check_sources (config.sources);
    else {
        srcs = settings.get_string (SOURCES_KEY);
        if (srcs.length > 0) check_sources (JSON.parse (srcs));
        else sources.push ({path: GLib.get_home_dir (), recursive: true});
    }
    if (config.plugins)
        enabled_plugs = config.plugins;
    else {
        srcs = settings.get_string (ENABLED_KEY);
        if (srcs.length > 0) enabled_plugs = JSON.parse (srcs);
    }
    if (config.stats_monitor) stats_monitor = config.stats_monitor;
    else {
        stats_monitor = settings.get_boolean (STATS_MONITOR_KEY);
        settings.connect ("changed::" + STATS_MONITOR_KEY, Lang.bind (this, function() {
            stats_monitor = settings.get_boolean (STATS_MONITOR_KEY);
        }));
    }
    return true;
}

function check_sources (list) {
    sources = [];
    list.forEach (s => {if (GLib.file_test (s.path, GLib.FileTest.EXISTS)) sources.push (s);});
}

function get_certificate () {
    let cert = settings.get_string ("tls-certificate");
    let key = settings.get_string ("private-key");
    debug ("Certificate" + cert + " " + key);
    if (cert && key) {
        return Gio.TlsCertificate.new_from_files (cert, key);
    } else {
        return Gio.TlsCertificate.new_from_files (
            CONFIG_PATH + "/certificate.pem",
            CONFIG_PATH + "/private.pem"
        );
    }
    return null;
};

function get_excluded_locations () {
    excluded = [];
    excluded.push ("/dev");
    excluded.push ("/proc");
    excluded.push ("/sys");
    excluded.push ("/selinux");
}

let obmin;
let tls_cert = null;
if (load_settings ()) {
    if (journal) Convenience.InitLogger (LOG_DOMAIN);
    if (https) {
        Convenience.gen_certificate ();
        tls_cert = get_certificate ();
    }

    obmin = new ObminServer ();
    Mainloop.run ('obminMainloop');
}
