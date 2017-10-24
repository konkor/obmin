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
{query:"auto=8", title: "Automatic Slideshow With 2 Seconds Interval", label: "Slideshow+"}
];

var mime = "image/png;image/jpeg;image/gif;image/x-icon;image/x-ico;image/x-win-bitmap;image/svg+xml;image/svg;image/svg-xml;image/vnd.adobe.svg+xml;text/xml-svg;image/svg+xml-compressed";
var mime_raw = "image/x-canon-cr2;image/x-panasonic-raw2";

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
        if (!file) [file, r] = this.obmin.get_file (GLib.uri_unescape_string (path, null));
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
"<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"+
"<style>"+
"* {box-sizing:border-box}"+
"body {color:#f2f2f2;background-color:#111;font-family:roboto,sans;text-align:center;vertical-align:middle;margin:0}"+
".mySlides {display:none}"+
".screen-container{width:100%;height:100%;display:table}"+
".slideshow-container{position:relative;margin:auto;vertical-align:middle;display: table-cell;}"+
".prev, .next,.return {cursor:pointer;position:absolute;top:50%;width:auto;padding:32px;margin-top:-22px;"+
"color:white;font-weight:bold;font-size:18px;transition:0.6s ease;border-radius:0 3px 3px 0;;outline: 0}"+
".prev {left:0}.next {right:0;border-radius:3px 0 0 3px;}"+
".prev:hover, .next:hover {background-color:rgba(0,0,0,0.8);}"+
".text {font-size:15px;padding:8px 12px;position:absolute;bottom:24px;width:100%;text-align:center;}"+
".return {color:rgba(255,255,255,0.6);font-size:2.4em;padding:.5em .5em;top:0;display:block;text-decoration: none;margin:0;}"+
".return:hover,.return:active {color:#fff; background-color:rgba(0,0,0,0.8)}"+
".numbertext {color:rgba(255,255,255,0.7);font-size:1.2em;padding:1em 1em;position:absolute;top:3em}"+
".album {font-size:.6em;padding:0em 0.4em;vertical-align:middle}"+
".text,.numbertext,.return {text-shadow:1px 1px 1px #000}"+
".ctrl {display:none}"+
".fade {-webkit-animation-name: fade;-webkit-animation-duration: 2.5s;animation-name: fade;animation-duration: 2.5s;}"+
"@-webkit-keyframes fade {from {opacity: .7} to {opacity: 1}}"+
"@keyframes fade {from {opacity: .7} to {opacity: 1}}"+
"</style></head><body><div class=\"screen-container\"><div class=\"slideshow-container\">";
        let script = "<script> var pictures = [";
        let filter = mime, n = 5;
        var files = this.obmin.list_dir (
            {path: dir.get_path (), recursive: rec_attr}, false,
            {mime:filter,size:0,size_condition:Base.Condition.MORE});
        if (files.length == 0)
            return this.none (server, msg);
        if (files.length < n)
            n = files.length;
        var mid = 0;
        if (n == 3) mid = 1;
        else if (n > 3) mid = Math.round (n/2) - 1;

        html += "<a class=\"return ctrl\" title=\"Back to the folder\" href=\".\">< <span class=\"album\">" +
            dir.get_basename () + "</span></a>";
        html += "<div class=\"numbertext ctrl\">1 / " + files.length + "</div>";
        for (let i = 0; i < mid; i++) {
            html += "<div class=\"mySlides\"><img src=\"" + files[i].name.toString() + "?plug=" + this.puid +
            "\"  class=\"myImages\" style=\"max-width:100%;max-height:100vh;width:auto;height:auto;\">"+
            "<div class=\"text\">" + files[i].name.toString() + "</div></div>";
        }
        for (let i = 0; i < files.length; i++) {
            if (i < n - mid) {
                html += "<div class=\"mySlides\"><img src=\"" + files[i].name.toString() + "?plug=" + this.puid +
                "\"  class=\"myImages\" style=\"max-width:100%;max-height:100vh;width:auto;height:auto;\">"+
                "<div class=\"text\">" + files[i].name.toString() + "</div></div>";
            }
            script += "\"" + files[i].name.toString() + "\",";
        }
        html +=  "<a class=\"prev ctrl\" onclick=\"plusSlides(-1)\">&#10094;</a>"+
