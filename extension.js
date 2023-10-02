/*
 * This is a part of OBMIN Server
 * Copyright (C) 2017-2019 konkor <konkor.github.io>
 *
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const HTTPS_KEY = 'https';
const STARTUP_KEY = 'startup-settings';
const STATS_MONITOR_KEY = 'stats-monitor';
const SUPPORT_KEY = 'support';
const PORT_KEY = 'port';
const DEBUG_KEY = 'debug';
const STATUS_KEY = 'status';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension ();
const EXTENSIONDIR = Me.dir.get_path ();
const Convenience = Me.imports.convenience;

const Clipboard      = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;
const Gettext = imports.gettext.domain('gnome-shell-extensions-obmin');
const _ = Gettext.gettext;

let https = false;
let startup = false;
let support = 0;
let port = 8088;
let DEBUG = 1;
let stats_monitor = true;
let stats = {};

let update_event = 0;
let server = 0;

const ObminIndicator  = GObject.registerClass (class ObminIndicator extends PanelMenu.Button {

    _init () {
        super._init (0.0, "Obmin Server Indicator", false);
        this.edit_item = null;

        this.settings = Convenience.getSettings();

        this._icon_on = new St.Icon ({
            gicon:Gio.icon_new_for_string (EXTENSIONDIR + "/data/icons/obmin-on.png"),
            style: 'icon-size: 22px;'
        });
        this._icon_off = new St.Icon ({
            gicon:Gio.icon_new_for_string (EXTENSIONDIR + "/data/icons/obmin-off.png"),
            style: 'icon-size: 22px;'
        });
        this._icon_run = new St.Icon ({
            gicon:Gio.icon_new_for_string (EXTENSIONDIR + "/data/icons/obmin-run.png"),
            style: 'icon-size: 22px;'
        });
        this.statusIcon = new St.Icon ({ style: 'icon-size: 20px;' });
        this.icon_off ();
        let _box = new St.BoxLayout();
        _box.add_actor(this.statusIcon);
        this.add_actor (_box);

        https = this.settings.get_boolean (HTTPS_KEY);
        startup = this.settings.get_boolean (STARTUP_KEY);
        support = this.settings.get_int (SUPPORT_KEY);
        port = this.settings.get_int (PORT_KEY);
        DEBUG = this.settings.get_int (DEBUG_KEY);

        server = this.server_enabled;
        if (startup && !server) this._enable (true);
        this._build_ui ();
        this.menu.actor.add_style_class_name ('obmin-menu');

        stats_monitor = this.settings.get_boolean (STATS_MONITOR_KEY);
        if (server) {
            this.update_stats ();
        }

        this.menu.connect ('open-state-changed', this.on_menu_state_changed.bind (this));

        this.dbus = Gio.bus_get_sync (Gio.BusType.SESSION, null);
        if (stats_monitor && this.dbus)
            this.dbus.call ('org.freedesktop.DBus', '/', "org.freedesktop.DBus", "AddMatch",
                GLib.Variant.new ('(s)', ["type=\'signal\'"]), null, Gio.DBusCallFlags.NONE, -1, null, () => {
                    this._signalCC = this.dbus.signal_subscribe(null, "org.konkor.obmin.server", "CounterChanged",
                    '/org/konkor/obmin/server', null, Gio.DBusSignalFlags.NO_MATCH_RULE, this.on_counter_changed.bind (this));
            });
    }

    on_counter_changed (conn, sender, object, iface, signal, param, user_data) {
        //print ('on_counter_changed', param.get_child_value(0).get_string()[0]);
        stats = JSON.parse (param.get_child_value(0).get_string()[0]);
        if (this.menu.isOpen) {
            if (update_event) GLib.Source.remove (update_event);
            update_event = GLib.timeout_add (0, 250, this.update_stats.bind (this));
        } else this.update_icon ();
    }

    check_status () {
        let run = this.server_enabled;
        if (run != server) {
            server = run;
            this.server_switch.setToggleState (server);
            if (server) this.update_icon ();
            else this.icon_off ();
        }
    }

    update_stats () {
        if (update_event) {
            GLib.Source.remove (update_event);
            update_event = 0;
        }
        if (stats.access && (stats.access >= 0)) {
            if ((stats.access - stats.ready) > 0)
                this.connections.set_text ((stats.access - stats.ready).toString());
            else this.connections.set_text ('');
            if (stats.access > 0) this.requests.set_text (stats.access.toString());
            else this.requests.set_text ('');
            if (stats.upload > 0) this.uploads.set_text (GLib.format_size (stats.upload));
            else this.uploads.set_text ('');
            this.separator.content.actor.visible =
                (stats.access - stats.ready) > 0 || stats.access > 0 || stats.upload > 0;
        }
        if (server) this.update_icon ();
        else this.icon_off ();
        return false;
    }

    update_icon () {
        if ((stats.access - stats.ready) > 0) this.icon_run ();
        else this.icon_on ();
    }

    on_menu_state_changed (source, state) {
        if (state) {
            this.check_status ();
            port = this.settings.get_int (PORT_KEY);
            this.info_local.update ();
            this.info_public.update ();
            this.update_stats ();
        } /* else {
            Clutter.ungrab_keyboard ();
        }*/
    }

    icon_on () { this.statusIcon.gicon = this._icon_on.gicon; }

    icon_off () { this.statusIcon.gicon = this._icon_off.gicon; }

    icon_run () { this.statusIcon.gicon = this._icon_run.gicon; }

    _build_ui () {
        this.menu.removeAll ();
        this.server_switch = new PopupMenu.PopupSwitchMenuItem (_("Obmin Server "), server);
        this.server_switch.connect ('toggled', (item) => {
            this._enable (item.state);
        });
        this.menu.addMenuItem (this.server_switch);
        this.info_local = new LocalItem ();
        this.menu.addMenuItem (this.info_local.content);
        this.info_public = new PublicItem ();
        this.menu.addMenuItem (this.info_public.content);
        this.separator = new InfoMenuItem (_("Usage Statistics"), " ", false, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.separator.content);
        this.separator.content.actor.visible = false;
        this.connections = new InfoMenuItem (_("Active"), "", true, 'obmin-active', 'obmin-active');
        this.menu.addMenuItem (this.connections.content);
        this.requests = new InfoMenuItem (_("Total Requests"), "", true, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.requests.content);
        this.uploads = new InfoMenuItem (_("Transferred"), "", true, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.uploads.content);
        //Preferences
        this.menu.addMenuItem (new SeparatorItem ().content);
        let sm = new PrefsMenuItem ();
        this.menu.addMenuItem (sm.content);

        this.connections.content.connect ('activate', ()=>{GLib.spawn_command_line_async (EXTENSIONDIR + '/obmin-center');});
        this.requests.content.connect ('activate', ()=>{GLib.spawn_command_line_async (EXTENSIONDIR + '/obmin-center');});
        this.uploads.content.connect ('activate', ()=>{GLib.spawn_command_line_async (EXTENSIONDIR + '/obmin-center');});
    }

    _enable (state) {
        server = state;
        if (state) {
            if (GLib.spawn_command_line_async (EXTENSIONDIR + "/obmin-server")) {
                this.icon_on ();
            } else {
                server = false;
                this.icon_off ();
                this.server_switch.setToggleState (false);
            }
        } else {
            GLib.spawn_command_line_async ("killall obmin-server");
            this.icon_off ();
        }
    }

    get server_enabled () {
        let res = GLib.spawn_command_line_sync ("ps -A");
        let o, n;
        if (res[0]) o = Convenience.byteArrayToString (res[1]).split("\n");
        for (let i = 0; i < o.length; i++) {
            if (o[i].indexOf ("obmin-server") > -1) {
                n = parseInt (o[i].trim().split(" ")[0]);
                if (Number.isInteger(n) && n > 0) return n;
            }
        }
        return 0;
    }

    remove_events () {
        if (update_event) GLib.Source.remove (update_event);
        update_event = 0;
        if (this.dbus && this._signalCC) this.dbus.signal_unsubscribe (this._signalCC);
        this._signalCC = 0;
    }
});

