const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Separator = imports.ui.separator;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

const SAVE_SETTINGS_KEY = 'save-settings';
const SETTINGS_ID = 'org.gnome.shell.extensions.obmin';
const ExtensionUtils = imports.misc.extensionUtils;
const ExtensionSystem = imports.ui.extensionSystem;
const Me = ExtensionUtils.getCurrentExtension ();
const EXTENSIONDIR = Me.dir.get_path ();
const Convenience = Me.imports.convenience;

const ObminIndicator = new Lang.Class({
    Name: 'Obmin',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent (0.0, "Obmin Indicator", false);

        this._settings = Convenience.getSettings();

        this.statusLabel = new St.Label ({text: "OFF", y_expand: true, y_align: Clutter.ActorAlign.CENTER});
        let _box = new St.BoxLayout();
        _box.add_actor(this.statusLabel);
        this.actor.add_actor(_box);

        save = this._settings.get_boolean (SAVE_SETTINGS_KEY);
        this._build_ui ();

        this.menu.connect ('open-state-changed', Lang.bind (this, this._on_menu_state_changed));
    },

    _on_menu_state_changed: function (source, state) {
    },

    _build_ui: function () {
        this._build_popup ();
    },

    _build_popup: function () {
        this.menu.removeAll ();
        let errorItem = new PopupMenu.PopupMenuItem ("\u26a0 test");
        this.menu.addMenuItem (errorItem);
    },

    remove_events: function () {
        //if (event != 0) Mainloop.source_remove (event);
        //event = 0;
    }
});

let obmin_menu;

function init () {
    //let theme = imports.gi.Gtk.IconTheme.get_default();
    //theme.append_search_path (EXTENSIONDIR + "/icons");
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
