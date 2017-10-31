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
 * Obmin is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const STARTUP_KEY = 'startup-settings';
const LINKS_KEY = 'links-settings';
const MOUNTS_KEY = 'mounts-settings';
const HIDDENS_KEY = 'hidden-settings';
const BACKUPS_KEY = 'backup-settings';
const SOURCES_KEY = 'content-sources';
const MONITOR_KEY = 'stats-monitor';
const JOURNAL_KEY = 'logs';
const SUPPORT_KEY = 'support';
const THEME_GUI_KEY = 'theme-gui';
const THEME_KEY = 'theme';
const MODE_KEY = 'server-mode';
const PORT_KEY = 'port';
const DEBUG_KEY = 'debug';

const Gettext = imports.gettext.domain('gnome-shell-extensions-obmin');
const _ = Gettext.gettext;

const EXTENSIONDIR = getCurrentFile ()[1];
imports.searchPath.unshift (EXTENSIONDIR);
const Convenience = imports.convenience;

let startup = false;
let links = true;
let mounts = true;
let hiddens = false;
let backups = false;
let support = 0;
let theme = '';
let theme_gui = 'default';
let mode = 0;
let port = 8088;
let DEBUG = 1;
let monitor = true;
let journal = true;

let settings = null;
let sources = [];

var ObminWidget = new Lang.Class({
    Name: 'ObminWidget',

    _init: function (params) {
        this.parent (0.0, "Obmin Widget", false);

        DEBUG = settings.get_int (DEBUG_KEY);
        startup = settings.get_boolean (STARTUP_KEY);
        port = settings.get_int (PORT_KEY);
        mode = settings.get_int (MODE_KEY);
        support = settings.get_int (SUPPORT_KEY);
        links = settings.get_boolean (LINKS_KEY);
        mounts = settings.get_boolean (MOUNTS_KEY);
        hiddens = settings.get_boolean (HIDDENS_KEY);
        backups = settings.get_boolean (BACKUPS_KEY);
        monitor = settings.get_boolean (MONITOR_KEY);
        journal = settings.get_boolean (JOURNAL_KEY);
        theme = settings.get_string (THEME_KEY);
        if (theme.length < 1) theme = "default";
        let srcs =  settings.get_string (SOURCES_KEY);
        if (srcs.length > 0) sources = JSON.parse (srcs);
        //Gtk.Settings.get_default().set_property ("gtk-application-prefer-dark-theme", true);
        theme_gui = settings.get_string (THEME_GUI_KEY);

        this.notebook = new Gtk.Notebook ({expand:true});

        this.location = new PageLocation ();
        this.notebook.add (this.location);
        let label = new Gtk.Label ({label: _("Locations")});
        this.notebook.set_tab_label (this.location, label);

        this.general = new PageGeneral ();
        this.notebook.add (this.general);
        label = new Gtk.Label ({label: _("General")});
        this.notebook.set_tab_label (this.general, label);

        this.network = new PageNetwork ();
        this.notebook.add (this.network);
        label = new Gtk.Label ({label: _("Network")});
        this.notebook.set_tab_label (this.network, label);

        this.content = new PageContent ();
        this.notebook.add (this.content);
        label = new Gtk.Label ({label: _("Content")});
        this.notebook.set_tab_label (this.content, label);

        this.notify = new PageNotify ();
        this.notebook.add (this.notify);
        label = new Gtk.Label ({label: _("Notifications")});
        this.notebook.set_tab_label (this.notify, label);

        this.support = new PageSupport ();
        this.notebook.add (this.support);
        label = new Gtk.Label ({label: _("Supporting")});
        this.notebook.set_tab_label (this.support, label);

        this.notebook.show_all ();
    }
});

