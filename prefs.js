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

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const STARTUP_KEY = 'startup-settings';
const LINKS_KEY = 'links-settings';
const MOUNTS_KEY = 'mounts-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const PORT_KEY = 'port';

const DEBUG = true;

const Gettext = imports.gettext.domain('gnome-shell-extensions-obmin');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension ();
const EXTENSIONDIR = Me.dir.get_path ();
const Convenience = Me.imports.convenience;

let startup = false;
let links = true;
let mounts = true;
let hiddens = false;
let backups = false;
let port = 8088;

let settings = null;
let sources = [];

const ObminWidget = new Lang.Class({
    Name: 'ObminWidget',

    _init: function (params) {
        this.parent (0.0, "Obmin Widget", false);

        startup = settings.get_boolean (STARTUP_KEY);
        port = settings.get_int (PORT_KEY);
        links = settings.get_boolean (LINKS_KEY);
        mounts = settings.get_boolean (MOUNTS_KEY);
        hiddens = settings.get_boolean (HIDDENS_KEY);
        backups = settings.get_boolean (BACKUPS_KEY);
        let srcs =  settings.get_string (SOURCES_KEY);
        if (srcs.length > 0) sources = JSON.parse (srcs);

        this.notebook = new Gtk.Notebook ({expand:true});

        this.general = new PageGeneral ();
        this.notebook.add (this.general);
        let label = new Gtk.Label ({label: _("General")});
        this.notebook.set_tab_label (this.general, label);

        this.display = new PageDisplay ();
        this.notebook.add (this.display);
        label = new Gtk.Label ({label: _("Display")});
        this.notebook.set_tab_label (this.display, label);

        this.notebook.show_all ();
    }
});

const PageGeneral = new Lang.Class({
    Name: 'PageGeneral',
    Extends: Gtk.ScrolledWindow,

    _init: function () {
        this.parent ();
        this.box = new Gtk.Box ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        this.box.border_width = 6;
        this.add (this.box);

        this.cb_startup = Gtk.CheckButton.new_with_label (_("Load on startup"));
        this.box.add (this.cb_startup);
        this.cb_startup.active = startup;
        this.cb_startup.connect ('toggled', Lang.bind (this, ()=>{
            startup = this.cb_startup.active;
            settings.set_boolean (STARTUP_KEY, startup);
        }));

        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.box.pack_start (hbox, false, false, 0);
        let label = new Gtk.Label ({label: _("Listening Port")});
        hbox.add (label);
        this.port = Gtk.SpinButton.new_with_range (1, 65535, 1);
        this.port.value = port;
        this.port.connect ('value_changed', Lang.bind (this, ()=>{
            port = this.port.value;
            settings.set_int (PORT_KEY, port);
        }));
        hbox.pack_end (this.port, false, false, 0);

        this.show_all ();
    }
});

const PageDisplay = new Lang.Class({
    Name: 'PageDisplay',
    Extends: Gtk.ScrolledWindow,

    _init: function () {
        this.parent ();
        this.box = new Gtk.Box ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        this.box.border_width = 6;
        this.add (this.box);

        this.mounts = Gtk.CheckButton.new_with_label (_("Show mount points"));
        this.box.add (this.mounts);
        this.mounts.active = mounts;
        this.mounts.connect ('toggled', Lang.bind (this, ()=>{
            mounts = this.mounts.active;
            settings.set_boolean (MOUNTS_KEY, mounts);
        }));

        this.links = Gtk.CheckButton.new_with_label (_("Show symbolic links"));
        this.box.add (this.links);
        this.links.active = links;
        this.links.connect ('toggled', Lang.bind (this, ()=>{
            links = this.links.active;
            settings.set_boolean (LINKS_KEY, links);
        }));

        this.hiddens = Gtk.CheckButton.new_with_label (_("Show hidden content"));
        this.box.add (this.hiddens);
        this.hiddens.active = hiddens;
        this.hiddens.connect ('toggled', Lang.bind (this, ()=>{
            hiddens = this.hiddens.active;
            settings.set_boolean (HIDDENS_KEY, hiddens);
        }));

        this.backups = Gtk.CheckButton.new_with_label (_("Show backups"));
        this.box.add (this.backups);
        this.backups.active = backups;
        this.backups.connect ('toggled', Lang.bind (this, ()=>{
            backups = this.backups.active;
            settings.set_boolean (BACKUPS_KEY, backups);
        }));

        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.box.pack_start (hbox, false, false, 0);


        this.show_all ();
    }
});

function debug (msg) {
    if (DEBUG) print ("[obmin prefs] " + msg);
}

function init() {
    Convenience.initTranslations ();
    settings = Convenience.getSettings ();
}

function buildPrefsWidget() {
    let widget = new ObminWidget ();
    return widget.notebook;
}
