/*
 * This is a part of OBMIN Server
 * Copyright (C) 2017-2019 konkor <konkor.github.io>
 *
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */


const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const APPDIR = get_appdir ();
imports.searchPath.unshift(APPDIR);

const Convenience = imports.convenience;

const DEBUG_KEY = "debug";
const ENABLED_KEY = "enabled-extensions";

let DEBUG_LVL = 1;

let settings = null;
let plugins = null;
let enabled_plugins = [];

var ObminExtensions = new Lang.Class ({
    Name: 'ObminExtensions',
    Extends: Gtk.Application,
    Signals: { 'prepare-shutdown': {} },

    _init: function (uuid) {
        GLib.set_prgname ("obmin-extensions");
        this.parent ({
            application_id: "org.konkor.obmin.extensions",
            flags: Gio.ApplicationFlags.HANDLES_OPEN
        });
        GLib.set_application_name ("OBMIN Extensions");
        DEBUG_LVL = settings.get_int (DEBUG_KEY);
        var s = settings.get_string (ENABLED_KEY);
        if (s) enabled_plugins = JSON.parse (s);
        debug ("enabled:" + enabled_plugins);

        this.uuid = uuid;
        this._window = null;
    },

    vfunc_startup: function() {
        this.parent();
        this._window = new Gtk.Window ();
        this._window.title = "OBMIN Server Extensions";
        this._window.set_icon_name ('obmin');
        if (!this._window.icon) try {
            this._window.icon = Gtk.Image.new_from_file (APPDIR + "/data/icons/obmin.svg").pixbuf;
        } catch (e) {
            error (e);
        }
        this.add_window (this._window);
        this.build ();
        this.plugs_init ();
    },

    vfunc_activate: function() {
        this.activate_action ('start-client', null);

        this._window.connect('destroy', () => {
            this.emit('prepare-shutdown');
        });

        this._window.show_all ();
        this._window.present ();
    },

    build: function() {
        this._window.set_default_size (800, 512);
        let scroll = new Gtk.ScrolledWindow({ hscrollbar_policy: Gtk.PolicyType.NEVER,
            shadow_type: Gtk.ShadowType.IN,
            margin_top: 2 });
        this._window.add (scroll);
        this.selector = new Gtk.ListBox ({selection_mode: Gtk.SelectionMode.NONE});
        this.selector.expand = true;
        scroll.add (this.selector);
    },

    plugs_init: function () {
        plugins = new Map ();
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
                    let plug = new P.Plugin ();
                    plugins.set (plug.puid, plug);
                    this.add_plug_widget (plug);
                }
            } catch (e) {
                error (e);
            }
        }
        for (let p of plugins.values()) debug ("plugin: " + p.name + " " + p.uuid);
    },

    add_plug_widget: function (plug) {
        let item = new ExtensionItem (plug);
        this.selector.add (item);
    }
});

var ExtensionItem = new Lang.Class({
    Name: 'ExtensionItem',
    Extends: Gtk.ListBoxRow,

    _init: function (extension) {
        this.parent ();

        this.uuid = extension.uuid;
        this.tooltip_text = extension.tooltip;
        if (extension.author) this.tooltip_text += "\nThe Author: "+extension.author

        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 hexpand: true, margin: 12, spacing: 6 });
        this.add(hbox);
        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 6, hexpand: true });
        hbox.add(vbox);
        let name = GLib.markup_escape_text(extension.name, -1);
        let label = new Gtk.Label({ label: '<b>' + name + '</b>',
                                    use_markup: true,
                                    halign: Gtk.Align.START });
        vbox.add(label);
        let desc = extension.summary.split('\n')[0];
        label = new Gtk.Label({ label: desc,
                                ellipsize: 2,
                                halign: Gtk.Align.START });
        vbox.add(label);
        this.button = new Gtk.Button({ valign: Gtk.Align.CENTER,
                                      no_show_all: false,
                                      sensitive: false });
        this.button.add(new Gtk.Image({ icon_name: 'emblem-system-symbolic',
            icon_size: Gtk.IconSize.BUTTON,
            visible: true }));
        this.button.get_style_context().add_class('prefs-button');
        hbox.add (this.button);
        this.switcher = new Gtk.Switch ({ valign: Gtk.Align.CENTER,
                                        sensitive: true,
                                        state: this.enabled() });
        hbox.add (this.switcher);
        this.switcher.connect ('state_set', () => {
            this.enabled (this.switcher.active);
        });
    },

    enabled: function (state) {
        var ready = false, id, i;
        for (i = 0; i < enabled_plugins.length; i++) {
            if (enabled_plugins[i] == this.uuid) {
                ready = true;
                id = i;
                break;
            }
        }
        state = (typeof state !== 'undefined') ?  state : ready;
        if (ready != state) {
            if (state) enabled_plugins.push (this.uuid);
            else if (id > -1)
                enabled_plugins.splice (id, 1);
            if (settings)
                settings.set_string (ENABLED_KEY, JSON.stringify (enabled_plugins));
        }
        return state;
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
    s = "/usr/local/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    s = "/usr/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    throw "Obmin installation not found...";
    return s;
}

let cmd_out, info_out;
function get_info_string (cmd) {
    cmd_out = GLib.spawn_command_line_sync (cmd);
    if (cmd_out[0]) info_out = cmd_out[1].toString().split("\n")[0];
    if (info_out) return info_out;
    return "";
}

function debug (msg) {
    if (msg && (DEBUG_LVL > 1)) print ("[obmin][extensions] " + msg);
}

function error (msg) {
    log ("[obmin][extensions] (EE) " + msg);
}

settings = Convenience.getSettings ();

var uuid = ARGV[0]?ARGV[0]:null;

let app = new ObminExtensions (uuid);
app.run (ARGV);