const PageLocation = new Lang.Class({
    Name: 'PageLocation',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:0, spacing:0});
        this.border_width = 0;

        this.hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:8});
        this.add (this.hbox);
        this.hbox.add (new Gtk.Label ({label:"<b>" + _("Shared Locations Editor") + "</b>", use_markup:true, xalign:0}));
        this.btn  = Gtk.Button.new_from_icon_name ("list-add-symbolic", Gtk.IconSize.BUTTON);
        this.btn.get_style_context ().add_class (Gtk.STYLE_CLASS_SUGGESTED_ACTION);
        this.btn.tooltip_text = _("Add a location to share");
        this.hbox.pack_end (this.btn, false, false, 0);

        this.editor = new LocationEditor ();
        this.editor.expand = true;
        this.scroll = new Gtk.ScrolledWindow ();
        this.scroll.vscrollbar_policy = Gtk.PolicyType.AUTOMATIC;
        this.scroll.shadow_type = Gtk.ShadowType.NONE;
        this.scroll.get_style_context ().add_class ("search-bar");
        this.pack_start (this.scroll, false, true, 0);
        this.scroll.add (this.editor);

        this.btn.connect ('clicked', Lang.bind (this, ()=>{
            this.editor.add_new ();
        }));

        this.show_all ();
    }
});

const LocationEditor = new Lang.Class({
    Name: 'LocationEditor',
    Extends: Gtk.FlowBox,

    _init: function () {
        this.parent ();
        this.homogeneous = false;
        this.get_style_context ().add_class ("search-bar");
        this.margin = 0;
        this.selection_mode = Gtk.SelectionMode.NONE;
        this.max_children_per_line = 1;
        this.valign = Gtk.Align.START;
        this.set_sort_func (this.sort_boxes);
        this.rows = [];
        sources.forEach (s => {
            this.add_row (new LocationItem (this.rows.length, s));
        });
    },

    add_new: function () {
        this.add_row (
            new LocationItem (
                this.rows.length,{path: GLib.get_home_dir(), recursive: true})
        );
        sources.push (this.rows[this.rows.length-1].source);
        settings.set_string (SOURCES_KEY, JSON.stringify (sources));
    },

    add_row: function (item) {
        this.add (item);
        this.rows.push (item);
        item.connect ('closed', Lang.bind (this, this.on_closed));
        item.connect ('changed', Lang.bind (this, this.on_changed));
    },

    on_closed: function (o) {
        o.get_parent().destroy ();
        this.invalidate_sort ();
        let id = o.id;
        sources.splice (id, 1);
        this.rows.splice (id, 1);
        settings.set_string (SOURCES_KEY, JSON.stringify (sources));
        for (let key = id; key < sources.length; key++) {
            this.rows[key].id -=1;
        }
    },

    on_changed: function (o) {
        this.invalidate_sort ();
        sources[o.id] = o.source;
        settings.set_string (SOURCES_KEY, JSON.stringify (sources));
    },

    sort_boxes: function (a, b) {
        var row1 = a.get_child ();
        var row2 = b.get_child ();
        if (row1 == null) return 1;
        if (row2 == null) return -1;
        if (row1.ltype.active == row2.ltype.active) return 0;
        if (row1.ltype.active < row2.ltype.active) return -1;
        return 1;
    }
});

