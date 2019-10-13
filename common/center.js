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
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Cairo = imports.cairo;
const System = imports.system;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions-obmin');
const _ = Gettext.gettext;

const APPDIR = get_appdir ();
imports.searchPath.unshift(APPDIR);
const Convenience = imports.convenience;
const b2s = Convenience.byteArrayToString;
const Prefs = imports.prefs;

const DEBUG_KEY = 'debug';
const STARTUP_KEY = 'startup-settings';
const STATS_MONITOR_KEY = 'stats-monitor';
const THEME_GUI_KEY = 'theme-gui';
const SUPPORT_KEY = 'support';
const JOURNAL_KEY = 'logs';
const PORT_KEY = 'port';
const STATUS_KEY = 'status';

let startup = false;
let support = 0;
let port = 8088;
let DEBUGGING = 1;
let status = 30;
let journal = true;
let stats_monitor = true;
let stats = {access:0, ready:0, upload:0};
let theme_gui = APPDIR + "/data/themes/default/obmin.css";

let status_event = 0;
let update_event = 0;
let infobar_event = 0;
let settings = null;
let server = 0;
let cssp = null;

let window = null;

var ObminCenter = new Lang.Class ({
    Name: 'ObminCenter',

    _init: function () {
        this.application = new Gtk.Application ({application_id: "org.konkor.obmin.center",
                flags: Gio.ApplicationFlags.HANDLES_OPEN});
        GLib.set_application_name ("OBMIN Control Center");
        GLib.set_prgname ("OBMIN");
        Convenience.initTranslations ();

        settings = Convenience.getSettings ();
        DEBUGGING = settings.get_int (DEBUG_KEY);
        port = settings.get_int (PORT_KEY);
        startup = settings.get_boolean (STARTUP_KEY);
        journal = settings.get_boolean (JOURNAL_KEY);
        support = settings.get_int (SUPPORT_KEY);
        status = settings.get_int (STATUS_KEY);
        stats_monitor = settings.get_boolean (STATS_MONITOR_KEY);
        theme_gui = APPDIR + "/data/themes/" + settings.get_string (THEME_GUI_KEY) + "/obmin.css";

        server = this.server_enabled;

        this.application.connect ('activate', Lang.bind (this, this._onActivate));
        this.application.connect ('startup', Lang.bind (this, this._onStartup));
        settings.connect ("changed::" + THEME_GUI_KEY, Lang.bind (this, function() {
            theme_gui = APPDIR + "/data/themes/" + settings.get_string (THEME_GUI_KEY) + "/obmin.css";
            if (cssp) {
                Gtk.StyleContext.remove_provider_for_screen (window.get_screen(), cssp);
            }
            cssp = get_css_provider ();
            if (cssp) { Gtk.StyleContext.add_provider_for_screen (
                window.get_screen(), cssp, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            }
        }));
        settings.connect ("changed::" + JOURNAL_KEY, Lang.bind (this, function() {
            journal = settings.get_boolean (JOURNAL_KEY);
        }));
    },

    _onActivate: function () {
        window.show_all ();
        this.dbus = Gio.bus_get_sync (Gio.BusType.SESSION, null);
        if (this.dbus)
            this.dbus.call('org.freedesktop.DBus', '/', "org.freedesktop.DBus", "AddMatch",
                GLib.Variant.new('(s)', ["type=\'signal\'"]), null, Gio.DBusCallFlags.NONE, -1, null, Lang.bind (this, function() {
                    this._signalCC = this.dbus.signal_subscribe(null, "org.konkor.obmin.server", "CounterChanged",
                    '/org/konkor/obmin/server', null, Gio.DBusSignalFlags.NO_MATCH_RULE, Lang.bind (this, this.on_counter_changed));
            }));
        window.present ();
    },

    on_counter_changed: function (conn, sender, object, iface, signal, param, user_data) {
        stats = JSON.parse (param.get_child_value(0).get_string()[0]);
        if (update_event) GLib.Source.remove (update_event);
        update_event = GLib.timeout_add (0, 50, Lang.bind (this, this.update_stats ));
    },

    _onStartup: function () {
        this._build ();
        if (server) {
            stats = JSON.parse (settings.get_string (STATS_DATA_KEY));
            this.update_stats ();
        }
        this.check_status ();
        if (status > 0)
            status_event = GLib.timeout_add_seconds (0, status,
            Lang.bind (this, function () {
            this.check_status ();
            return true;
        }));
    },

    check_status: function () {
        let run = false;
        let res = GLib.spawn_command_line_sync ("ps -A");
        let o, n;
        if (res[0]) o = b2s (res[1]).toString().split("\n");
        res = null;
        for (let i = 0; i < o.length; i++) {
            if (o[i].indexOf ("obmin-server") > -1) {
                n = parseInt (o[i].trim().split(" ")[0]);
                if (Number.isInteger(n) && n > 0) run = n;
                o = null;
                break;
            }
        }
        if (run != server) {
            server = run;
            this.lock = true;
            this.run_button.set_active (server);
            this.lock = false;
        }
        this.hb.subtitle = server?_("server running"):_("server stopped");
    },

    _build: function () {
        window = new Gtk.Window ();
        window.title = "OBMIN";
        window.set_position (Gtk.WindowPosition.CENTER);
        window.set_icon_name ('obmin-off');
        if (!window.icon) try {
            window.icon = Gtk.Image.new_from_file (APPDIR + "/data/icons/obmin.svg").pixbuf;
        } catch (e) {
            error (e.message);
        }
        window.set_default_size (800, 512);
        cssp = get_css_provider ();
        this.hb = new Gtk.HeaderBar ();
        this.hb.set_show_close_button (true);
        this.hb.get_style_context ().add_class ("hb");
        window.set_titlebar (this.hb);
        this.hb.title = "OBMIN Control Center";
        this.hb.subtitle = "server running";
        if (cssp) {
            Gtk.StyleContext.add_provider_for_screen (
                window.get_screen(), cssp, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        }
        this.run_button  = new RunButton ();
        this.hb.pack_end (this.run_button);
        Prefs.init ();
        this.prefs = new Prefs.ObminWidget ();
        this.application.add_window (window);
        this.box = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:0});
        window.add (this.box);
        this.sidebar = new Sidebar ();
        this.sidebar.get_style_context ().add_class ("sb");
        this.box.add (this.sidebar);

        let vbox = new Gtk.Box ({orientation:Gtk.Orientation.VERTICAL, margin:0});
        this.box.pack_start (vbox, true, true, 0);
        this.infobar = null;
        this.infobox = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:0});
        vbox.add (this.infobox);

        this.stack = new Gtk.Stack ();
        this.stack.transition_type = Gtk.StackTransitionType.SLIDE_UP_DOWN;
        vbox.pack_start (this.stack, true, true, 0);
        this.statview = new Statistic ();
        this.stack.add_named (this.statview, "stats");
        this.logsview = new Logs ();
        this.stack.add_named (this.logsview, "logs");
        this.stack.add_named (this.prefs.notebook, "prefs");

        this.sidebar.connect ('stack_update', Lang.bind (this, this.on_stack));
        this.run_button.connect ('toggled', Lang.bind (this, this.on_run));
        window.connect ('destroy', () => {
            if (update_event) GLib.Source.remove (update_event);
            update_event = 0;
        });
        /*this.sidebar.exit_button.button.connect ('clicked', Lang.bind (this, ()=>{
            this.application.quit ();
        }));*/
    },

    update_stats: function () {
        if (update_event) {
            GLib.Source.remove (update_event);
            update_event = 0;
        }
        this.statview.update_stats ();
        if (this.stack.visible_child_name == 'logs') {
            if ((stats.access - this.logsview.loged) > 0)
                this.show_refresh (stats.access - this.logsview.loged);
        }
        return false;
    },

    on_run: function (o) {
        if (!this.lock) this._enable (o.active);
        //this.hb.subtitle = o.active?_("server running"):_("server stopped");
    },

    on_stack: function (o, id) {
        this.stack.visible_child_name = id;
        if (id == 'logs') this.logsview.refresh ();
        else this.hide_refresh ();
    },

    _enable: function (state) {
        server = state;
        if (state) {
            if (GLib.spawn_command_line_async (APPDIR + "/obmin-server")) {
            } else {
                server = false;
                //this.server_switch.setToggleState (false);
            }
        } else {
            GLib.spawn_command_line_async ("killall obmin-server");
        }
    },

    show_message: function (text, bar_type, timeout) {
        if (infobar_event) {
            GLib.Source.remove (infobar_event);
            infobar_event = 0;
        }
        if (this.infobar) this.infobar.destroy ();
        this.infobar = new Gtk.InfoBar ();
        if (bar_type == Gtk.MessageType.QUESTION) {
            this.infobar.add_button ("gtk-yes", Gtk.ResponseType.YES);
            this.infobar.add_button ("gtk-cancel", Gtk.ResponseType.CANCEL);
        } else {
            this.infobar.add_button ("gtk-close", Gtk.ResponseType.YES);
            this.infobar.set_default_response (Gtk.ResponseType.OK);
        }
        this.infobar.set_message_type (bar_type);
        var content = this.infobar.get_content_area ();
        content.add (new Gtk.Label ({label: text, use_markup:true, xalign:0.75}));

        this.infobox.add (this.infobar);
        this.infobar.show_all ();
        this.infobar.connect ('response', Lang.bind (this, (o,e) => {
            //print (e, Gtk.ResponseType.YES, Gtk.ResponseType.OK);
            this.infobar.destroy ();
            infobar_event = 0;
        }));
        if (timeout) infobar_event = GLib.timeout_add_seconds (0, timeout, Lang.bind (this, function () {
            if (this.infobar) this.infobar.destroy ();
            infobar_event = 0;
            return false;
        }));
    },

    show_info: function (text) {
        this.show_message (text, Gtk.MessageType.INFO, 10);
    },

    show_refresh: function (count) {
        if (infobar_event) {
            GLib.Source.remove (infobar_event);
            infobar_event = 0;
        }
        if (!this.refresh || (this.infobar != this.refresh)) {
            if (this.infobar) this.infobar.destroy ();
            this.refresh = new RefreshBar (count);
            this.infobar = this.refresh;
            this.infobox.add (this.infobar);
            this.infobar.show_all ();
            this.refresh.connect ('response', Lang.bind (this, () => {
                this.refresh.destroy ();
                this.refresh = null;
                this.logsview.refresh ();
            }));
        } else {
            this.refresh.update (count);
        }
    },

    hide_refresh: function () {
        if (this.infobar) this.infobar.destroy ();
    }
});

