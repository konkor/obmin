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
    name: "Compressor",
    uuid: "bd269ad77d725c4e8fa19ecd59e5dd68",
    summary: "Default file compressor",
    tooltip: "Compressing folders in the selected archive format",
    schema: "obmin.plugins.konkor.compressor",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM
};

var LISTS = [
{query:"tar", title: "Flat Folder With Tar", label: "TAR+"},
{query:"gz", title: "Compress Folder With GZip", label: "GZIP+"},
{query:"xz", title: "Compress Folder With XZ", label: "XZ+"}
];
var bz2_item = {query:"bz", title: "Compress Folder With BZip2", label: "BZ2+"};
var zip_item  = {query:"zip", title: "Compress Folder With ZIP", label: "ZIP+"};

var Plugin = new Lang.Class ({
    Name: 'GzipPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
        this.zip = GLib.find_program_in_path ("zip");
        if (this.zip) LISTS.push (zip_item);
        else LISTS.push (bz2_item);
    },

    menu_item: function (class_name) {
        let s = "";
        LISTS.forEach (l => {
            s += "<a href=\"?plug=" + this.puid + "&format=" + l.query + "\" class=\"" +
            class_name + "\" onclick=\"toggle()\" title=\"" + l.title + "\">" + l.label + "</a>";
        });
        return s;
    },

    response: function (request) {
        let file, r, recursive = false;
        if (request.path == '/') return this.root_handler (request);
        [file, r] = this.obmin.get_file (request.path);
        if (!file) [file, r] = this.get_file (GLib.uri_unescape_string (request.path, null));
        if (!file) return false;
        if (request.query && request.query.recursive && request.query.recursive == 1) recursive = true;
        if (request.query && request.query.format) 
            return this.get_tar (request, file, r, recursive);
        return false;
    },

    get_tar: function (request, dir, rec_attr, recursive) {
        var finfo = dir.query_info ("standart::*", 0, null), path, ext = request.query.format;
        let mime, archive = dir.get_basename(), args = [], workdir;
        let tar = GLib.find_program_in_path("tar");
        debug ("tar", tar);
        if (!tar) return false;
        if (finfo.get_is_symlink ())
            path = Gio.File.new_for_path (finfo.get_symlink_target ());
        else path = dir;
        //if (!this.obmin.check_backup) args.push ("--exclude-backups");
        //args.push ("-C"); args.push (path.get_parent().get_path ());
        workdir = path.get_parent().get_path ();
        if (ext == "tar") {
            args = [tar,"-cf","-"];
            archive += ".tar";
            mime = "application/x-tar";
        } else if (ext == "gz") {
            args = [tar,"-zcf","-"];
            archive += ".tar.gz";
            mime = "application/x-compressed-tar";
        } else if (ext == "bz") {
            args = [tar,"-jcf","-"];
            archive += ".tar.bz2";
            mime = "application/x-bzib-compressed-tar";
        } else if (ext == "xz") {
            args = [tar,"-Jcf","-"];
            archive += ".tar.xz";
            mime = "application/x-xz-compressed-tar";
        } else if (this.zip && (ext == "zip")) {
            args = [this.zip,"-","-r","-q"];
            archive += ".zip";
            mime = "application/zip";
        } else return false;
        args.push (path.get_basename());
        if ((ext != "zip") && (!this.obmin.check_backup)) args.push ("--exclude-backups");
        //if (!recursive || !rec_attr) args.push ("--exclude=\'*/*\'");
        debug (args);
        return this.obmin.send_pipe_async (request, args, archive, mime, workdir);
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