const LocationItem = new Lang.Class({
    Name: 'LocationItem',
    Extends: Gtk.Box,
    Signals: {
        'closed': {},
        'changed': {},
    },

    _init: function (id, src) {
        this.parent ({orientation:Gtk.Orientation.HORIZONTAL, margin:2, spacing:8});
        this.id = id;
        this.margin_right = 4;
        this.source = src;
        this.ltype = new Gtk.ComboBoxText ();
        [_("FOLDER"),_("FILE")].forEach (s => {
            this.ltype.append_text (s);
        });
        debug (src.path + " recursive: " + src.recursive);
        if (GLib.file_test (src.path, GLib.FileTest.IS_DIR))
            this.ltype.active = 0;
        else
            this.ltype.active = 1;
        this.ltype.connect ('changed', Lang.bind (this, ()=>{
            this.create_type_widgets ();
            this.emit ('changed');
        }));
        this.add (this.ltype);
        this.hbox = null;
        this.create_type_widgets ();
        this.btn  = Gtk.Button.new_from_icon_name ("window-close-symbolic",
                                                        Gtk.IconSize.BUTTON);
        this.btn.get_style_context ().add_class (Gtk.STYLE_CLASS_ACCELERATOR);
        this.btn.tooltip_text = _("Remove this location from the sharing");
        this.pack_end (this.btn, false, false, 0);
        this.btn.connect ('clicked', Lang.bind (this, ()=>{
            this.emit ('closed');
        }));
        this.show_all ();
    },

    create_type_widgets: function () {
        if (this.hbox) this.hbox.destroy ();
        this.hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, spacing:8});
        this.pack_start (this.hbox, true, true, 0);
        if (this.ltype.active == 0) this._dir_widget ();
        else this._file_widget ();
        this.hbox.show_all ();
    },

    _dir_widget: function () {
        this.chooser = new Gtk.FileChooserButton ({title: _("Select folder"),
                           action: Gtk.FileChooserAction.SELECT_FOLDER});
        this.chooser.set_current_folder (this.source.path);
        this.chooser.tooltip_text = this.source.path;
        this.hbox.pack_start (this.chooser, true, true, 0);
        this.chooser.connect ('file_set', Lang.bind (this, ()=>{
            this.source.path = this.chooser.get_filename ();
            this.chooser.tooltip_text = this.source.path;
            this.emit ('changed');
        }));
        this.chk_rec = new Gtk.CheckButton ();
        this.chk_rec.tooltip_text = "Recursively";
        this.chk_rec.active = this.source.recursive;
        this.hbox.add (this.chk_rec);
        this.chk_rec.connect ('toggled', Lang.bind (this, ()=>{
            this.source.recursive = this.chk_rec.active;
            this.emit ('changed');
        }));
    },

    _file_widget: function () {
        this.chooser = new Gtk.FileChooserButton ({title:_("Select file"),
                           action:Gtk.FileChooserAction.OPEN});
        this.chooser.set_filename (this.source.path);
        this.chooser.tooltip_text = this.source.path;
        this.hbox.pack_start (this.chooser, true, true, 0);
        this.chooser.connect ('file_set', Lang.bind (this, ()=>{
            this.source.path = this.chooser.get_filename ();
            this.chooser.tooltip_text = this.source.path;
            this.emit ('changed');
        }));
    }
});

