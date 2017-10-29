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
const Stream = imports.common.stream;

var LOG_DOMAIN = "gst";

var METADATA = {
    name: "Media Transcoder",
    uuid: "d33096fb1a680b6709e01fea59f31bb1",
    summary: "Real-time Encoding Media Files To The Web Supported Formats",
    tooltip: "Online Media Encoder",
    schema: "obmin.plugin.konkor.gstreamer",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.LINK
};

var web_mime = "video/mp4;video/webm";
var mime = "video/mp4;video/3gpp;video/3gpp2;video/dv;video/mp2t;video/mpeg;video/ogg;video/quicktime;video/vivo;video/webm;video/x-avi;video/x-flv;video/x-matroska;video/x-matroska-3d;video/x-mng;video/x-ms-asf;video/x-ms-wmp;video/x-ms-wmv;video/x-msvideo;video/x-nsv;video/x-ogm+ogg;video/x-theora+ogg;video/x-vnd.rn-realvideo";
var mime_audio = ";application/ogg;audio/x-vorbis+ogg;audio/ac3;audio/basic;audio/x-flac;audio/mp4;audio/mpeg;audio/x-mpeg;audio/x-ms-asx;audio/x-pn-realaudio;audio/flac";
var containers = {
quicktime: ["quicktime","video/mp4","h.264","mpeg-4 aac",".mp4"],
webm: ["webm","video/webm","vp8","vorbis",".webm"]
};

