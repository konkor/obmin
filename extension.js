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
 * Filefinder is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;

const STARTUP_KEY = 'startup-settings';
const STATS_MONITOR_KEY = 'stats-monitor';
const STATS_DATA_KEY = 'stats';
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

let startup = false;
let support = 0;
let port = 8088;
let DEBUG = 1;
let status = 5;
let stats_monitor = true;
let stats = {};

let status_event = 0;
let update_event = 0;
let server = false;

const ObminIndicator = new Lang.Class({
    Name: 'ObminIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent (0.0, "Obmin Server Indicator", false);
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
        this.actor.add_actor (_box);

        GLib.spawn_command_line_async ("chmod +x " + EXTENSIONDIR + "/obmin-server")
        startup = this.settings.get_boolean (STARTUP_KEY);
        support = this.settings.get_int (SUPPORT_KEY);
        port = this.settings.get_int (PORT_KEY);
        status = this.settings.get_int (STATUS_KEY);
        DEBUG = this.settings.get_int (DEBUG_KEY);

        server = this.server_enabled;
        if (startup && !server) this._enable (true);
        this._build_ui ();
        this.menu.actor.add_style_class_name ('obmin-menu');

        stats_monitor = this.settings.get_boolean (STATS_MONITOR_KEY);
        if (server) {
            stats = JSON.parse (this.settings.get_string (STATS_DATA_KEY));
            this.update_stats ();
        }

        this.menu.connect ('open-state-changed', Lang.bind (this, this.on_menu_state_changed));
        if (status > 0) status_event = GLib.timeout_add_seconds (0, status, Lang.bind (this, function () {
            this.check_status ();
            return true;
        }));
        if (stats_monitor)
            this.settings.connect ("changed::" + STATS_DATA_KEY, Lang.bind (this, function() {
            stats = JSON.parse (this.settings.get_string (STATS_DATA_KEY));
            if (this.menu.isOpen) {
                if (update_event) GLib.Source.remove (update_event);
                update_event = GLib.timeout_add (0, 250, Lang.bind (this, this.update_stats ));
            } else this.update_icon ();
        }));
    },

    check_status: function () {
        let run = this.server_enabled;
        if (run != server) {
            server = run;
            this.server_switch.setToggleState (server);
            if (server) this.update_icon ();
            else this.icon_off ();
        }
    },

    update_stats: function () {
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
            this.separator.actor.visible =
                (stats.access - stats.ready) > 0 || stats.access > 0 || stats.upload > 0;
        }
        if (server) this.update_icon ();
        else this.icon_off ();
        return false;
    },

    update_icon: function () {
        if ((stats.access - stats.ready) > 0) this.icon_run ();
        else this.icon_on ();
    },

    on_menu_state_changed: function (source, state) {
        if (state) {
            this.check_status ();
            port = this.settings.get_int (PORT_KEY);
            this.info_local.update ();
            this.info_public.update ();
            this.update_stats ();
        } else {
            Clutter.ungrab_keyboard ();
        }
    },

    icon_on: function () { this.statusIcon.gicon = this._icon_on.gicon; },

    icon_off: function () { this.statusIcon.gicon = this._icon_off.gicon; },

    icon_run: function () { this.statusIcon.gicon = this._icon_run.gicon; },

    _build_ui: function () {
        this._build_popup ();
    },

    _build_popup: function () {
        this.menu.removeAll ();
        this.server_switch = new PopupMenu.PopupSwitchMenuItem (_("Obmin Server "), server);
        this.server_switch.connect ('toggled', Lang.bind (this, function (item) {
            this._enable (item.state);
        }));
        this.menu.addMenuItem (this.server_switch);
        this.info_local = new LocalItem ();
        this.menu.addMenuItem (this.info_local);
        this.info_public = new PublicItem ();
        this.menu.addMenuItem (this.info_public);
        this.separator = new InfoMenuItem (_("Usage Statistics"), " ", false, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.separator);
        this.connections = new InfoMenuItem (_("Active"), "", true, 'obmin-active', 'obmin-active');
        this.menu.addMenuItem (this.connections);
        this.requests = new InfoMenuItem (_("Total Requests"), "", true, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.requests);
        this.uploads = new InfoMenuItem (_("Transferred"), "", true, 'obmin-ip-item', 'obmin-ip-label');
        this.menu.addMenuItem (this.uploads);
        //Preferences
        this.menu.addMenuItem (new SeparatorItem ());
        let sm = new PrefsMenuItem ();
        this.menu.addMenuItem (sm);

    },

    _enable: function (state) {
        server = state;
        if (state) {
            if (GLib.spawn_command_line_async (EXTENSIONDIR + "/obmin-server")) {
                //this.statusLabel.text = "ON";
                this.icon_on ();
            } else {
                server = false;
                this.icon_off ();
                this.server_switch.setToggleState (false);
            }
        } else {
            GLib.spawn_command_line_async ("killall obmin-server");
            //this.statusLabel.text = "OFF";
            this.icon_off ();
        }
    },

    get server_enabled () {
        let res = GLib.spawn_command_line_sync ("ps -A");
        let o;
        if (res[0]) o = res[1].toString().split("\n");
        for (let i = 0; i < o.length; i++) {
            if (o[i].indexOf ("obmin-server") > -1) return true;
        }
        return false;
    },

    remove_events: function () {
        if (status_event) GLib.Source.remove (status_event);
        status_event = 0;
        if (update_event) GLib.Source.remove (update_event);
        update_event = 0;
    }
});