const PageGeneral = new Lang.Class({
    Name: 'PageGeneral',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        let id = 0, i = 0;
        this.border_width = 6;

        this.add (new Gtk.Label ({label: _("<b>System</b>"), use_markup:true, xalign:0, margin_top:8}));
        this.cb_startup = Gtk.CheckButton.new_with_label (_("Start server on the loading"));
        this.cb_startup.margin = 6;
        this.add (this.cb_startup);
        this.cb_startup.active = startup;
        this.cb_startup.connect ('toggled', Lang.bind (this, ()=>{
            startup = this.cb_startup.active;
            settings.set_boolean (STARTUP_KEY, startup);
        }));
        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.pack_start (hbox, false, false, 0);
        hbox.add (new Gtk.Label ({label: _("GUI Theme")}));
        this.theme_gui = new Gtk.ComboBoxText ();
        this.theme_gui.append_text (_("system default"));
        id = 0, i = 1;
        themes ("/data/themes", "/obmin.css").forEach (s => {
            this.theme_gui.append_text (s);
            if (s == theme_gui) id = i;
            i++;
        });
        this.theme_gui.active = id;
        this.theme_gui.connect ('changed', Lang.bind (this, ()=>{
            debug (EXTENSIONDIR + "/data/themes/" + this.theme_gui.get_active_text());
            if (this.theme_gui.active == 0) settings.set_string (THEME_GUI_KEY, '');
            else settings.set_string (THEME_GUI_KEY, this.theme_gui.get_active_text());
        }));
        hbox.pack_end (this.theme_gui, false, false, 0);

        this.add (new Gtk.Label ({label: _("<b>Server Mode</b>"), use_markup:true, xalign:0, margin_top:8, margin_bottom:8}));
        this.file_server = Gtk.RadioButton.new_with_label_from_widget (null, _("File Server"));
        this.file_server.tooltip_text = "default mode: 0";
        this.pack_start (this.file_server, false, false, 0);
        let label = new Gtk.Label ({
            label: "<i>"+_("Show the folder's list on requests.")+"</i>",
            use_markup:true, xalign:0, margin_left:24, margin_bottom:12});
        label.wrap = true;
        this.add (label);

        this.mix_server = Gtk.RadioButton.new_with_label_from_widget (this.file_server, _("WEB/File Server"));
        this.mix_server.tooltip_text = "mode: 1";
        this.pack_start (this.mix_server, false, false, 0);
        label = new Gtk.Label ({
            label: "<i>"+_("Look for \'index.html\' first if it is not exist show the folder's list.")+"</i>",
            use_markup:true, xalign:0, margin_left:24, margin_bottom:12});
        label.wrap = true;
        this.add (label);

        this.web_server = Gtk.RadioButton.new_with_label_from_widget (this.file_server, _("WEB Server"));
        this.web_server.tooltip_text = "mode: 1";
        this.pack_start (this.web_server, false, false, 0);
        label = new Gtk.Label ({
            label: "<i>"+_("Look for \'index.html\' and direct links only if it is not exist show error \'404.html\'.")+"</i>",
            use_markup:true, xalign:0, margin_left:24, margin_bottom:12});
        label.wrap = true;
        this.add (label);

        if (mode == 1) this.mix_server.active = true;
        else if (mode == 2) this.web_server.active = true;

        this.file_server.connect ('toggled', Lang.bind (this, ()=>{
            if (this.file_server.active) settings.set_int (MODE_KEY, 0);
        }));
        this.mix_server.connect ('toggled', Lang.bind (this, ()=>{
            if (this.mix_server.active) settings.set_int (MODE_KEY, 1);
        }));
        this.web_server.connect ('toggled', Lang.bind (this, ()=>{
            if (this.web_server.active) settings.set_int (MODE_KEY, 2);
        }));

        this.add (new Gtk.Label ({label: _("<b>Server Extensions</b>"), use_markup:true, xalign:0, margin_top:8, margin_bottom:8}));
        this.manager = new Gtk.Button ({label: _("Local Extensions...")});
        this.manager.tooltip_text = "OBMIN " + _("Extension Manager");
        this.add (this.manager);
        this.manager.connect ('clicked', Lang.bind (this, ()=>{
            GLib.spawn_command_line_async (EXTENSIONDIR + '/obmin-extensions');
        }));

        this.show_all ();
    }
});

