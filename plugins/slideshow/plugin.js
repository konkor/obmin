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
const GdkPixbuf = imports.gi.GdkPixbuf;

const APPDIR = get_appdir ();
imports.searchPath.unshift (APPDIR);
const Base = imports.plugins.base;

var LOG_DOMAIN = "slideshow";

var METADATA = {
    name: "Slideshow",
    uuid: "6a3c0b97ba5450736bc9ebad59eb27ff",
    summary: "Slideshow viewer for many image formats",
    tooltip: "Slideshow viewer for many image formats\nincluding RAW (dcraw package required)",
    schema: "obmin.plugin.konkor.slideshow",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM | Base.PlugType.NOTIFY | Base.PlugType.SCRIPT
};

var SHOWS = [
{query:"", title: "Manual Slideshow", label: "Slideshow"},
{query:"auto=8", title: "Automatic Slideshow", label: "Slideshow+"}
];

var mime = "image/png;image/jpeg;image/gif;image/x-icon;image/x-ico;image/x-win-bitmap;image/svg+xml;image/svg;image/svg-xml;image/vnd.adobe.svg+xml;text/xml-svg;image/svg+xml-compressed";
var mime_raw = ";image/x-adobe-dng;image/x-canon-cr2;image/x-canon-crw;image/x-dcraw;image/x-fuji-raf;image/x-hdr;image/x-kde-raw;image/x-kodak-dcr;image/x-kodak-k25;image/x-kodak-kdc;image/x-minolta-mrw;image/x-nikon-nef;image/x-olympus-orf;image/x-panasonic-raw;image/x-panasonic-raw2;image/x-pentax-pef;image/x-sigma-x3f;image/x-sony-arw;image/x-sony-sr2;image/x-sony-srf";