var Plugin = new Lang.Class ({
    Name: 'GStreamerPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
        this.gst_discover = GLib.find_program_in_path ("gst-discoverer-1.0");
        this.gst = GLib.find_program_in_path ("gst-launch-1.0");
        //mime += mime_audio;
    },

    link: function (file, div) {
        let l = div;
        if (mime.indexOf(file.mime)==-1) return div;
        l += "<a href=\"" + file.name + "?plug=d33096fb1a680b6709e01fea59f31bb1\" style=\"margin:0 8px\" title=\"Watch Online (beta)\">PLAY</a>"
        return l;
    },

    discover: function (file) {
        let format = {mime:file.mime,container:"",video:[],audio:[],support:-1};
        if (web_mime.indexOf(file.mime)>-1) format.support=0;
        if (!this.gst_discover) return format;
        var out = GLib.spawn_command_line_sync (this.gst_discover + " \"" + file.path +"\"");
        if (out[1]) format = this.parse_info (format, out[1].toString().split("\n"));
        return format;
    },

    parse_info: function (f, info) {
        let i, container = "", video = [], audio = [], text = [];
        info.forEach (s=>{
            i = s.indexOf("container:");
            if (i > -1) {container = s.substring (i+10).trim().toLowerCase();return;}
            i = s.indexOf("audio:");
            if (i > -1) {audio.push (s.substring (i+6).trim().toLowerCase());return;}
            i = s.indexOf("video:");
            if (i > -1) {video.push (s.substring (i+6).trim().toLowerCase());return;}
        });
        f.container = container;
        f.video = video;
        f.audio = audio;
        if (container && (video.length > 0 || audio.length > 0)) {
            var c = containers[container];
            if (c) {
                f.support = 1;
                video.forEach(s=>{if (s != c[2])f.support = 0;});
                audio.forEach(s=>{if (s != c[3])f.support = 0;});
            }
        }
        print (f.mime, container,video,audio,f.support);
        return f;
    },

    response: function (server, msg, path, query, client, num) {
        debug ("gst response");
        let file, r, auto = 0;
        if (path == '/') return this.root_handler (server, msg);
        [file, r] = this.obmin.get_file (path);
        if (!file) [file, r] = this.obmin.get_file (GLib.uri_unescape_string (path, null));
        if (!file) return false;
        var finfo = file.query_info ("standard::*", 0, null);
        var ftype = finfo.get_file_type ();
        if ((ftype == 1) && (mime.indexOf (finfo.get_content_type ()) > -1))
            return this.get_media (server, msg, file, finfo, client, num);
        return false;
    },

    get_media: function (server, msg, file, finfo, client, num) {
        var args = [this.gst,"--quiet","filesrc","location=\""+file.get_path()+"\"","!"];
        if (mime_audio.indexOf(finfo.get_content_type ())>-1) return this.get_audio ();
        var f = this.discover ({path:file.get_path(), mime:finfo.get_content_type()});
        if (f.support == 1) return this.native (server, msg, file, finfo, client, num);
        var c = this.get_container (f);
        if (!c) c = containers.quicktime;
        if (f.container && f.container == "matroska") {
            args.push ("matroskademux");
        } else if (f.container && f.container == "quicktime") {
            args.push ("qtdemux");
        } else if (f.container && f.container == "mpeg-2 transport stream") {
            args.push ("tsdemux");
        } else if (f.container && f.container == "audio video interleave (avi)") {
            args.push ("avidemux");
        }
        debug (f.container);
        ["name=\"d\"","d.","!"].forEach (s=>{args.push(s)});
        if (f.video.length>0)
            if (f.video[0] == "h.264") args.push ("h264parse");
            else {
                if (f.video[0] == "mpeg-2 video")
                    ["mpeg2dec"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "mpeg-4 video")
                    ["avdec_mpeg4"].forEach (s=>{args.push(s)});
                ["!","x264enc","quantizer=28","speed-preset=1"].forEach (s=>{args.push(s)});
            }
        ["!","queue","!"].forEach (s=>{args.push(s)});
        if (c[0] == "quicktime") {
            ["mp4mux","streamable=true","fragment-duration=8"].forEach (s=>{args.push(s)});
        }
        ["name=mux","!","filesink","location=/dev/stdout","d.","!"].forEach (s=>{args.push(s)});
        if (f.audio.length>0) {
            if (f.audio[0] == "mpeg-4 aac") args.push ("aacparse");
            else {
            if (f.audio[0] == "ac-3 (atsc a/52)")
                ["ac3parse","!","a52dec","drc=true","mode=10"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "e-ac-3 (atsc a/52b)")
                ["ac3parse","!","avdec_eac3"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "dts")
                ["dcaparse","!","dtsdec"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "mpeg-1 layer 3 (mp3)")
                ["mpegaudioparse","!","mpg123audiodec"].forEach (s=>{args.push(s)});
            ["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=192000"].forEach (s=>{args.push(s)});
            }
        }
        ["!","queue","!","mux."].forEach (s=>{args.push(s)});
        let st = new Stream.PipeStream (server, msg, args, file.get_basename()+c[4], c[1], num);
        this.obmin.ready (-1);
        msg.connect ("finished", Lang.bind (this, (o)=> {
            debug ("gst finished %s:%d".format(st.num,st.offset));
            this.obmin.ready (1);
            this.obmin.upload (st.offset);
            st = null;
        }));
        return true;
    },

    get_container: function (f) {
        var c = null;
        for (var p in containers)
            if ((f.video.length>0 && p[2]==f.video[0]) || (f.audio.length>0 && p[3]==f.audio[0])){
                c = p;
                break;
            }
        return c;
    },

    native: function (server, msg, file, finfo, client, num) {
        let st = new Stream.FileStream (server, msg, file, finfo, num);
        this.obmin.ready (-1);
        msg.connect ("finished", Lang.bind (this, (o)=> {
            debug ("audio gst end %s:%d".format(st.num,st.uploaded));
            this.obmin.ready (1);
            this.obmin.upload (st.uploaded);
            st = null;
        }));
        return true;
    },

    get_audio: function (server, msg, file, finfo, client, num) {
        //var f = this.discover ({path:file.get_path(), mime:finfo.get_content_type()});
        //TODO process audio
        return this.native (server, msg, file, finfo, client, num);
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
