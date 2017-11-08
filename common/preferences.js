/*
 * Obmin - Simple File Sharing Server For GNU/Linux Desktop
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

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const APPDIR = get_appdir ();
imports.searchPath.unshift(APPDIR);
const Prefs = imports.prefs;

var Preferences = new Lang.Class ({
    Name: 'Preferences',

    _init: function () {
        this.application = new Gtk.Application ();
        GLib.set_application_name ("OBMIN Preferences");
        GLib.set_prgname ("OBMIN Preferences");
        this.application.connect ('activate', Lang.bind (this, this._onActivate));
        this.application.connect ('startup', Lang.bind (this, this._onStartup));
    },

    _onActivate: function (){
        this._window.show_all ();
    },

    _onStartup: function () {
        this._window = new Gtk.Window ();
        this._window.title = "Obmin Preferences";
        this._window.set_icon_name ('obmin');
        if (!this._window.icon) try {
            this._window.icon = Gtk.Image.new_from_file (APPDIR + "/data/icons/obmin.svg").pixbuf;
        } catch (e) {
            error (e.message);
        }
        this._window.set_default_size (640, 480);
        Prefs.init ();
        this.w = new Prefs.ObminWidget ();
        this._window.add (this.w.notebook);
        this.application.add_window (this._window);
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
    s = "/usr/share/gnome-shell/extensions/obmin@konkor";
    if (GLib.file_test (s + "/prefs.js", GLib.FileTest.EXISTS)) return s;
    throw "Obmin installation not found...";
    return s;
}
