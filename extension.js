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
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Separator = imports.ui.separator;
const Util = imports.misc.util;
const Lang = imports.lang;
//const Mainloop = imports.mainloop;

const DEBUG = true;
const STARTUP_KEY = 'startup-settings';
const SOURCES_KEY = 'content-sources';
const PORT_KEY = 'port';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension ();
const EXTENSIONDIR = Me.dir.get_path ();
const Convenience = Me.imports.convenience;

let startup = false;
let port = 8088;

let server = false;
let sources = [];

const ObminIndicator = new Lang.Class({
    Name: 'ObminIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent (0.0, "Obmin Indicator", false);
        this.edit_item = null;

        this.settings = Convenience.getSettings();

        this.statusIcon = new St.Icon ({ style: 'icon-size: 20px;' });
        this.statusIcon.icon_name = 'obmin-symbolic';
        let _box = new St.BoxLayout();
        _box.add_actor(this.statusIcon);
        this.actor.add_actor (_box);

        startup = this.settings.get_boolean (STARTUP_KEY);
        port = this.settings.get_int (PORT_KEY);
        let srcs =  this.settings.get_string (SOURCES_KEY);
        if (srcs.length > 0) sources = JSON.parse (srcs);
        else sources.push ({path: GLib.get_home_dir (), recursive: true});

        if (server = this.server_enabled) this.statusIcon.icon_name = 'obmin-on-symbolic';
        if (startup && !server) this._enable (true);
        this._build_ui ();
        this.menu.actor.add_style_class_name ('obmin-menu');

        this.menu.connect ('open-state-changed', Lang.bind (this, this.on_menu_state_changed));
    },

    on_menu_state_changed: function (source, state) {
        Clutter.ungrab_keyboard ();
    },

    _build_ui: function () {
        this._build_popup ();
    },

    _build_popup: function () {
        this.menu.removeAll ();
        this.server_switch = new PopupMenu.PopupSwitchMenuItem ('File Server ', server);
        this.server_switch.connect ('toggled', Lang.bind (this, function (item) {
            this._enable (item.state);
        }));
        this.menu.addMenuItem (this.server_switch);
        this.info_local = new LocalItem ();
        this.menu.addMenuItem (this.info_local);
        this.info_public = new PublicItem ();
        this.menu.addMenuItem (this.info_public);
        //this.menu.addMenuItem (new SeparatorItem ());
        //Locations
        this.smenu = new PopupMenu.PopupSubMenuMenuItem ("Locations", false);
        this.menu.addMenuItem (this.smenu);
        let newItem = new NewMenuItem ("New Location...", "", "Path", true);
        this.smenu.menu.addMenuItem (newItem);
        newItem.connect ('save', Lang.bind (this, function () {
            let exist = false;
            sources.forEach (s => {if (s.path == newItem.entry.text) exist = true;});
            if (!exist) {
                sources.push ({path: newItem.entry.text, recursive: newItem.state});
                this._add_source (sources.length -1);
                this.settings.set_string (SOURCES_KEY, JSON.stringify (sources));
            }
        }));
        for (let p in sources) {
            this._add_source (p);
        }
        //Preferences
        this.menu.addMenuItem (new SeparatorItem ());
        let sm = new PrefsMenuItem ();
        this.menu.addMenuItem (sm);

    },

    _add_source: function (idx) {
        let si = new SourceMenuItem (sources[idx]);
        si.ID = idx;
        this.smenu.menu.addMenuItem (si);
        si.connect ('edit', Lang.bind (this, function (o) {
            if (this.edit_item && this.edit_item.edit_mode && this.edit_item.ID != o.ID) this.edit_item.toggle ();
            this.edit_item = o;
        }));
        si.connect ('update', Lang.bind (this, function (o) {
            sources[o.ID] = {path: o.entry.text, recursive: o.state};
            this.settings.set_string (SOURCES_KEY, JSON.stringify (sources));
        }));
        si.connect ('toggled', Lang.bind (this, function (o) {
            sources[o.ID] = {path: sources[o.ID].path, recursive: o.state};
            this.settings.set_string (SOURCES_KEY, JSON.stringify (sources));
            debug ('toggled recursive');
        }));
        si.connect ('delete', Lang.bind (this, function (o) {
            let id = o.ID;
            sources.splice (o.ID, 1);
            this.settings.set_string (SOURCES_KEY, JSON.stringify (sources));
            o.destroy ();
            let items = this.smenu.menu.box.get_children ().map (function(actor) {return actor._delegate;});
            id++;
            for (let key = id; key < items.length; key++){
                let item = items[key];
                item.ID -= 1;
            }
        }));
    },

    _enable: function (state) {
        server = state;
        if (state) {
            if (GLib.spawn_command_line_async (EXTENSIONDIR + "/obminserver.js")) {
                //this.statusLabel.text = "ON";
                this.statusIcon.icon_name = 'obmin-on-symbolic';
            } else {
                server = false;
                this.statusIcon.icon_name = 'obmin-symbolic';
                this.server_switch.setToggleState (false);
            }
        } else {
            GLib.spawn_command_line_async ("killall obminserver.js");
            //this.statusLabel.text = "OFF";
            this.statusIcon.icon_name = 'obmin-symbolic';
        }
    },

    get server_enabled () {
        let res = GLib.spawn_command_line_sync ("ps -A");
        let o;
        if (res[0]) o = res[1].toString().split("\n");
        for (let i = 0; i < o.length; i++) {
            if (o[i].indexOf ("obminserver.js") > -1) return true;
        }
        return false;
    },

    remove_events: function () {
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
        }));
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
        //this.about = new St.Button ({ label: '?', style_class: 'prefs-button'});
        this.about = new St.Button ({ child: new St.Icon ({ icon_name: 'dialog-question-symbolic' }), style_class: 'system-menu-action'});
        this.actor.add (this.about, { expand: false });
        this.about.connect ('clicked', Lang.bind (this, function () {
            GLib.spawn_command_line_async ("gedit --new-window " + EXTENSIONDIR + "/README.md");
        }));
        this.actor.add (new St.Label ({text: ' '}), { expand: true });
    }
});

