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

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const APPDIR = get_appdir ();
imports.searchPath.unshift (APPDIR);
const Base = imports.plugins.base;

var LOG_DOMAIN = "tar";

var METADATA = {
    name: "gzip",
    uuid: "bd269ad77d725c4e8fa19ecd59e5dd68",
    summary: "GZIP File Compressor",
    tooltip: "Compress files to an archive...",
    schema: "obmin.plugins.konkor.gzip",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM
};

var LISTS = [
{query:"tar", title: "Flat Folder With Tar", label: "TAR+"},
{query:"gz", title: "Compress Folder With GZip", label: "GZIP+"},
{query:"bz", title: "Compress Folder With BZip2", label: "BZ2+"},
{query:"xz", title: "Compress Folder With XZ", label: "XZ+"},
];

var Plugin = new Lang.Class ({
    Name: 'GzipPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
    },

    menu_item: function (class_name) {
        let s = "";
        LISTS.forEach (l => {
            s += "<a href=\"?plug=" + this.puid + "&format=" + l.query + "\" class=\"" +
            class_name + "\" onclick=\"toggle()\" title=\"" + l.title + "\">" + l.label + "</a>";
        });
        return s;
    },

    response: function (server, msg, path, query, client, num) {
        let file, r, recursive = false;
        if (path == '/') return this.root_handler (server, msg);
        [file, r] = this.obmin.get_file (path);
        if (!file) [file, r] = this.get_file (GLib.uri_unescape_string (path, null));
        if (!file) return false;
        if (query && query.recursive && query.recursive == 1) recursive = true;
        if (query && query.format) 
            return this.get_tar (server, msg, file, r, query.format, recursive, num);
        return false;
    },

    get_tar: function (server, msg, dir, rec_attr, ext, recursive, num) {
        var finfo = dir.query_info ("standart::*", 0, null), path;
        let mime, archive = dir.get_basename(), args = [];
        let tar = GLib.find_program_in_path("tar");
        debug ("tar", tar);
        if (!tar) return false;
        args.push (tar);
        if (finfo.get_is_symlink ())
            path = Gio.File.new_for_path (finfo.get_symlink_target ());
        else path = dir;
        if (!this.obmin.check_backup) args.push ("--exclude-backups");
        args.push ("-C"); args.push (path.get_parent().get_path ());
        if (ext == "tar") {
            args.push ("-cf");
            archive += ".tar";
            mime = "application/x-tar";
        } else if (ext == "gz") {
            args.push ("-zcf");
            archive += ".tar.gz";
            mime = "application/x-compressed-tar";
        } else if (ext == "bz") {
            args.push ("-jcf");
            archive += ".tar.bz2";
            mime = "application/x-bzib-compressed-tar";
        } else if (ext == "xz") {
            args.push ("-Jcf");
            archive += ".tar.xz";
            mime = "application/x-xz-compressed-tar";
        } else return false;
        args.push ("-");
        args.push (path.get_basename());
        //args.push (".");
        //if (!recursive || !rec_attr) args.push ("--exclude=\'*/*\'");
        return this.obmin.send_pipe_async (server, msg, args, archive, mime, num);
    }
});

function debug (domain, text) {
    if (!text) Base.debug (LOG_DOMAIN, domain);
    else Base.debug (domain, text);
}

function error (domain, text) {
    if (!text) Base.error (LOG_DOMAIN, domain);
    else Base.error (domain, text);
}

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