const RefreshBar = new Lang.Class({
    Name: 'RefreshBar',
    Extends: Gtk.InfoBar,

    _init: function (count) {
        this.parent ();
        this.text = _("new connection requests available...");
        this.add_button (_("Refresh"), Gtk.ResponseType.YES);
        this.set_default_response (Gtk.ResponseType.OK);
        this.set_message_type (Gtk.MessageType.INFO);
        var content = this.get_content_area ();
        this.label = new Gtk.Label ({
            label: count.toString () + " " + this.text,
            use_markup: true, xalign: 0.75});
        content.add (this.label);

        this.show_all ();
    },

    update: function (count) {
        this.label.set_text (count.toString () + " " + this.text);
    }
});

const Sidebar = new Lang.Class({
    Name: 'Sidebar',
    Extends: Gtk.Box,
    Signals: {
        'stack_update': {
        flags: GObject.SignalFlags.RUN_LAST | GObject.SignalFlags.DETAILED,
        param_types: [GObject.TYPE_STRING]},
    },

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:0});
        let box = null;

        var l = Convenience.get_ip_addresses ();
        //if (l.length > 0) this.add (new LocalItem (l[0]));
        l.forEach ((ip)=>{
            let local_item = new LocalItem (ip);
            this.add (local_item);
        });
        this.public_item = new PublicItem ();
        this.add (this.public_item);

        let image = Gtk.Image.new_from_file (APPDIR + "/data/icons/obmin-dash.svg");
        this.pack_start (image, false, false, 12);

        this.toggle_lock = false;
        this.stats_button = new SidebarButton (_("Statistic"), _("Show Usage Statistic"), "stats");
        this.stats_button.button.active = true;
        this.current = this.stats_button.button;
        this.pack_start (this.stats_button, false, false, 0);
        this.log_button = new SidebarButton (_("Log"), _("Show Logs Viewer"), "logs");
        this.pack_start (this.log_button, false, false, 0);

        box = new Gtk.Box ({orientation: Gtk.Orientation.VERTICAL});
        this.pack_start (box, true, true, 0);

        this.exit_button = new SidebarButton (_("Exit"), _("Close Control Center"));
        this.exit_button.margin_bottom = 16;
        //this.pack_end (this.exit_button, false, false, 0);
        this.prefs_button = new SidebarButton (_("Settings"), _("Open Preferences"), "prefs");
        this.prefs_button.margin_bottom = 16;
        this.pack_end (this.prefs_button, false, false, 0);

        this.stats_button.button.connect ('toggled', Lang.bind (this, this.on_toggle));
        this.log_button.button.connect ('toggled', Lang.bind (this, this.on_toggle));
        this.prefs_button.button.connect ('toggled', Lang.bind (this, this.on_toggle));

        this.show_all ();
    },

    on_toggle: function (o) {
        if (this.toggle_lock) return;
        if ((o == this.current) && !o.active) {
            o.active = true;
            return;
        }
        if (o == this.current) return;
        this.toggle_lock = true;
        this.current.active = false;
        this.current = o;
        this.emit ('stack_update', o.id);
        this.toggle_lock = false;
    },

    on_prefs: function (o) {
        if (o.active) o.active = false;
        else return;
        GLib.spawn_command_line_async (APPDIR + '/obmin-preferences');
    }
});