const PrefsMenuItem = GObject.registerClass (class PrefsMenuItem extends GObject.Object {

    _init () {
        super._init ();
        this.content = new PopupMenu.PopupBaseMenuItem ({ reactive: false, can_focus: false});
        let l = new St.Label ({text: ' '});
        l.x_expand = true;
        this.content.actor.add (l);
        this.preferences = new St.Button ({ child: new St.Icon ({ icon_name: 'preferences-system-symbolic' }), style_class: 'system-menu-action'});
        this.content.actor.add (this.preferences);
        this.preferences.connect ('clicked', () => {
            GLib.spawn_command_line_async (EXTENSIONDIR + '/obmin-center');
            this.content.emit ('activate');
        });
        l = new St.Label ({text: ' '});
        l.x_expand = true;
        this.content.actor.add (l);
        //this.about = new St.Button ({ label: '?', style_class: 'prefs-button'});
        this.about = new St.Button ({ child: new St.Icon ({ icon_name: 'dialog-question-symbolic' }), style_class: 'system-menu-action'});
        this.content.actor.add (this.about);
        this.about.connect ('clicked', () => {
            GLib.spawn_command_line_async ("gedit --new-window " + EXTENSIONDIR + "/README.md");
            this.content.emit ('activate');
        });
        l = new St.Label ({text: ' '});
        l.x_expand = true;
        this.content.actor.add (l);
    }
});

