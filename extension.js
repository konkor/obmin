const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
//const Mainloop = imports.mainloop;

const DEBUG = true;
const SAVE_SETTINGS_KEY = 'save-settings';
const ENABLED_KEY = 'enabled';
const LINKS_KEY = 'links-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const PORT_KEY = 'port';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension ();
const EXTENSIONDIR = Me.dir.get_path ();
const Convenience = Me.imports.convenience;

let save = false;
let follow_links = true;
let check_hidden = false;
let check_backup = false;
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
        //this.actor.add_child (this._icon, { align: St.Align.END });
        this.statusIcon.icon_name = 'obmin-symbolic';
        //this.statusLabel = new St.Label ({text: "OFF", y_expand: true, y_align: Clutter.ActorAlign.CENTER});
        let _box = new St.BoxLayout();
        _box.add_actor(this.statusIcon);
        //_box.add_actor(this.statusLabel);
        this.actor.add_actor (_box);

        save = this.settings.get_boolean (SAVE_SETTINGS_KEY);
        follow_links = this.settings.get_boolean (LINKS_KEY);
        check_hidden = this.settings.get_boolean (HIDDENS_KEY);
        check_backup = this.settings.get_boolean (BACKUPS_KEY);
        let srcs =  this.settings.get_string (SOURCES_KEY);
        if (srcs.length > 0) sources = JSON.parse (srcs);
        if (server = this.server_enabled) this.statusIcon.icon_name = 'obmin-on-symbolic';
        this._build_ui ();
        
        this.menu.actor.add_style_class_name('obmin-menu');
        this.menu.connect ('open-state-changed', Lang.bind (this, this._on_menu_state_changed));
    },

    _on_menu_state_changed: function (source, state) {
        Clutter.ungrab_keyboard ();
    },

    _build_ui: function () {
        this._build_popup ();
    },

    _build_popup: function () {
        this.menu.removeAll ();
        this.info = new InfoItem ();
        this.menu.addMenuItem (this.info);
        this.server_switch = new PopupMenu.PopupSwitchMenuItem('File Server ', server);
        this.server_switch.connect ('toggled', Lang.bind (this, function (item) {
            this._enable (item.state);
        }));
        this.menu.addMenuItem (this.server_switch);
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
        this.menu.addMenuItem (new PopupMenu.PopupSeparatorMenuItem ());
        let sm = new PopupMenu.PopupSubMenuMenuItem ('Preferences', false);
        this.menu.addMenuItem (sm);
        let save_switch = new PopupMenu.PopupSwitchMenuItem ('Load on startup', save);
        sm.menu.addMenuItem (save_switch);
        save_switch.connect ('toggled', Lang.bind (this, function (item) {
            save = item.state;
            this.settings.set_boolean (SAVE_SETTINGS_KEY, item.state);
        }));
        sm.menu.addMenuItem (new PopupMenu.PopupSeparatorMenuItem ());
        let links_switch = new PrefsMenuItem ('Show symbolic links', follow_links);
        sm.menu.addMenuItem (links_switch);
        links_switch.connect ('toggled', Lang.bind (this, function (item) {
            this.settings.set_boolean (LINKS_KEY, follow_links = item.state);
            debug ('toggled ' + item.state);
        }));
        let hidden_switch = new PrefsMenuItem ('Show hidden locations', check_hidden);
        sm.menu.addMenuItem (hidden_switch);
        hidden_switch.connect ('toggled', Lang.bind (this, function (item) {
            this.settings.set_boolean (HIDDENS_KEY, check_hidden = item.state);
        }));
        let backup_switch = new PrefsMenuItem ('Show backups', check_backup);
        sm.menu.addMenuItem (backup_switch);
        backup_switch.connect ('toggled', Lang.bind (this, function (item) {
            this.settings.set_boolean (BACKUPS_KEY, check_backup = item.state);
        }));
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
        //if (event != 0) Mainloop.source_remove (event);
        //event = 0;
        //this._enable (false);
        //server = null;
    }
});

const PrefsMenuItem = new Lang.Class({
    Name: 'PrefsMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    _init: function(text, active, params) {
        this.parent(text, params);
        this.label.x_expand = true;
        let container = new St.BoxLayout();
        this.check_box = new St.Button({ style_class: 'check-box',
                                     child: container,
                                     button_mask: St.ButtonMask.ONE,
                                     toggle_mode: true,
                                     can_focus: true,
                                     x_fill: true,
                                     y_fill: true });
        this.state = this.check_box.checked = active;
        this._box = new St.Bin();
        this._box.set_y_align(Clutter.ActorAlign.START);
        container.add_actor(this._box);
        this.actor.add_child (this.check_box);
        this.check_box.connect ('clicked', Lang.bind (this, function (item) {
            this.state = this.check_box.checked;
            this.emit ('toggled');
        }));
    },

    toggle: function (event) {
        this.state = this.check_box.checked = !this.check_box.checked;
        this.emit ('toggled');
    },

    activate: function (event) {
        this.toggle ();
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
        //this._box.set_y_align(Clutter.ActorAlign.START);
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
        //if (!this.edit_mode) this.emit ('activate', event);
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

const InfoItem = new Lang.Class({
    Name: 'InfoItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (params) {
        this.parent ({ reactive: false, can_focus: false });
        this._icon = new St.Label ({text: "☺", style: 'color: #33d552; font-weight: bold; font-size: 56pt;'});
        this._icon.y_expand = true;
        this._icon.y_align = Clutter.ActorAlign.CENTER;
        this.actor.add_child (this._icon);
        this._icon.visible = false;
        this.vbox = new St.BoxLayout({ vertical: true, style: 'padding: 0px; spacing: 4px;' });
        this.actor.add_child (this.vbox, { align: St.Align.END });
        /*this._host = new St.Label ({text: this.hostname, style: 'font-weight: bold;'});
        this.vbox.add_child (this._host, {align:St.Align.START});*/
        this._ip = new St.Label ({text: this.ip + ":" + port, style: 'color: white; font-weight: bold;'});
        this.vbox.add_child (this._ip, {align:St.Align.START});
        this._warn = new St.Label ({text: "☺ 😐 ☹ WARN MESSAGE", style: 'color: orange; font-weight: bold;'});
        this.vbox.add_child (this._warn, {align:St.Align.START});
        this._warn.visible = false;
    },

    get hostname () {
        return get_info_string ("hostname");
    },

    get ip () {
        return get_info_string ("hostname -I");
    },

    update: function (governors) {
        this._load.text = this.loadavg;
        /*if (governors) {
            this._cores.visible = true;
            this._cores.text = governors;
        } else this._cores.visible = false;*/
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
    //if (server) server.destroy ();
    //server = null;
}