const RunButton = new Lang.Class({
    Name: 'RunButton',
    Extends: Gtk.ToggleButton,

    _init: function (text, tooltip, id) {
        this.parent ();
        this.ttext = _("Start Server");
        this.tooltip_text = this.ttext;
        this.image = Gtk.Image.new_from_icon_name ("system-shutdown-symbolic", Gtk.IconSize.LARGE_TOOLBAR);
        this.xalign = 0;
        this.get_style_context ().add_class ("suggested-action");

        this.connect ('toggled', Lang.bind (this, this.on_toggle));

        this.show_all ();
    },

    on_toggle: function () {
        if (this.active) this.tooltip_text = _("Stop Server");
        else this.tooltip_text = this.ttext;
    }
});

const SidebarButton = new Lang.Class({
    Name: 'SidebarButton',
    Extends: Gtk.Box,

    _init: function (text, tooltip, id) {
        this.parent ({orientation:Gtk.Orientation.HORIZONTAL, margin:4, spacing:8});
        this.margin_left = 32;
        this.margin_right = 32;

        this.button = Gtk.ToggleButton.new_with_label (text);
        this.button.id = id;
        this.button.get_style_context ().add_class ("sb-button");
        this.button.tooltip_text = tooltip;
        this.pack_end (this.button, true, true, 0);

        this.show_all ();
    }
});

