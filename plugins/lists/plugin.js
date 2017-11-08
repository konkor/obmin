/*
 * Obmin - Simple File Sharing Server For GNU/Linux Desktop
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

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const APPDIR = get_appdir ();
imports.searchPath.unshift (APPDIR);
const Base = imports.plugins.base;

var MEDIA = [
"3g2",  "3gp",  "3gp2", "3gpp", "aac",  "ac3",  "aif",  "aifc",
"aiff", "al",   "alaw", "ape",  "asf",  "asx",  "au",   "avi",
"cda",  "cdr",  "divx", "dv",   "flac", "flv",  "gvi",  "gvp",
"m1v",  "m21",  "m2p",  "m2v",  "m4a",  "m4b",  "m4e",  "m4p",
"m4u",  "m4v",  "mp+",  "mid",  "midi", "mjp",  "mkv",  "moov",
"mov",  "movie","mp1",  "mp2",  "mp21", "mp3",  "mp4",  "mpa",
"mpc",  "mpe",  "mpeg", "mpg",  "mpga", "mpp",  "mpu",  "mpv",
"mpv2", "oga",  "ogg",  "ogv",  "ogm",  "omf",  "qt",   "ra",
"ram",  "raw",  "rm",   "rmvb", "rts",  "smil", "swf",  "tivo",
"u",    "vfw",  "vob",  "wav",  "wave", "wax",  "wm",   "wma",
"wmd",  "wmv",  "wmx",  "wv",   "wvc",  "wvx",  "yuv",  "f4v",
"f4a",  "f4b",  "669",  "it",   "med",  "mod",  "mol",  "mtm",
"nst",  "s3m",  "stm",  "ult",  "wow",  "xm",   "xnm",  "spx",
"ts",   "webm", "spc",  "mka",  "opus", "amr"
];

var METADATA = {
    name: "File Lists",
    uuid: "f7d92e608a582d0fe0313bb959e3d51f",
    summary: "Various file lists generator",
    tooltip: "Generating various file/play lists like URLS, PLS, M3U\n(+ for recursive subdirs)",
    schema: "obmin.plugins.konkor.filelists",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM
};

var LISTS = [
{query:"urls", title: "Get URLS file list", label: "URLS"},
{query:"pls", title: "Get PLS playlist", label: "PLS"},
{query:"m3u", title: "Get M3U playlist", label: "M3U"},
{query:"urls&recursive=1", title: "Get file list for the folder and all subdirs", label: "URLS+"},
{query:"pls&recursive=1", title: "Get playlist for the folder and all subdirs", label: "PLS+"},
{query:"m3u&recursive=1", title: "Get playlist for the folder and all subdirs", label: "M3U+"}
];

var Plugin = new Lang.Class ({
    Name: 'ListsPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
    },

    menu_item: function (class_name) {
        let s = "";
        LISTS.forEach (l => {
            s += "<a href=\"?plug=" + this.puid + "&list=" + l.query + "\" class=\"" +
            class_name + "\" onclick=\"toggle()\" title=\"" + l.title + "\">" + l.label + "</a>";
        });
        return s;
    },

    response: function (request) {
        let file, r, recursive = false;
        var query = request.query;
        if (request.path == '/') return this.root_handler (request);
        [file, r] = this.obmin.get_file (request.path);
        if (!file) [file, r] = this.get_file (GLib.uri_unescape_string (request.path, null));
        if (!file) return false;
        if (query && query.recursive && query.recursive == 1) recursive = true;
        if (query && query.list) {
            if (query.list == "urls") this.get_list (request, file, r, "urls", recursive);
            else if (query.list == "pls") this.get_list (request, file, r, "pls", recursive);
            else if (query.list == "m3u") this.get_list (request, file, r, "m3u", recursive);
        }
        return true;
    },

    get_list: function (request, dir, rec_attr, ext, recursive) {
        let list = "", ref = "", idx = 1, mime = "text/plain", ac = "/:_-()"; //ac = "/:_-();@&=+$";
        request.msg.request_headers.foreach ( (n, v) => {
            if (n.toLowerCase() == "referer") ref = GLib.uri_unescape_string (v, null);
        });
        var files = this.obmin.list_dir ({path: dir.get_path (), recursive: rec_attr}, recursive);
        var finfo = dir.query_info ("*", 0, null), path;
        if (finfo.get_is_symlink ()) path = finfo.get_symlink_target ();
        else path = dir.get_path ();
        if (recursive) files.forEach (f => {
            if (path.length != f.path.length) {
                f.name = "%s/%s".format (f.path.substring (path.length + 1), f.name);
            }
        });
        files.forEach (f => {
            if (f.type != Gio.FileType.DIRECTORY) {
                if (ext == "urls")
                    list += GLib.uri_escape_string (ref + f.name, ac, true) + "\n";
                else if (ext == "pls") {
                    if (this.is_media (f.name)) {
                        list += "File" + idx + "=" + GLib.uri_escape_string (ref + f.name, ac, false) + "\n";
                        //list += "Title" + idx + "=" + f.name + "\n";
                        idx++;
                    }
                } else if (ext == "m3u") {
                    if (this.is_media (f.name)) {
                        list += "#EXTINF:," + f.name + "\n";
                        list += GLib.uri_escape_string (ref + f.name, ac, false) + "\n";
                    }
                }
            }
        });
        if (ext == "pls") {
            mime = "audio/x-scpls";
            list = "[playlist]\nNumberOfEntries=" + (idx -1) + "\n" + list;
        } else if (ext == "m3u") mime = "audio/x-mpegurl";
        this.obmin.send_data (request.msg, list, mime, dir.get_basename () + "." + ext, true);
        files = [];
    },

    is_media: function (name) {
        let f = false;
        MEDIA.forEach ((e)=>{if (name.endsWith ("." + e)) f = true;});
        return f;
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
    let file = Gio.File.new_for_path (path).get_parent().get_parent();
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}

function get_appdir () {
    let s = getCurrentFile ()[1];
    if (GLib.file_test (s + "/obmin-server", GLib.FileTest.EXISTS)) return s;
    s = GLib.get_home_dir () + "/.local/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/obmin-server", GLib.FileTest.EXISTS)) return s;
    s = "/usr/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/obmin-server", GLib.FileTest.EXISTS)) return s;
    throw "Obmin installation not found...";
    return s;
}