const NewMenuItem = new Lang.Class ({
    Name: 'NewMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    _init: function (text, text_entry, hint_text, recursive, params) {
        this.parent (text, params);
        this.entry = new St.Entry ({ text:text_entry, hint_text:hint_text, style_class: 'obmin-entry', track_hover: true, can_focus: true, x_expand: true });
        this.actor.add_child (this.entry);
        this.entry.set_primary_icon (new St.Icon({ style_class: 'obmin-entry-icon', icon_name: 'emblem-ok-symbolic', icon_size: 14 }));
        this.entry.connect ('primary-icon-clicked', Lang.bind(this, function () {
            this.on_click ();
        }));
        this.entry.connect ('secondary-icon-clicked', Lang.bind(this, function () {
            this.on_click ();
        }));
        this.entry.clutter_text.connect('key-press-event', Lang.bind (this, function (o, event) {
            let symbol = event.get_key_symbol();
            if (symbol == Clutter.Escape) {
                this.toggle ();
                return Clutter.EVENT_STOP;
            } else if (symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
                this.on_click ();
                this.toggle ();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }));
        this.entry.clutter_text.connect('key-focus-in', Lang.bind (this, function () {
            Clutter.grab_keyboard (this.entry.clutter_text);
        }));
        this.entry.visible = false;
        this.context = new St.Label({text: "Recursive", y_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child (this.context);
        this.context.visible = false;
        let container = new St.BoxLayout();
        this.check_box = new St.Button({ style_class: 'check-box',
                                     child: container,
                                     button_mask: St.ButtonMask.ONE,
                                     toggle_mode: true,
                                     can_focus: true,
                                     x_fill: true,
                                     y_fill: true });
        this.state = this.check_box.checked = recursive;
        this._box = new St.Bin();
        container.add_actor(this._box);
        this.actor.add_child (this.check_box);
        this.check_box.visible = false;
        this.check_box.connect ('notify::hover', Lang.bind(this, function () {
            if (this.check_box.hover) this.context.visible = true;
            else this.context.visible = false;
        }));
        this.check_box.connect ('clicked', Lang.bind (this, function (item) {
            this.state = this.check_box.checked;
            this.emit ('toggled');
        }));
    },

    activate: function (event) {
        if (this.entry.text != '') this.toggle ();
    },

    toggle: function () {
        this.label.visible = !this.label.visible;
        this.entry.visible = !this.entry.visible;
        this.check_box.visible = !this.check_box.visible;
        if (this.entry.visible) Clutter.grab_keyboard (this.entry.clutter_text);
        else Clutter.ungrab_keyboard ();
    },

    on_click: function () {
        this.emit ('save');
    }
});

const SourceMenuItem = new Lang.Class ({
    Name: 'SourceMenuItem',
    Extends: NewMenuItem,

    _init: function (src, params) {
        this.parent (src.path, src.path, "", src.recursive, params);
        this.path = src.path;
        this.label.x_expand = true;
        this.edit_mode = false;
        this.edit_button = new St.Button ({ child: new St.Icon ({ icon_name: 'open-menu-symbolic', icon_size: 14 }), style_class: 'edit-button'});
        this.actor.add_child (this.edit_button);
        this.edit_button.connect ('clicked', Lang.bind (this, function () {
            this.toggle ();
            Clutter.grab_keyboard (this.entry.clutter_text);
            global.stage.set_key_focus (this.entry.clutter_text);
            if (this.entry.text == '') this.entry.text = this.path;
            this.emit ('edit');
        }));
        this.delete_button = new St.Button ({ child: new St.Icon ({ icon_name: 'edit-delete-symbolic', icon_size: 14 }), style_class: 'delete-button'});
        this.actor.add_child (this.delete_button);
        this.delete_button.connect ('clicked', Lang.bind (this, function () {
            this.emit ('delete');
        }));
    },

    activate: function (event) {
        if (this.entry.text == '') this.entry.text = this.path;
        if (this.entry.visible) this.toggle ();
    },

    toggle: function () {
        this.parent ();
        this.edit_button.visible = !this.edit_button.visible;
        this.delete_button.visible = !this.delete_button.visible;
        this.edit_mode = this.entry.visible;
    },

    on_click: function () {
        if (this.entry.text != '') {
            this.label.text = this.entry.text;
            this.emit ('update');
        }
    }
});

const InfoMenuItem = new Lang.Class ({
    Name: 'InfoMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    _init: function (label, info, reactive) {
        this.parent (label, {reactive: reactive, style_class: 'obmin-info-item'});
        this.label.x_expand = true;
        this.info = new St.Label ({text: ' '});
        this.actor.add_child (this.info, {align:St.Align.END});
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
        this.parent ("Local IP", this.ip, false);
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
        this.parent ("Public IP", this.ip, false);
    },

    get ip () {
        let l = get_info_string ("dig +short myip.opendns.com @resolver1.opendns.com");
        if (l.length > 6) return l;
        return "";
    },

    update: function () {
        this.set_text (this.ip);
    }
});

const SeparatorItem = new Lang.Class({
    Name: 'SeparatorItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent({ reactive: false, style_class: 'separator-item', can_focus: false});
        this._separator = new Separator.HorizontalSeparator ({ style_class: 'cpufreq-separator-menu-item' });
        this.actor.add (this._separator.actor, { expand: true });
    }
});

let obmin_menu;

function debug (msg) {
    if (DEBUG) print ("[obmin] " + msg);
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

function init () {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path (EXTENSIONDIR + "/data/icons");
    obmin_menu = new ObminIndicator;
    Main.panel.addToStatusArea ('obmin-indicator', obmin_menu);
}

function enable () {
}

function disable () {
    //obmin_menu.remove_events ();
    //obmin_menu.destroy ();
    //obmin_menu = null;
}