const InfoItem = new Lang.Class ({
    Name: 'InfoItem',
    Extends: Gtk.Box,

    _init: function (text, tooltip, info) {
        this.parent ({orientation:Gtk.Orientation.HORIZONTAL, margin:8, spacing:32});
        this.margin_left = 32;
        this.margin_right = 32;
        this.tooltip_text = tooltip;
        this.prefix = "<b>" + text + "</b> ";
        this.label =  new Gtk.Label ({label:this.prefix, use_markup:true, xalign:0});
        this.info =  new Gtk.Label ({label:"<i>" + info + "</i>", use_markup:true});
        this.pack_start (this.label, true, true, 0);
        this.pack_end (this.info, false, false, 0);
    },

    update_info: function (info) {
        this.info.set_markup ("<i>" + info + "</i>");
    }
});

const LocalItem = new Lang.Class ({
    Name: 'LocalItem',
    Extends: InfoItem,

    _init: function (address) {
        address = address || "127.0.0.1";
        this.parent (_("Local IP"), _("Local Network IP Address"), address);
    },

    update: function (address) {
        this.update_info (address);
    }
});

const PublicItem = new Lang.Class ({
    Name: 'PublicItem',
    Extends: InfoItem,

    _init: function () {
        this.parent (_("Public IP"), _("External Network IP Address"), "");
        this._ip = "";
        this.update ();
    },

    update: function () {
        Convenience.fetch ("http://ipecho.net/plain", null, null, Lang.bind (this, (text, s) => {
            if ((s == 200) && text) {
                this._ip = text.split("\n")[0];
                if (!this._ip || this._ip.length < 7) this._ip = "";
            } else this._ip = "";
            if (this._ip) this.visible = true;
            else this.visible = false;
            this.update_info (this._ip);
            return false;
        }));
    }
});

