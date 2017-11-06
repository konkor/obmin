/*
 * Obmin - Simple File Sharing Server
 *
 * Copyright (C) 2017 Kostiantyn Korienkov <kapa76@gmail.com>
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

var LOG_DOMAIN = "fetch";

var METADATA = {
    name: "Camera",
    uuid: "29a6ea2ed82ef3e5a43a62e059ff5fba",
    summary: "Live Video Camera",
    tooltip: "Steaming a video for linux device\n(v4l device require)",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    version: 1,
    api: 1,
    type: Base.PlugType.MENU_ITEM
};

var Plugin = new Lang.Class ({
    Name: 'CameraPlugin',
    Extends: Base.Plugin,

    _init: function (obmin) {
        this.parent (obmin, METADATA);
        this.launch = GLib.find_program_in_path ("gst-launch-1.0");
    },

    menu_item: function (class_name) {
        let s = "";
        if (!this.launch) return s;
        s += "<a href=\"?plug=" + this.puid + "\" class=\"" +
             class_name + "\" onclick=\"toggle()\" title=\"Live Video Camera\">Live</a>";
        return s;
    },

    response: function (request) {
//        var args = [this.launch,"--quiet","v4l2src","device=/dev/video0","brightness=265536","!",
//        "video/x-raw,format=I420,width=640,height=480,framerate=25/1","!","decodebin","!","videoconvert","!",
//        "vp8enc","target-bitrate=256000","keyframe-max-dist=60","max_quantizer=13","cpu-used=2","!",
//        "queue","!","webmmux","streamable=true","name=mux","!","filesink","location=/dev/stdout","!",
//        "alsasrc","!","audioconvert","!","audio/x-raw,channels=2","!",
//        "vorbisenc","bitrate=80000","!","queue","!","mux."];
        var args = [this.launch,"--quiet","v4l2src","!","decodebin","!","videoconvert","!",
        "vp8enc","target-bitrate=256000","keyframe-max-dist=60","max_quantizer=13","cpu-used=2","!",
        "queue","!","webmmux","streamable=true","name=mux","!","filesink","location=/dev/stdout"];
        var dstr = "";
        args.forEach (s=>{dstr += " " + s});
        debug (dstr.trim());
        if (!this.launch) return false;
        return this.obmin.send_pipe_async (request, args, "camera.webm", "video/webm");
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