const PrefsMenuItem = new Lang.Class({
    Name: 'PrefsMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent ({ reactive: false, can_focus: false});
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
        this.preferences = new St.Button ({ child: new St.Icon ({ icon_name: 'preferences-system-symbolic' }), style_class: 'system-menu-action'});
        this.actor.add (this.preferences, { expand: true, x_fill: false });
        this.preferences.connect ('clicked', Lang.bind (this, function () {
            GLib.spawn_command_line_async ('gnome-shell-extension-prefs ' + Me.uuid);
            this.emit ('activate');
        }));
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
        //this.about = new St.Button ({ label: '?', style_class: 'prefs-button'});
        this.about = new St.Button ({ child: new St.Icon ({ icon_name: 'dialog-question-symbolic' }), style_class: 'system-menu-action'});
        this.actor.add (this.about, { expand: false });
        this.about.connect ('clicked', Lang.bind (this, function () {
            GLib.spawn_command_line_async ("gedit --new-window " + EXTENSIONDIR + "/README.md");
            this.emit ('activate');
        }));
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
        if (support == 0) {
        this.support = new St.Button ({ child: new St.Icon ({
            gicon:Gio.icon_new_for_string (EXTENSIONDIR + "/data/icons/pp.svg"),
            style: 'icon-size: 18px;'
        }), style_class: 'system-menu-action'});
        this.actor.add (this.support, { expand: false, x_fill: false });
        this.support.connect ('clicked', Lang.bind (this, function () {
            let app = Gio.AppInfo.get_default_for_uri_scheme ("https");
            app.launch_uris (["https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WVAS5RXRMYVC4"], null);
            this.emit ('activate');
        }));
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
        }
    }
});

const InfoMenuItem = new Lang.Class ({
    Name: 'InfoMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    _init: function (label, info, reactive, style, style_info) {
        this.parent (label, {reactive: reactive, style_class: style?style:'obmin-info-item'});
        this.label.x_expand = true;
        this.info = new St.Label ({text: ' ', style_class: style_info?style_info:"", reactive:true, can_focus: true, track_hover: true });
        this.info.align = St.Align.END;
        this.actor.add_child (this.info);
        this.info.connect ('notify::text', Lang.bind (this, function () {
            this.actor.visible = this.info.text.length > 0;
        }));
        this.set_text (info);
    },

    set_text: function (text) {
        this.info.set_text (text);
    }
});

const LocalItem = new Lang.Class ({
    Name: 'LocalItem',
    Extends: InfoMenuItem,

    _init: function () {
        this.parent (_("Local IP"), this.ip, true, 'obmin-ip-item', 'obmin-ip-label');
    },

    activate: function (event) {
        Clipboard.set_text (CLIPBOARD_TYPE, "http://" + this.info.text);
        show_notify (_("Local IP address copied to clipboard."));
        this.emit ('activate', event);
    },

    get ip () {
        let l = get_info_string ("hostname -I").split (" ");
        if (l[0]) if (l[0].length > 6) return l[0] + ":" + port;
        return "127.0.0.1:" + port;
    },

    update: function () {
        this.set_text (this.ip);
    }
});

const PublicItem = new Lang.Class ({
    Name: 'PublicItem',
    Extends: InfoMenuItem,

    _init: function () {
        this.parent (_("Public IP"), this.ip, true, 'obmin-ip-item', 'obmin-ip-label');
    },

    activate: function (event) {
        Clipboard.set_text (CLIPBOARD_TYPE, "http://" + this.info.text);
        show_notify (_("Public IP address copied to clipboard."));
        this.emit ('activate', event);
    },

    get ip () {
        let l = "";
        this.curl = GLib.find_program_in_path ('wget');
        if (this.curl) {
            l = get_info_string ("wget -qO- http://ipecho.net/plain");
        } else {
            this.curl = GLib.find_program_in_path ('curl');
            if (this.curl) {
                l = get_info_string ("curl http://ipecho.net/plain");
            }
        }
        return l;
    },

    update: function () {
        this.set_text (this.ip);
    }
});

const SeparatorItem = new Lang.Class({
    Name: 'SeparatorItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent({reactive: false, can_focus: false, style_class: 'obmin-separator-item'});
        this._separator = new St.Widget({ style_class: 'obmin-separator-menu-item',
                                          y_expand: true,
                                          y_align: Clutter.ActorAlign.CENTER });
        this.actor.add(this._separator, {expand: true});
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

function show_notify (message, style) {
    var text = new St.Label ({text: message, style_class: style?style:'notify-label'});
    text.opacity = 255;
    Main.uiGroup.add_actor (text);

    text.set_position (Math.floor (Main.layoutManager.primaryMonitor.width / 2 - text.width / 2),
        Math.floor (Main.layoutManager.primaryMonitor.height / 2 - text.height / 2));

    Tweener.addTween (text, {
        opacity: 196,
        time: 1,
        transition: 'linear',
        onComplete: Lang.bind(this, function () {
            Main.uiGroup.remove_actor (text);
            text = null;
        })
    });
}

function show_warn (message) {
    show_notify (message, "warn-label");
}

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
    obmin_menu.destroy ();
    obmin_menu = null;
}