var Plugin = new Lang.Class ({
    Name: 'SlideshowPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
        this.dcraw = GLib.find_program_in_path ("dcraw");
        if (this.dcraw) mime += mime_raw;
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

    notify: function (files) {
        let s = "", c = 0;
        files.forEach (f=>{if ((f.type == 1) && (mime.indexOf (f.mime) > -1)) c++;});
        if (c < 2) return s;
        var btn_style = "cursor:pointer;display:table-cell;float:right;margin:8px";
        s = "<div id=\""+this.puid+"\" class=\"panel\"><a href=\"?plug="+this.puid+
        "&auto=8\" style=\"display:table-cell;float:left;margin:8px\" title=\"Slideshow\">Slideshow available... ("+c+" pictures)</a><a style=\""+btn_style+"\" onclick=\"hide(\'"+
        this.puid+"\')\" title=\"Close notification\">Close</a></div>";
        return s;
    },

    response: function (request) {
        debug ("response");
        let file, r, auto = 0;
        if (request.path == '/') return this.root_handler (request);
        [file, r] = this.obmin.get_file (request.path);
        if (!file) [file, r] = this.obmin.get_file (GLib.uri_unescape_string (request.path, null));
        if (!file) return false;
        var finfo = file.query_info ("standard::*", 0, null);
        var ftype = finfo.get_file_type ();
        if ((ftype == 1) && (mime.indexOf (finfo.get_content_type ()) > -1))
            return this.get_slide (request, file, finfo);
        else if (ftype == 2) if (request.query) {
            if (request.query.auto && Number.isInteger (parseInt (request.query.auto)))
                auto = parseInt (request.query.auto)*1000;
            return this.get_show (request, file, r, auto);
        }
        return false;
    },

    get_slide: function (request, file, finfo) {
        if (this.dcraw && mime_raw.indexOf (finfo.get_content_type ()) > -1)
            return this.get_raw (request, file);
        try {
        if (finfo.get_size () < 128000)
            return this.obmin.send_data (request.msg, file.load_contents (null)[1], "image/jpeg");
        var pb = GdkPixbuf.Pixbuf.new_from_file_at_scale (file.get_path(), 2000, 2000, true).apply_embedded_orientation();
        let [res, buf] = pb.save_to_bufferv ("jpeg", [], []);
        if (!res) return false;
        this.obmin.send_data (request.msg, buf, "image/jpeg");
        } catch (e) {
            error (e);
            return false;
        }
        return true;
    },

    get_raw: function (request, file) {
        let archive = file.get_basename() + ".thumb.jpg";
        let args = [this.dcraw,"-e","-c",file.get_path()];
        return this.obmin.send_pipe_async (request, args, archive, "image/jpeg");
    },

    get_show: function (request, dir, rec_attr, auto) {
        let html =
"<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"+
"<style>"+
"* {box-sizing:border-box}"+
"body {color:#f2f2f2;background-color:#111;font-family:roboto,sans;text-align:center;vertical-align:middle;margin:0}"+
".mySlides {display:none}"+
".screen-container{width:100%;height:100%;display:table}"+
".slideshow-container{position:relative;margin:auto;vertical-align:middle;display: table-cell;}"+
".prev, .next {cursor:pointer;position:absolute;top:50%;width:auto;padding:32px;margin-top:-22px;"+
"color:white;font-weight:bold;font-size:18px;transition:0.6s ease;border-radius:0 3px 3px 0;outline: 0}"+
".prev {left:0}.next {right:0;border-radius:3px 0 0 3px;}"+
".prev:hover, .next:hover {background-color:rgba(0,0,0,0.8);}"+
".text {font-size:16px;padding:8px 12px;position:absolute;bottom:24px;width:100%;text-align:center;}"+
".return {cursor:pointer;position:absolute;color:rgba(255,255,255,0.7);font-size:22px;padding:1em;top:0;display:block;text-decoration:none;margin:0;}"+
".return:hover,.return:active,.speedbtn:hover,.speedbtn:active {color:#fff; background-color:rgba(0,0,0,0.8)}"+
".numbertext {color:rgba(255,255,255,0.7);font-size:1em;padding:1em 1em;position:absolute;top:3.5em}"+
".album {font-size:18px;padding:0em 0.4em;vertical-align:middle}"+
".text,.numbertext,.return,.speedbtn {text-shadow:1px 1px 1px #000}"+
".toolbar {position:absolute;margin:0;top:0;right:0;text-align:right}"+
".speedbtn {cursor:pointer;color:rgba(255,255,255,0.7);background-color:transparent;border:none;font-size:1em;padding:1em;outline:0;text-align:right;font-size:18px}"+
".speed-menu{display:block;position:relative;background-color:#f9f9f9;min-width:160px;overflow:auto;box-shadow:0px 8px 16px 0px rgba(255,255,255,0.4);font-size:16px;right:0}"+
".speed-menu a {cursor:pointer;color:black;padding:12px 16px;display:block;}"+
".speed-menu a:hover {background-color: #aaa}"+
".ctrl,.speed-menu{display:none;z-index:1}"+
".fade {-webkit-animation-name: fade;-webkit-animation-duration: 1.0s;animation-name: fade;animation-duration: 1.0s;}"+
"@-webkit-keyframes fade {from {opacity: .6} to {opacity: 1}}"+
"@keyframes fade {from {opacity: .7} to {opacity: 1}}"+
"</style></head><body><div class=\"screen-container\"><div class=\"slideshow-container\">";
        let script = "<script> var pictures = [";
        let filter = mime, n = 7;
        var files = this.obmin.list_dir (
            {path: dir.get_path (), recursive: rec_attr}, false,
            {mime:filter,size:0,size_condition:Base.Condition.MORE});
        if (files.length == 0)
            return this.none (request.msg);
        if (files.length < n)
            n = files.length;
        var mid = 0;
        if (n == 3) mid = 1;
        else if (n > 3) mid = Math.round (n/2) - 1;

        html += "<a class=\"return ctrl\" title=\"Back to the folder\" href=\".\">< <span class=\"album\">" +
            dir.get_basename () + "</span></a>";
        html += "<div class=\"numbertext ctrl\">1 / " + files.length + "</div>";
        html += "<div class=\"toolbar ctrl\"><div class=\"speed\"><button class=\"speedbtn\" onclick=\"toggle_speed()\">Speed</button><div class=\"speed-menu\"><a onclick=\"set_speed(0)\">Manual</a>";
        [4,8,12,20,30,60].forEach (p=>{html += "<a onclick=\"set_speed("+p+")\">"+p+" seconds</a>";});
        html += "</div></div></div>";
        for (let i = 0; i < mid; i++) {
            html += "<div class=\"mySlides\"><img src=\"" + files[i].name.toString() + "?plug=" + this.puid +
            "\"  class=\"myImages\" style=\"max-width:100%;max-height:100vh;width:auto;height:auto;\">"+
            "<div class=\"text\">" + files[i].name.toString() + "</div></div>";
        }
        for (let i = 0; i < files.length; i++) {
            if (i < n - mid) {
                html += "<div class=\"mySlides\"><img src=\"" + files[i].name.toString() + "?plug=" + this.puid +
                "\"  class=\"myImages\" style=\"max-width:100%;max-height:100vh;width:auto;height:auto;\">"+
                "<div class=\"text ctrl\">" + files[i].name.toString() + "</div></div>";
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
"var speed_menu = document.getElementsByClassName(\"speed-menu\")[0];\n"+
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
"    showSlides (n, false);\n"+
"}\n"+
"function showSlides (n, fx) {\n"+
"    n = (typeof n !== \'undefined\') ?  n : 1;\n"+
"    fx = (typeof fx !== \'undefined\') ?  fx : true;\n"+
"    picIndex += n;\n"+
"    for (let i = 0; i < slides.length; i++)\n"+
"        slides[i].style.display = \"none\";\n"+
"    if (n != 0) get_slides (n);\n"+
"    slides[mid].style.display = \"block\";\n"+
"    if (fx) images[mid].classList.toggle(\"fade\");\n"+
"    if (fx) setTimeout(()=>{images[mid].classList.toggle(\"fade\");}, 950);\n"+
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
"function set_speed(val){"+
"    delay=val*1000;"+
"    plusSlides(0);"+
"    toggle_speed();"+
"}"+
"function toggle_speed(){"+
"    if (speed_menu.style.display == \"none\") speed_menu.style.display=\"block\";"+
"    else speed_menu.style.display=\"none\";"+
"}"+
"</script></body></html>";

        files = [];
        return this.obmin.send_data (request.msg, html);
    },

    none: function (msg) {
        return this.obmin.send_data (msg, "<html><head><title>Not found</title></head>" +
        "<body style=\"color:#fff;background-color:#333\"><h1>No images found</h1></body></html>");
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