const PageContent = new Lang.Class({
    Name: 'PageContent',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:6, spacing:8});
        this.border_width = 6;

        this.add (new Gtk.Label ({label: _("<b>WEB Interface</b>"), use_markup:true, xalign:0, margin_top:12}));
        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.pack_start (hbox, false, false, 0);
        hbox.add (new Gtk.Label ({label: _("Theme")}));
        this.theme = new Gtk.ComboBoxText ();
        let id = 0, i = 0;
        themes ("/data/www/themes", "/style.css").forEach (s => {
            this.theme.append_text (s);
            if (s == theme) id = i;
            i++;
        });
        this.theme.active = id;
        this.theme.connect ('changed', Lang.bind (this, ()=>{
            debug (EXTENSIONDIR + "/data/www/themes/" + this.theme.get_active_text());
            settings.set_string (THEME_KEY, this.theme.get_active_text());
        }));
        hbox.pack_end (this.theme, false, false, 0);

        this.add (new Gtk.Label ({label: _("<b>File Filters</b>"), use_markup:true, xalign:0, margin_top:12}));
        this.mounts = Gtk.CheckButton.new_with_label (_("Show mount points"));
        this.add (this.mounts);
        this.mounts.active = mounts;
        this.mounts.connect ('toggled', Lang.bind (this, ()=>{
            mounts = this.mounts.active;
            settings.set_boolean (MOUNTS_KEY, mounts);
        }));

        this.links = Gtk.CheckButton.new_with_label (_("Show symbolic links"));
        this.add (this.links);
        this.links.active = links;
        this.links.connect ('toggled', Lang.bind (this, ()=>{
            links = this.links.active;
            settings.set_boolean (LINKS_KEY, links);
        }));

        this.hiddens = Gtk.CheckButton.new_with_label (_("Show hidden content"));
        this.add (this.hiddens);
        this.hiddens.active = hiddens;
        this.hiddens.connect ('toggled', Lang.bind (this, ()=>{
            hiddens = this.hiddens.active;
            settings.set_boolean (HIDDENS_KEY, hiddens);
        }));

        this.backups = Gtk.CheckButton.new_with_label (_("Show backups"));
        this.add (this.backups);
        this.backups.active = backups;
        this.backups.connect ('toggled', Lang.bind (this, ()=>{
            backups = this.backups.active;
            settings.set_boolean (BACKUPS_KEY, backups);
        }));

        //let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        //this.pack_start (hbox, false, false, 0);

        this.show_all ();
    }
});

const PageNotify = new Lang.Class({
    Name: 'PageNotify',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        this.border_width = 6;

        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.pack_start (hbox, false, false, 0);
        let label = new Gtk.Label ({label: _("Debugging level")});
        hbox.add (label);
        this.level = new Gtk.ComboBoxText ();
        [_("ERROR"),_("INFO"),_("DEBUG")].forEach (s => {
            this.level.append_text (s);
        });
        this.level.active = DEBUG;
        this.level.connect ('changed', Lang.bind (this, ()=>{
            DEBUG = this.level.active;
            settings.set_int (DEBUG_KEY, DEBUG);
        }));
        hbox.pack_end (this.level, false, false, 0);
        this.cb_journal = Gtk.CheckButton.new_with_label (_("Enable local server logs"));
        this.cb_journal.tooltip_text = _("Use local logs for the server messages (default enabled).") +
            "\n" + _("If disabled it uses the systemd journal only.");
        this.cb_journal.margin = 6;
        this.add (this.cb_journal);
        this.cb_journal.active = journal;
        this.cb_journal.connect ('toggled', Lang.bind (this, ()=>{
            journal = this.cb_journal.active;
            settings.set_boolean (JOURNAL_KEY, journal);
        }));

        this.add (new Gtk.Label ({label: "<b>" + _("Applet notifications") + "</b>", use_markup:true, xalign:0, margin_top:12}));
        this.cb_activity = Gtk.CheckButton.new_with_label (_("Activity Monitor"));
        this.cb_activity.tooltip_text = _("Monitor usage statistic and active connections");
        this.cb_activity.margin = 6;
        this.add (this.cb_activity);
        this.cb_activity.active = monitor;
        this.cb_activity.connect ('toggled', Lang.bind (this, ()=>{
            monitor = this.cb_activity.active;
            settings.set_boolean (MONITOR_KEY, monitor);
        }));

        this.show_all ();
    }
});