const InfoMenuItem  = GObject.registerClass (class InfoMenuItem extends GObject.Object {

    _init (label, info, reactive, style, style_info) {
        super._init ();
        this.content = new PopupMenu.PopupMenuItem (label, {reactive: reactive, style_class: style?style:'obmin-info-item'});
        this.content.label.x_expand = true;
        this.info = new St.Label ({text: ' ', style_class: style_info?style_info:"", reactive:true, can_focus: true, track_hover: true });
        this.info.align = St.Align.END;
        this.content.actor.add_child (this.info);
        this.info.connect ('notify::text', () => {
            this.content.actor.visible = this.info.text.length > 0;
        });
        this.set_text (info);
    }

    set_text (text) {
        this.info.set_text (text);
    }
});

const LocalItem = GObject.registerClass (class LocalItem extends GObject.Object {

    _init () {
        this.content = new PopupMenu.PopupSubMenuMenuItem (_("Local IP Address"), false);
        this.info = new St.Label ({text: ' ', reactive:true, can_focus: true, track_hover: true });
        this.info.align = St.Align.END;
        this.content.actor.add_child (this.info);
        this.update_ips ();
    }

    update_ips () {
        let l = Convenience.get_ip_addresses ();
        this.content.menu.removeAll ();
        l.forEach ((s) => {
            let item = new PopupMenu.PopupMenuItem (s + ":" + port);
            this.content.menu.addMenuItem (item);
            item.connect ('activate', (o) => {
                var scheme = "http://";
                if (https) scheme = "https://";
                Clipboard.set_text (CLIPBOARD_TYPE, scheme + o.label.text);
                show_notify (_("Local IP address copied to clipboard."));
            });
        });
        this.info.set_text (l[0]);
    }

    update () {
        this.update_ips ();
    }
});

const PublicItem = GObject.registerClass (class PublicItem extends InfoMenuItem {

    _init () {
        super._init (_("Public IP Address"), "", true, 'obmin-ip-item', 'obmin-ip-label');
        this._ip = "";
        this.content.activate = this.activate.bind (this);
    }

    activate (event) {
        var scheme = "http://";
        if (https) scheme = "https://";
        Clipboard.set_text (CLIPBOARD_TYPE, scheme + this.info.text);
        show_notify (_("Public IP address copied to clipboard."));
        this.content.emit ('activate', event);
    }

    update () {
        Convenience.fetch ("http://ipecho.net/plain", null, null, (text, s) => {
            if ((s == 200) && text) {
                this._ip = Convenience.byteArrayToString(text).split("\n")[0];
                if (!this._ip || this._ip.length < 7) this._ip = "";
            } else this._ip = "";
            this.set_text (this._ip);
            return false;
        });
    }
});

const SeparatorItem = GObject.registerClass (class SeparatorItem extends GObject.Object {

    _init () {
        this.content = new PopupMenu.PopupBaseMenuItem ({
          reactive: false, can_focus: false, style_class: 'obmin-separator-item'
        });
        this._separator = new St.Widget ({
          style_class: 'obmin-separator-menu-item', y_expand: true,
          y_align: Clutter.ActorAlign.CENTER
        });
        //this.content.actor.add (this._separator, {expand: true});
        this.content.actor.add (this._separator);
    }
});

function info (msg) {
    if (DEBUG > 0) print ("[obmin] " + msg);
}

function debug (msg) {
    if (DEBUG > 1) print ("[obmin] " + msg);
}

function error (msg) {
    print ("[obmin] (EE) " + msg);
}

let cmd_out, info_out;
function get_info_string (cmd) {
    cmd_out = GLib.spawn_command_line_sync (cmd);
    if (cmd_out[0]) info_out = cmd_out[1].toString().split("\n")[0];
    if (info_out) return info_out;
    return "";
}

let text, notify_event = 0;
function show_notify (message, style) {
    text = new St.Label ({text: message, style_class: style?style:'notify-label'});
    text.opacity = 255;
    Main.uiGroup.add_actor (text);

    text.set_position (Math.floor (Main.layoutManager.primaryMonitor.width / 2 - text.width / 2),
        Math.floor (Main.layoutManager.primaryMonitor.height / 2 - text.height / 2));

    notify_event = GLib.timeout_add (0, 1000, () => {
        Main.uiGroup.remove_actor (text);
        notify_event = 0;
    });
}

function remove_notify () {
    if (notify_event) GLib.Source.remove (notify_event);
    notify_event = 0;
    if (text) Main.uiGroup.remove_actor (text);
};

let obmin_menu;
function init () {
    Convenience.initTranslations ();
}

function enable () {
    obmin_menu = new ObminIndicator;
    Main.panel.addToStatusArea ('obmin-indicator', obmin_menu);
}

function disable () {
    obmin_menu.remove_events ();
    remove_notify ();
    obmin_menu.destroy ();
    obmin_menu = null;
}
