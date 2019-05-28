/*
 * This is a part of OBMIN Server
 * Copyright (C) 2017-2019 konkor <konkor.github.io>
 *
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
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
    summary: "Real-time Media File's Encoding To Web Supported Format",
    tooltip: "The plugin converts various media formats to WEBM/ISO Video Format\n(gstreamer1.0-* packages required)",
    schema: "obmin.plugin.konkor.gstreamer",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.LINK
};

var web_mime = "video/mp4;video/webm";
var mime = "video/mp4;video/3gpp;video/3gpp2;video/dv;video/mp2t;video/mpeg;video/ogg;video/quicktime;video/vivo;video/webm;video/x-avi;video/x-flv;" +
  "video/x-matroska;video/x-matroska-3d;video/x-mng;video/x-msvideo;video/x-nsv;video/x-ogm+ogg;video/x-theora+ogg;video/x-vnd.rn-realvideo";
var mime_audio = ";application/ogg;audio/x-vorbis+ogg;audio/ac3;audio/basic;audio/x-flac;audio/mp4;audio/mpeg;audio/x-mpeg;audio/x-ms-asx;audio/x-pn-realaudio;audio/flac";
var threads = Math.round (GLib.get_num_processors()/2) - 1;
if (threads < 1) threads = 1;
var containers = [
["quicktime","video/mp4","h.264","mpeg-4 aac",".mp4"],
["webm","video/webm","vp8","vorbis",".webm"],
["webm","video/webm","vp9","vorbis",".webm"]
];
var profiles = [
["Auto", "Automatic encoding (remuxing if it possible)"],
["ISO Low", "ISO H.264 Low (0.1 MB/s 128kbit)"],
["ISO Normal", "ISO H.264 (0.5 MB/s 160kbit)"],
["ISO High", "ISO H.264 (1.0 MB/s 192kbit)"],
["WEBM Low", "WEBM (Quality level 35)"],
["WEBM Normal", "WEBM (Quality level 28)"],
["WEBM High", "WEBM (Quality level 21)"]
];
var profile_video = [
["!","x264enc","bitrate=4000","speed-preset=2","bframes=2","cabac=true","dct8x8=true"],
["!","x264enc","bitrate=960","speed-preset=2","bframes=2","cabac=true","dct8x8=true"],
["!","x264enc","bitrate=3600","speed-preset=2","bframes=2","cabac=true","dct8x8=true"],
["!","x264enc","bitrate=7600","speed-preset=2","bframes=2","cabac=true","dct8x8=true"],
["!","vp8enc","cpu-used=0","threads="+threads,"end-usage=2","undershoot=95","keyframe-max-dist=360","dropframe-threshold=70","deadline=1000","min_quantizer=13","cq-level=35"],
["!","vp8enc","cpu-used=0","threads="+threads,"end-usage=2","undershoot=95","keyframe-max-dist=360","dropframe-threshold=70","deadline=1000","min_quantizer=10","cq-level=28"],
["!","vp8enc","cpu-used=0","threads="+threads,"end-usage=2","undershoot=95","keyframe-max-dist=360","dropframe-threshold=70","deadline=1000","min_quantizer=8","cq-level=21"],
];
var profile_audio = [
["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=192000"],
["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=128000"],
["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=160000"],
["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=192000"],
["!","audioconvert","!","audio/x-raw,channels=2","!","vorbisenc","quality=0.8"],
["!","audioconvert","!","audio/x-raw,channels=2","!","vorbisenc","quality=0.8"],
["!","audioconvert","!","audio/x-raw,channels=2","!","vorbisenc","quality=0.8"],
];
var style = {
container:"padding:4px;margin:0px auto 4px auto;display:table;border:0;border-color: #a4aaaa;border-radius:4px;vertical-align: middle",
button:"display:table-cell;border-radius:8px;padding:4px;margin:8px;font-size:14px",
rbutton:"display:table-cell;float:right;font-size:1.2em"
}

var Plugin = new Lang.Class ({
    Name: 'GStreamerPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
        this.gst_discover = GLib.find_program_in_path ("gst-discoverer-1.0");
        this.gst = GLib.find_program_in_path ("gst-launch-1.0");
        //mime += mime_audio;
        this.element = 0;
    },

    link: function (file, div) {
        var l = div, href = " href=\"" + file.name + "?plug=d33096fb1a680b6709e01fea59f31bb1";
        if (mime.indexOf(file.mime)==-1) return div;
        l += "<div class=\"content\" style=\""+style.container+"\">"+
        "<a class=\"path\""+href+"\" style=\""+style.button+"\" title=\"Auto Profile (Remux/ISO Normal)\">WATCH ONLINE</a>";
        for (let i = 1; i < profiles.length; i++) {
            l += "<a class=\"pbtn\""+href+"&profile="+i+"\" style=\""+style.button+"\" title=\""+
            profiles[i][1] + "\">" + profiles[i][0] + "</a>";
        }
        l += "</div>";
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
            var info;
            i = s.indexOf("container:");
            if (i > -1) {container = s.substring (i+10).trim().toLowerCase();return;}
            i = s.indexOf("audio:");
            if (i > -1) {audio.push (s.substring (i+6).trim().toLowerCase());return;}
            i = s.indexOf("video:");
            if (i > -1) {
                info = s.substring (i+6).trim().toLowerCase();
                if (info.indexOf("h.264") > -1) info = "h.264";
                else if (info.indexOf("mpeg-2 video") > -1) info = "mpeg-2 video";
                else if (info.indexOf("mpeg-4 video") > -1) info = "mpeg-4 video";
                else if (info.indexOf("mpeg-4 version 3") > -1) info = "mpeg-4 version 3";
                else if (info.indexOf("mpeg-4 version 2") > -1) info = "mpeg-4 version 2";
                else if (info.indexOf("mpeg-4 version 1") > -1) info = "mpeg-4 version 1";
                video.push (info);return;
            }
        });
        f.container = container;
        f.video = video;
        f.audio = audio;
        if (container && (video.length > 0 || audio.length > 0)) {
            for (i = 0; i < containers.length; i++) {
                if (f.container == containers[i][0]) f.support = 1;
                video.forEach(s=>{if (s != containers[i][2])f.support = 0;});
                audio.forEach(s=>{if (s != containers[i][3])f.support = 0;});
                if (f.support == 1) break;
            }
        }
        //debug (f.mime, container,video,audio,f.support);
        return f;
    },

    response: function (request) {
        debug ("gst response");
        let file, r, auto = 0;
        if (request.path == '/') return this.root_handler (request);
        [file, r] = this.obmin.get_file (request.path);
        if (!file) [file, r] = this.obmin.get_file (GLib.uri_unescape_string (request.path, null));
        if (!file) return false;
        var finfo = file.query_info ("standard::*", 0, null);
        var ftype = finfo.get_file_type ();
        if ((ftype == 1) && (mime.indexOf (finfo.get_content_type ()) > -1))
            return this.get_media (request, file, finfo);
        return false;
    },

    get_media: function (request, file, finfo) {
        var args = [this.gst,"--quiet","filesrc","location=\""+file.get_path()+"\"","!"], raw = false;
        var prf  = 0;
        if (request.query && request.query.profile)
            if (request.query.profile > 0 && request.query.profile < profiles.length)
                prf = request.query.profile;
        if (mime_audio.indexOf(finfo.get_content_type ())>-1) return this.get_audio (request, file, finfo);
        var f = this.discover ({path:file.get_path(), mime:finfo.get_content_type()});
        if (f.support == 1 && prf == 0) return this.obmin.send_file_async (request, file, finfo);
        //var c = this.get_container (f);
        //if (!c) c = containers[0];
        var c = prf<4?containers[0]:containers[1];
        if (f.container && (f.container == "matroska" || f.container == "webm")) {
            args.push ("matroskademux");
        } else if (f.container && f.container == "quicktime") {
            args.push ("qtdemux");
        } else if (f.container && f.container == "mpeg-2 transport stream") {
            args.push ("tsdemux");
        } else if (f.container && f.container == "audio video interleave (avi)") {
            args.push ("avidemux");
        } else if (f.container && f.container == "ogg") {
            args.push ("oggdemux");
        }else {
            raw = true;
            args.push ("decodebin");
        }
        ["name=\"d\"","d."].forEach (s=>{args.push(s)});
        if (!raw) args.push("!");
        if (f.video.length>0)
            if (!raw && (f.video[0] == "h.264") && prf == 0) args.push ("h264parse");
            else { if (!raw) {
                if (f.video[0] == "mpeg-2 video")
                    ["mpeg2dec"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "mpeg-4 video")
                    ["avdec_mpeg4","max-threads=1"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "theora")
                    ["theoradec"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "vp8")
                    ["vp8dec"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "vp9")
                    ["vp9dec"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "mpeg-4 version 3")
                    ["avdec_msmpeg4"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "mpeg-4 version 2")
                    ["avdec_msmpeg4v2"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "mpeg-4 version 1")
                    ["avdec_msmpeg4v1"].forEach (s=>{args.push(s)});
                else if (f.video[0] == "h.264")
                    ["avdec_h264","max-threads=2"].forEach (s=>{args.push(s)});
                else {
                    raw = true;
                    args = [this.gst,"--quiet","filesrc","location=\""+file.get_path()+"\"","!","decodebin","name=\"d\"","d."];
                }}
                //["!","x264enc","pass=quant","quantizer=26","speed-preset=1"].forEach (s=>{args.push(s)});
                //["!","x264enc","pass=cbr","bitrate=4000","speed-preset=1"].forEach (s=>{args.push(s)});
                //["!","x264enc","speed-preset=2","!","video/x-h264,profile=main"].forEach (s=>{args.push(s)});
                //["!","x264enc","bitrate=4000","speed-preset=2","bframes=2","cabac=true","dct8x8=true"].forEach (s=>{args.push(s)});
                profile_video[prf].forEach (s=>{args.push(s)});
            }
        ["!","queue","!"].forEach (s=>{args.push(s)});
        if (c[0] == "quicktime")
            ["mp4mux","streamable=true","fragment-duration=10"].forEach (s=>{args.push(s)});
        else
            ["webmmux","streamable=true"].forEach (s=>{args.push(s)});
        ["name=mux","!","filesink","location=/dev/stdout","d."].forEach (s=>{args.push(s)});
        if (f.audio.length>0) {
            if (!raw && (f.audio[0] == "mpeg-4 aac") && prf < 4) args.push ("!","aacparse");
            else {
            if (!raw) {
            if (f.audio[0] == "ac-3 (atsc a/52)")
                ["!","ac3parse","!","a52dec","drc=true","mode=10"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "e-ac-3 (atsc a/52b)")
                ["!","ac3parse","!","avdec_eac3"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "dts")
                ["!","dcaparse","!","dtsdec"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "mpeg-1 layer 3 (mp3)")
                ["!","mpegaudioparse","!","mpg123audiodec"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "vorbis")
                ["!","vorbisparse","!","vorbisdec"].forEach (s=>{args.push(s)});
            else if (f.audio[0] == "mpeg-4 aac")
                ["!","aacparse","!","faad"].forEach (s=>{args.push(s)});
            }
            //["!","audioconvert","!","audio/x-raw,channels=2","!","voaacenc","bitrate=192000"].forEach (s=>{args.push(s)});
            profile_audio[prf].forEach (s=>{args.push(s)});
            }
            ["!","queue",].forEach (s=>{args.push(s)});
        }
        ["!","mux."].forEach (s=>{args.push(s)});
        var dstr = "";
        args.forEach (s=>{dstr += " " + s});
        //debug (dstr.trim());
        return this.obmin.send_pipe_async (request, args, file.get_basename()+c[4], c[1]);
    },

    get_container: function (f) {
        var c = null;
        for (var i = 0; i < containers.length; i++)
            if ((f.video.length>0 && containers[i][2]==f.video[0]) || (f.audio.length>0 && containers[i][3]==f.audio[0])){
                c = containers[i];
                break;
            }
        return c;
    },

    get_audio: function (request, file, finfo) {
        //var f = this.discover ({path:file.get_path(), mime:finfo.get_content_type()});
        //TODO process audio
        return this.obmin.send_file_async (request, file, finfo);
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
    s = "/usr/local/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    s = "/usr/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/obmin-server", GLib.FileTest.EXISTS)) return s;
    throw "Obmin installation not found...";
    return s;
}