const PageSupport = new Lang.Class({
    Name: 'PageSupport',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        this.border_width = 6;

        let label = new Gtk.Label ({label: "<b>"+_("Make Donation to the project")+"</b>", use_markup:true, xalign:0, margin:8});
        this.add (label);
        label = new Gtk.Label ({label: "<i>"+_("Behind the development for the Linux Desktop are ordinary people who spend a lot of time and their own resources to make the Linux Desktop better.")+"</i>", use_markup:true, xalign:0, margin:8});
        label.wrap = true;
        this.pack_start (label, false, false, 0);
        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6, spacing:24});
        this.pack_start (hbox, false, false, 0);
        this.pp = new Gtk.Button ();
        this.pp.image = Gtk.Image.new_from_file (EXTENSIONDIR + "/data/icons/pp.png");
        this.pp.tooltip_text = _("Make Donation") + " (EUR)";
        hbox.add (this.pp);
        this.pp.connect ('clicked', Lang.bind (this, ()=>{
            let app = Gio.AppInfo.get_default_for_uri_scheme ("https");
            app.launch_uris (["https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WVAS5RXRMYVC4"], null);
        }));
        this.pp = new Gtk.Button ();
        this.pp.image = Gtk.Image.new_from_file (EXTENSIONDIR + "/data/icons/pp.png");
        this.pp.tooltip_text = _("Make Donation") + " (USD)";
        hbox.add (this.pp);
        this.pp.connect ('clicked', Lang.bind (this, ()=>{
            let app = Gio.AppInfo.get_default_for_uri_scheme ("https");
            app.launch_uris (["https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HGAFMMMQ9MQJ2"], null);
        }));
        label = new Gtk.Label ({label: "<a href=\"https://github.com/konkor/obmin#contributions\" title=\"&lt;i&gt;Project&lt;/i&gt; website\">" + _("Find more about contributions...")+"</a>", use_markup:true, xalign:0, margin:8});
        this.add (label);

        hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.pack_start (hbox, false, false, 0);
        label = new Gtk.Label ({label: _("Level of the donation notifications")});
        hbox.add (label);
        this.level = new Gtk.ComboBoxText ();
        [_("INTERFACE"),_("SERVER"),_("NONE")].forEach (s => {
            this.level.append_text (s);
        });
        this.level.active = support;
        this.level.connect ('changed', Lang.bind (this, ()=>{
            support = this.level.active;
            settings.set_int (SUPPORT_KEY, support);
        }));
        hbox.pack_end (this.level, false, false, 0);
        label = new Gtk.Label ({label: "<i>"+_("Feel free to set up a disired supporting level of the notifications if some forms anoyong you or you are already a project's contributor.")+"</i>", use_markup:true, xalign:0, margin:8});
        label.wrap = true;
        this.pack_start (label, false, false, 0);

        this.show_all ();
    }
});

const PageNetwork = new Lang.Class({
    Name: 'PageNetwork',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:6});
        this.border_width = 6;

        this.add (new Gtk.Label ({label: _("<b>Network Interface</b>"), use_markup:true, xalign:0, margin_top:12}));
        let hbox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:6});
        this.pack_start (hbox, false, false, 0);
        hbox.add (new Gtk.Label ({label: _("Listening Port")}));
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

function themes (folder, style) {
    let list = [], finfo;
    let dir = Gio.File.new_for_path (EXTENSIONDIR + folder);
    if (!dir.query_exists (null)) return list;
    var e = dir.enumerate_children ("*", Gio.FileQueryInfoFlags.NONE, null);
    while ((finfo = e.next_file (null)) != null) {
        if (finfo.get_file_type () != Gio.FileType.DIRECTORY) continue;
        if (!Gio.File.new_for_path(dir.get_path() + "/" + finfo.get_name() + style).query_exists (null))
            continue;
        list.push (finfo.get_name ());
    }
    return list;
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
    let file = Gio.File.new_for_path (path);
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}

function debug (msg) {
    if (DEBUG > 1) print ("[obmin][prefs] " + msg);
}

function error (msg) {
    log ("[obmin][prefs] (EE) " + msg);
}

function init() {
    Convenience.initTranslations ();
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path (EXTENSIONDIR + "/data/icons");
    settings = Convenience.getSettings ();
}

function buildPrefsWidget() {
    let widget = new ObminWidget ();
    return widget.notebook;
}