"<a class=\"next ctrl\" onclick=\"plusSlides(1)\">&#10095;</a>"+ "</div></div>" + script + "];\n"+
"var slideIndex=0,picIndex=0,timeoutID=0,ctrlID=0,delay=" + auto + ",mid=" + mid + ";\n"+
"var slides = document.getElementsByClassName(\"mySlides\");\n"+
"var images = document.getElementsByClassName(\"myImages\");\n"+
"var texts = document.getElementsByClassName(\"text\");\n"+
"var ctrls = document.getElementsByClassName(\"ctrl\");\n"+
"var numtext = document.getElementsByClassName(\"numbertext\");\n"+
"var onctrl = false;\n"+
"if (mid > 0) for (let i = 1; i <= mid; i++)\n"+
"    images[mid - i].src = pictures[pictures.length - i] + \"?plug=6a3c0b97ba5450736bc9ebad59eb27ff\";\n"+
"for (let i = 0; i < ctrls.length; i++)\n"+
"    ctrls[i].onmouseover = function(){onctrl=true};\n"+
"for (let i = 0; i < ctrls.length; i++)\n"+
"    ctrls[i].onmouseout = function(){onctrl=false};\n"+
"showSlides (0);\n"+
"show_ctrl(10000);"+
"function plusSlides (n) {\n"+
"    if (timeoutID) {\n"+
"        clearTimeout(timeoutID);\n"+
"        timeoutID=0;\n"+
"    }\n"+
"    showSlides (n);\n"+
"}\n"+
"function showSlides (n) {\n"+
"    n = (typeof n !== \'undefined\') ?  n : 1;\n"+
"    picIndex += n;\n"+
"    for (let i = 0; i < slides.length; i++)\n"+
"        slides[i].style.display = \"none\";\n"+
"    if (n != 0) get_slides (n);\n"+
"    slides[mid].style.display = \"block\";\n"+
"    slides[mid].classList.toggle(\"fade\");\n"+
"    setTimeout(()=>{slides[mid].classList.toggle(\"fade\");}, 2550);\n"+
"    if (delay) {\n"+
"        //slideIndex++;\n"+
"        timeoutID=setTimeout(showSlides, delay);\n"+
"    }\n"+
"}\n"+
"function get_slides (n) {\n"+
"    var i, bi = picIndex+mid*n;\n"+
"    if (n > 0) {\n"+
"        for (i = 0; i < slides.length - 1; i++) {"+
"            images[i].src = images[i+1].src;texts[i].innerHTML = texts[i+1].innerHTML;}\n"+
"        if (picIndex >= pictures.length) picIndex = 0;\n"+
"        if (bi >= pictures.length) bi -= pictures.length;\n"+
"    } else {\n"+
"        for (i = slides.length - 1; i > 0; i--) {"+
"            images[i].src = images[i-1].src;texts[i].innerHTML = texts[i-1].innerHTML;}\n"+
"        if (picIndex < 0) picIndex = pictures.length - 1;\n"+
"        if (bi < 0) bi += pictures.length;\n"+
"    }\n"+
"    numtext[0].innerHTML = (picIndex+1).toString() + \" / \" + pictures.length;\n"+
"    texts[i].innerHTML = pictures[bi];\n"+
"    images[i].src = pictures[bi] + \"?plug=6a3c0b97ba5450736bc9ebad59eb27ff\";\n"+
"}\n"+
"window.onmousemove = function(){show_ctrl()};"+
"function show_ctrl(delay) {"+
"    if (ctrlID) {"+
"        clearTimeout(ctrlID);"+
"        ctrlID=0;"+
"    }"+
"    delay = delay || 2000;"+
"    for (let i = 0; i < ctrls.length; i++)"+
"        ctrls[i].style.display = \"block\";"+
"    ctrlID = setTimeout (hide_ctrl, delay);"+
"}"+
"function hide_ctrl() {"+
"    if (onctrl) return false;"+
"    for (let i = 0; i < ctrls.length; i++)"+
"        ctrls[i].style.display = \"none\";"+
"    ctrlID=0;"+
"    return false;"+
"}"+
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