let ticks = 0;
const Statistic = new Lang.Class({
    Name: 'Statistic',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:0, spacing:8});
        this.c0 = stats.access;
        this.get_style_context ().add_class ("stats");

        let box = new Gtk.Box ({orientation:Gtk.Orientation.HORIZONTAL, margin:16, spacing:16});
        this.pack_start (box, false, false, 0);
        this.connections = new InfoRound ("ACTIVITY", _("Active connections"), (stats.access - stats.ready).toString());
        box.pack_start (this.connections, true, true, 0);
        this.requests = new InfoRound ("CONNECTIONS", _("Total Requests"), stats.access.toString());
        box.pack_start (this.requests, true, true, 0);
        this.uploads = new InfoRound ("TRANSFERS", _("Transferred Data"), GLib.format_size (stats.upload));
        box.pack_start (this.uploads, true, true, 0);

        this.monitor = new StatMonitor ();
        this.monitor.margin = 24;
        this.pack_start (this.monitor, true, true, 0);

        //this.t = [0,1,0,1,1,1,2,0,0,0,0,3,0,1,0,1,1,1,2,0,0,0,0,4];
        //this.i = 0;
        GLib.timeout_add_seconds (0, 1, Lang.bind (this, function () {
            //this.monitor.add (Math.round (Math.random (100)*100));
            //this.monitor.add (this.t[this.i++]);
            //if (this.i == this.t.length) this.i = 0;
            if ((stats.access - this.c0) < 0) this.monitor.add (stats.access);
            else this.monitor.add (stats.access - this.c0);
            this.c0 = stats.access;
            return true;
        }));

        this.show_all ();
    },

    update_stats: function () {
        if (stats.access && (stats.access >= 0)) {
            this.connections.update ((stats.access - stats.ready).toString());
            this.requests.update (stats.access.toString());
            this.uploads.update (GLib.format_size (stats.upload));
        }
    }
});

const InfoRound = new Lang.Class ({
    Name: 'InfoRound',
    Extends: Gtk.Box,

    _init: function (text, tooltip, info) {
        this.parent ({orientation:Gtk.Orientation.VERTICAL, margin:8, spacing:8});
        this.get_style_context ().add_class ("rlabel");
        this.margin_top = 0;
        this.margin_right = 8;
        this.tooltip_text = tooltip;
        this.prefix = "<b>" + text + "</b> ";
        this.label =  new Gtk.Label ({label:this.prefix, use_markup:true, xalign:0.5});
        this.info =  new RoundLabel (info);
        this.add (this.label);
        this.pack_start (this.info, true, true, 0);
    },

    update: function (info) {
        this.info.label = info;
    }
});

