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
const GdkPixbuf = imports.gi.GdkPixbuf;

const APPDIR = get_appdir ();
imports.searchPath.unshift (APPDIR);
const Base = imports.plugins.base;

var LOG_DOMAIN = "slideshow";

var METADATA = {
    name: "slideshow",
    uuid: "6a3c0b97ba5450736bc9ebad59eb27ff",
    summary: "Slideshow Viewer",
    tooltip: "Slideshow Viewer",
    schema: "obmin.plugin.konkor.slideshow",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM | Base.PlugType.TOOLBAR | Base.PlugType.SCRIPT
};

var SHOWS = [
{query:"", title: "Make Slideshow", label: "Slideshow"},
{query:"auto=4", title: "Automatic Slideshow With 2 Seconds Interval", label: "Slideshow+"}
];

var mime = "image/png;image/jpeg;image/gif;image/svg+xml";

var Plugin = new Lang.Class ({
    Name: 'SlideshowPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
    },

    menu_item: function (class_name) {
        let s = "", q = "";
        SHOWS.forEach (l => {
            if (l.query) q = "&" + l.query;
            s += "<a href=\"?plug=" + this.puid + q + "\" class=\"" +
            class_name + "\" onclick=\"toggle()\" title=\"" + l.title + "\">" + l.label + "</a>";
        });
        return s;
    },

    response: function (server, msg, path, query, client, num) {
        debug ("response");
        let file, r, auto = 0;
        if (path == '/') return this.root_handler (server, msg);
        [file, r] = this.obmin.get_file (path);
        if (!file) [file, r] = this.get_file (GLib.uri_unescape_string (path, null));
        if (!file) return false;
        var finfo = file.query_info ("standard::*", 0, null);
        var ftype = finfo.get_file_type ();
        if ((ftype == 1) && (mime.indexOf (finfo.get_content_type ()) > -1))
            return this.get_slide (server, msg, file, finfo);
        else if (ftype == 2) if (query) {
            if (query.auto && Number.isInteger (parseInt (query.auto))) auto = parseInt (query.auto)*1000;
            return this.get_show (server, msg, file, r, auto);
        }
        return false;
    },

    get_slide: function (server, msg, file, finfo) {
        try {
        if (finfo.get_size () < 512000) {
            msg.set_response (finfo.get_content_type (), 2, file.load_contents (null)[1]);
            msg.set_status (200);
            msg.response_headers.append ("Server", "Obmin");
            server.unpause_message (msg);
            return true
        }
        var pb = GdkPixbuf.Pixbuf.new_from_file_at_scale (file.get_path(), 2000, 2000, true);
        let [res, buf] = pb.save_to_bufferv ("jpeg", [], []);
        if (!res) return false;
        msg.set_response ("image/jpeg", 2, buf);
        msg.set_status (200);
        msg.response_headers.append ("Server", "Obmin");
        server.unpause_message (msg);
        } catch (e) {
            error (e);
            return false;
        }
        return true;
    },

    get_show: function (server, msg, dir, rec_attr, auto) {
        let html =
"<html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"+
"<style>"+
"* {box-sizing:border-box}"+
"body {color:#f2f2f2;background-color:#333;font-family:sans;text-align:center;vertical-align:middle;margin:0}"+
".mySlides {display:none}"+
".screen-container{width:100%;height:100%;display:table}"+
".slideshow-container{position:relative;margin:auto;vertical-align:middle;display: table-cell;}"+
".prev, .next {cursor:pointer;position:absolute;top:50%;width:auto;padding:16px;margin-top:-22px;"+
"color:white;font-weight:bold;font-size:18px;transition:0.6s ease;border-radius:0 3px 3px 0;}"+
".prev {left:0}.next {right:0;border-radius:3px 0 0 3px;}"+
".prev:hover, .next:hover {background-color:rgba(0,0,0,0.8);}"+
".text {font-size:15px;padding:8px 12px;position:absolute;bottom:32px;width:100%;text-align:center;}"+
".numbertext {font-size:12px;padding:8px 12px;position:absolute;top:0;}"+
".text,.numbertext {text-shadow:1px 1px 1px #000}"+
".fade {-webkit-animation-name: fade;-webkit-animation-duration: 1.5s;animation-name: fade;animation-duration: 1.5s;}"+
"@-webkit-keyframes fade {from {opacity: .4} to {opacity: 1}}"+
"@keyframes fade {from {opacity: .4} to {opacity: 1}}"+
"</style></head><body><div class=\"screen-container\"><div class=\"slideshow-container\">";
        let script = "<script> var pictures = [";
        let filter = mime, n = 5;
        var files = this.obmin.list_dir ({path: dir.get_path (), recursive: rec_attr}, false, {mime:filter});
        if (files.length == 0)
            return this.none (server, msg);
        if (files.length < n)
            n = files.length;

        for (let i = 0; i < files.length; i++) {
            if (i < n) {
                html += "<div class=\"mySlides fade\"><div class=\"numbertext\">" +
                (i + 1).toString () + " / " + files.length + "</div><img src=\"" +
                files[i].name.toString() + "?plug=" + this.puid + "\" style=\"max-width:100%;max-height:100vh;width:auto;height:auto;\">"+
                "<div class=\"text\">" + files[i].name.toString() + "</div></div>";
            }
            script += "\"" + files[i].name.toString() + "\",";
        };
        html +=  "<a class=\"prev\" onclick=\"plusSlides(-1)\">&#10094;</a>"+
"<a class=\"next\" onclick=\"plusSlides(1)\">&#10095;</a>"+ "</div></div>" + script +
"];\nvar slideIndex=1,timeoutID=0,delay=" + auto + ";\nshowSlides ();\nfunction plusSlides (n) {\n"+
"if (timeoutID) {clearTimeout(timeoutID);timeoutID=0;slideIndex--}"+
"  slideIndex += n;\n"+
"  showSlides ();}\n"+
"function showSlides () {"+
"  var i;"+
"  var slides = document.getElementsByClassName(\"mySlides\");"+
"  if (slideIndex > slides.length) {slideIndex = 1}"+
"  if (slideIndex < 1) {slideIndex = slides.length}"+
"  for (i = 0; i < slides.length; i++) {"+
"      slides[i].style.display = \"none\";"+
"  }"+
"  slides[slideIndex-1].style.display = \"block\";"+
"  if (delay) {slideIndex++;timeoutID=setTimeout(showSlides, delay);}"+
"}"+
"\n"+
"</script></body></html>";

        msg.response_headers.append ("Server", "Obmin");
        msg.set_response ("text/html", 2, html);
        msg.set_status (200);
        server.unpause_message (msg);
        files = [];
        return true;
    },

    none: function (server, msg) {
        msg.set_response ("text/html", 2,
        "<html><head><title>Not found</title></head>" +
        "<body style=\"color:#fff;background-color:#333\"><h1>No images found</h1></body></html>");
        msg.set_status (200);
        server.unpause_message (msg);
        return true;
    },

    root_handler: function (server, msg) {
        msg.set_status (302);
        msg.response_headers.append ("Location", "/");
        server.unpause_message (msg);
        return true;
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