const RoundLabel = new Lang.Class({
    Name: 'RoundLabel',
    Extends: Gtk.DrawingArea,

    _init: function (text) {
        this.parent ();
        this._label = text;
        this.set_size_request (160, 160);
        this.connect ('draw', Lang.bind(this, this.on_drawn));
    },

    on_drawn: function (area, context) {
        let cr = context;
        let style = this.get_style_context ();
        let [width, height] = [this.get_allocated_width (), this.get_allocated_height ()];
        let ms = Math.min (width, height);
        let margin = 8;
        let text = ' ';
        let color = new Gdk.RGBA ({red:1, green:1, blue:1, alpha:1.0});
        let bg_color = style.get_color (0);
        if (this.label) text = this.label;
        let size = (ms-margin*2)/text.length*1.0;
        if (text.length > 1) size*=1.2;
        else size*=.65;
        cr.arc (width/2, height/2, (ms-margin*2)/2, 0, 2*Math.PI);
        Gdk.cairo_set_source_rgba (cr, bg_color);
        cr.fill ();
        Gdk.cairo_set_source_rgba (cr, color);
        cr.selectFontFace ("sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize (size);
        cr.moveTo (width/2 - 1.3*size/2*(text.length/2+0), height/2 + 0.75*size/2);
        cr.showText (text);
        cr.$dispose ();
        return true;
    },

    get label () {return this._label;},
    set label (val) {this._label = val; this.queue_draw ();}
});

const StatMonitor = new Lang.Class({
    Name: 'StatMonitor',
    Extends: Gtk.DrawingArea,

    _init: function (text) {
        this.parent ();
        this.timeout = 1000;
        this.scale = 120;
        this.buffer = null;
        this.v = [];
        this.v.push (0);this.v.push (0);
        this.max = 0;
        this.min = 0;
        this.val = -1;
        this.full = false;
        this.set_size_request (240, 60);
        this.connect ('draw', Lang.bind (this, this.on_drawn));
        this.connect ('size_allocate', Lang.bind(this, (o)=>{
            this.buffer = null;
            System.gc();
            this.buffer = new Cairo.ImageSurface (Cairo.Format.ARGB32, this.get_allocated_width (), this.get_allocated_height ());
            this.full = true;
        }));
        GLib.timeout_add (0, this.timeout, Lang.bind (this, ()=>{
            if (this.val>-1) {
                this.v.unshift (this.val);
                if (this.v.length > this.scale) this.v.splice (this.scale, 1);
                if (this.minmax ()) this.full = true;
                this.val = -1;
            }
            this.redraw ();
            return true;
        }));
    },

    minmax: function () {
        let f = false;
        this.min = 1000000;
        this.max = 0;
        for (let i = 0; i < this.v.length; i++) {
            if (this.v[i] > this.max) {
                this.max = this.v[i];
                f = true;
            }
            if ((this.v[i] < this.min) && (this.v[i] >= 0)) {
                this.min = this.v[i];
                f = true;
            }
        }
        if (this.min == 1000000) this.min = this.max;
        return f;
    },

    on_drawn: function (area, context) {
        if (!this.buffer) return true;
        context.setSourceSurface (this.buffer, 0, 0);
        context.paint ();
        context.$dispose ();
        return true;
    },

    redraw: function () {
        let full = this.full;
        let v0 = this.v[1], v1 = this.v[0];
        let [width, height] = [this.get_allocated_width (), this.get_allocated_height ()];
        let ws = Math.round (width / this.scale);
        let hs = height - 80;
        if (this.max > 0) hs = Math.round (hs / this.max, 1);
        let buf = new Cairo.ImageSurface (Cairo.Format.ARGB32, width+ws+3, height);
        let cr = new Cairo.Context (buf);
        let style = this.get_style_context ();
        let color = style.get_color (0);
        Gdk.cairo_set_source_rgba (cr, color);

        if (full) {
            cr.selectFontFace ("sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setFontSize (18);
            cr.moveTo (20, 20);
            cr.showText (_("Requests per second (maximum - ") + this.max + ")");
        }

        Gdk.cairo_set_source_rgba (cr, color);
        cr.setLineWidth (8.0);
        cr.setLineCap (Cairo.LineCap.ROUND);
        cr.setLineJoin (Cairo.LineJoin.ROUND);

        if (!full) {
            cr.moveTo (width - 3, height - 43 - hs * v1);
            cr.lineTo (width - ws - 3, height - 43 - hs * v0);
        } else {
            cr.moveTo (width - 3, height - 43 - hs * this.v[0]);
            let n = this.scale;
            if (n > this.v.length) n = this.v.length;
            for (let i = 1; i < n; i++) {
                cr.lineTo (width - ws * i - 3, height - 43 - hs * this.v[i]);
            }
        }
        cr.stroke ();

        if (!full) {
            cr.rectangle (0, 32, width, height-70);
            cr.clip ();
            cr.newPath ();
            cr.setSourceSurface (this.buffer,-ws,0);
            cr.paintWithAlpha (0.99);
        }

        cr.$dispose ();
        this.buffer = buf;
        this.queue_draw ();
        this.full = false;
        System.gc();
    },

    add: function (val) {
        this.val = val;
    }
});

const Logs = new Lang.Class({
    Name: 'Logs',
    Extends: Gtk.ScrolledWindow,

    _init: function () {
        this.parent ();
        this.box = new Gtk.Box ({orientation:Gtk.Orientation.VERTICAL, margin:0, spacing:8});
        this.box.get_style_context ().add_class ("logs");
        this.add (this.box);

        this.store = new LogStore ();
        this.loged = stats.access;
        this.view = new Gtk.TreeView ();
        this._build ();

        this.show_all ();
    },

    _build: function () {
        this.range = new LogRangeSelector ();
        this.box.add (this.range);
        this.range.level.connect ('changed', Lang.bind (this, (o)=>{
            this.refresh (o.active);
        }));

        this.view.headers_clickable = true;
        this.view.get_selection ().mode = Gtk.SelectionMode.MULTIPLE;
        let render = new Gtk.CellRendererText ();

        let column = new Gtk.TreeViewColumn ({title: _("#")});
        column.pack_start (render, false);
        column.add_attribute (render, "text", 0);
        column.fixed_width = 40;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 0;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Time")});
        column.pack_start (render, false);
        column.add_attribute (render, "text", 1);
        column.fixed_width = 128;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 1;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Guest")});
        column.pack_start (render, false);
        column.add_attribute (render, "text", 2);
        column.fixed_width = 110;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 2;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Target")});
        column.pack_start (render, true);
        column.add_attribute (render, "text", 3);
        column.fixed_width = 240;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 3;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Request")});
        column.pack_start (render, true);
        column.add_attribute (render, "text", 4);
        column.fixed_width = 120;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 4;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Type")});
        column.pack_start (render, false);
        column.add_attribute (render, "text", 5);
        column.fixed_width = 44;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 5;
        this.view.append_column (column);

        column = new Gtk.TreeViewColumn ({title: _("Port")});
        column.pack_start (render, false);
        column.add_attribute (render, "text", 6);
        column.fixed_width = 40;
        column.resizable = true;
        column.sizing = Gtk.TreeViewColumnSizing.FIXED;
        column.sort_column_id = 6;
        this.view.append_column (column);
        column.visible = false;

        column = new Gtk.TreeViewColumn ({title:''});
        column.sizing = Gtk.TreeViewColumnSizing.AUTOSIZE;
        column.pack_start (render, false);
        column.add_attribute (render, "text", 7);
        this.view.append_column (column);

        this.view.set_model (this.store);
        this.view.set_tooltip_column (4);

        this.box.add (this.view);
    },

    refresh: function (log_range) {
        this.range.visible = journal;
        this.store.reload (log_range);
        this.loged = stats.access;
    }
});

const LogRange = {
    LAST:0,
    TODAY:1,
    COUPLE:2,
    WEEK:3,
    MONTH:4,
    YEAR:5,
    ALL:6
};

const LogStore = new Lang.Class({
    Name: 'LogStore',
    Extends: Gtk.ListStore,

    _init: function () {
        this.parent ();
        this.set_column_types ([GObject.TYPE_INT,
            GObject.TYPE_STRING, GObject.TYPE_STRING,
            GObject.TYPE_STRING, GObject.TYPE_STRING,
            GObject.TYPE_STRING, GObject.TYPE_INT,
            GObject.TYPE_STRING]);
    },

    reload: function (log_range) {
        let list = this.parse_logs (log_range);
        this.clear ();
        list.forEach ( r => {this.set (this.append (), [0,1,2,3,4,5,6], r);});
    },

    parse_logs: function (log_range) {
        if (journal) return this.local_logs (log_range);
        else return this.system_logs ();
    },

    local_logs: function (log_range) {
        let list = [];
        var file, contents = [];
        let logs = this.get_local_logs (log_range);

        if (logs) logs.forEach (l => {
            try {
                file = Gio.File.new_for_path (l);
                contents = file.load_contents (null)[1].toString().split('\n');
                list = list.concat (this.parse_local (contents));
            } catch (e) {
                error (e.message);
            }
        });

        return list;
    },

    parse_local: function (output) {
        let list = [];
        if (output) output.forEach (o => {
            let s = o.toString ();
            let i = s.indexOf ("(II) Request (");
            if (i > 0) {
                let n = 0, g = '', r = '', m = '', p = 0, t = '', v = '';
                let d = s.substring (1, i - 1);
                i = s.indexOf ("(II) Request (");
                if (i == -1) return;
                s = s.substring (i + 14);
                i = s.indexOf (")");
                if ((i > -1) && (parseInt(s.substring (0, i)) >= 0))
                    n = parseInt(s.substring (0, i));
                s = s.substring (i + 2);
                i = s.indexOf (" ");
                if ((i > -1) && (parseInt(s.substring (0, i)) >= 0))
                    p = parseInt(s.substring (0, i));
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                g = s.substring (0, i);
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                v = s.substring (0, i);
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                m = s.substring (0, i);
                r = s.substring (i + 1);
                t = this.target (r);
                list.push ([n, d, g, t, r, m, p]);
            }
        });
        return list;
    },

    system_logs: function () {
        let list = [];
        let output = get_info_list ("journalctl");
        if (!output || output.length < 20) {
            output = get_info_list ("pkexec journalctl");
        }
        if (output) output.forEach (o => {
            let s = o.toString ();
            let i = s.indexOf ("(II) [obmin][server] Request (");
            if (i > -1) {
                let n = 0, g = '', r = '', m = '', p = 0, t = '', v = '';
                let d = s.substring (0, 15);
                i = s.indexOf ("(II) [obmin][server] Request (");
                if (i == -1) return;
                s = s.substring (i + 30);
                i = s.indexOf (")");
                if ((i > -1) && (parseInt(s.substring (0, i)) >= 0))
                    n = parseInt(s.substring (0, i));
                s = s.substring (i + 2);
                i = s.indexOf (" ");
                if ((i > -1) && (parseInt(s.substring (0, i)) >= 0))
                    p = parseInt(s.substring (0, i));
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                g = s.substring (0, i);
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                v = s.substring (0, i);
                s = s.substring (i + 1);
                i = s.indexOf (" ");
                if (i == -1) return;
                m = s.substring (0, i);
                r = s.substring (i + 1);
                t = this.target (r);
                list.push ([n, d, g, t, r, m, p]);
            }
        });
        return list;
    },

    target: function (request) {
        if (!request) return '';
        let t = '/', i;
        i = request.lastIndexOf (t);
        if (i == -1) return '';
        if (i + 1 < request.length) {
            return request.substring (i + 1);
        } else {
            t = request.substring (0, i);
            if (t.lastIndexOf ('/') == -1) return '/';
            t = request.substring (t.lastIndexOf ('/') + 1);
        }
        return t;
    },

    get_local_logs: function (log_range) {
        let period = LogRange.LAST; //default is last modified
        if (log_range) period = log_range;
        return this.get_logs (period);
    },

    get_logs: function (period) {
        let list = [], finfo, fname, last_date = 0, d;
        let now = new Date(), fdate = new Date();
        var log_path = GLib.get_user_data_dir () + "/obmin/logs/";
        let dir = Gio.File.new_for_path (log_path);
        if (!dir.query_exists (null)) return list;
        var e = dir.enumerate_children ("*", Gio.FileQueryInfoFlags.NONE, null);
        while ((finfo = e.next_file (null)) != null) {
            if (finfo.get_file_type () == Gio.FileType.DIRECTORY) continue;
            fname = finfo.get_name ();
            if (!fname.endsWith (".log") || (fname.indexOf ("server-") != 0)) continue;
            if (period == LogRange.LAST) {
                d = finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED);
                if (d > last_date) {
                    last_date = d;
                    list = [];
                    list.push (log_path + finfo.get_name ());
                }
            } else if (period == LogRange.TODAY) {
                d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
                //fdate.setTime (0); fdate.setDate (2);
                //debug ("%d < %d %s".format (d, fdate.valueOf(), fdate.toString()));
                if (d < 86400000) {
                    if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
                }
            } else if (period == LogRange.COUPLE) {
                d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
                if (d < 172800000) {
                    if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
                }
            } else if (period == LogRange.WEEK) {
                d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
                if (d < 604800000) {
                    if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
                }
            } else if (period == LogRange.MONTH) {
                d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
                //fdate.setTime (0); fdate.setDate (31);
                if (d < 2592000000) {
                    if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
                }
            } else if (period == LogRange.YEAR) {
                d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
                //fdate.setTime (0); fdate.setFullYear(1971, 0, 1);
                if (d < 31536000000) {
                    if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
                }
            } else {
                if (finfo.get_size () > 0) list.push (log_path + finfo.get_name ());
            }
        }
        return list;
    }
});

const LogRangeSelector = new Lang.Class ({
    Name: 'LogRangeSelector',
    Extends: Gtk.Box,

    _init: function () {
        this.parent ({orientation:Gtk.Orientation.HORIZONTAL, margin:8, spacing:8});
        this.level = new Gtk.ComboBoxText ();
        [_("Last modified"),_("24 Hours"),_("48 Hours"),_("Week"),
        _("Month"),_("Year"),_("All")].forEach (s => {
            this.level.append_text (s);
        });
        this.level.active = 0;
        this.pack_start (this.level, false, false, 0);
        this.add (new Gtk.Label ({label: _("View range")}));
    }
});

let cmd_out, info_out;
function get_info_string (cmd) {
    cmd_out = GLib.spawn_command_line_sync (cmd);
    if (cmd_out[1]) info_out = cmd_out[1].toString().split("\n")[0];
    if (info_out) return info_out;
    return "";
}

function get_info_list (cmd) {
    cmd_out = GLib.spawn_command_line_sync (cmd);
    //print (cmd_out[0],cmd_out[2],cmd_out[3]);
    if (cmd_out[1]) return cmd_out[1].toString().split("\n");
    return null;
}

function get_css_provider () {
    let cssp = new Gtk.CssProvider ();
    let css_file = Gio.File.new_for_path (theme_gui);
    try {
        cssp.load_from_file (css_file);
    } catch (e) {
        //print (e.message, theme_gui);
        cssp = null;
    }
    return cssp;
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

function debug (msg) {
    if (DEBUGGING > 1) Convenience.debug ("center", msg);
}

function error (msg) {
    Convenience.error ("center", msg);
}

let app = new ObminCenter ();
app.application.run (ARGV);
