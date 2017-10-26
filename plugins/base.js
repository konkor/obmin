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
const GObject = imports.gi.GObject;

// 0-error,1-info,2-debug
var DEBUG_LVL = 1;

var PlugType = {
UNDEFINED:   0,
LINK:        1,
MENU_ITEM:   1 << 1,
SCRIPT:      1 << 2,
TOOLBAR:     1 << 3,
NOTIFY:      1 << 4,
TOP_PANEL:   1 << 5,
BOTTOM_PANEL:1 << 6,
LEFT_PANEL:  1 << 7,
RIGHT_PANEL: 1 << 8,
FOOTER:      1 << 9
};

//filter conditions
var Condition = {
EQUAL:     0,
NOT_EQUAL: 1,
LESS_EQUAL:2,
LESS:      3,
MORE:      4,
MORE_EQUAL:5
};

/*var METADATA = {
    name: "File lists",
    uuid: "f7d92e608a582d0fe0313bb959e3d51f",
    summary: "Various file lists generator",
    tooltip: "Shows various menu buttons for URLS, PLS, M3U...",
    schema: "obmin.plugins.konkor.filelists",
    author: "konkor",
    url: "https://github.com/konkor/obmin/",
    type: Base.PlugType.MENU_ITEM
};*/

var Plugin = new Lang.Class ({
    Name: 'BasePlugin',
    Extends: GObject.Object,

    _init: function (server, meta) {
        this.parent();
        this.obmin = null;
        if (server) {
            this.obmin = server;
            DEBUG_LVL = this.obmin.debug_lvl ();
        }
        this.name = '';
        this.uuid = '';
        this.summary = '';
        this.tooltip = '';
        this.schema = '';
        this.author = '';
        this.url = '';
        this.type = PlugType.UNDEFINED;
        if (meta.type) this.type = meta.type;
        if (meta.name) this.name = meta.name;
        if (meta.uuid) this.uuid = meta.uuid;
        if (meta.summary) this.summary = meta.summary;
        if (meta.tooltip) this.tooltip = meta.tooltip;
        if (meta.schema) this.schema = meta.schema;
        if (meta.author) this.author = meta.author;
        if (meta.url) this.url = meta.url;
        //puid runtime Plugin Unique ID it can be equal to:
        //uuid   - to has constant path (for bookmarks, public radio etc), default
        //custom - assigned by user for some reason (to access to hidden staff)
        //random - Gio.dbus_generate_guid ();
        //         new on each server start (user have to access to the server 1st to get link)
        this.puid = this.uuid;
    },

    has: function (attribute) {
        return (this.type & attribute) == attribute;
    },

    menu_item: function (class_name) {
        return '';
    },

    response: function (server, msg, path, query, client, num) {
        return null;
    },

    root_handler: function (server, msg) {
        msg.set_status (302);
        msg.response_headers.append ("Location", "/");
        server.unpause_message (msg);
        return true;
    },

    destroy: function () {
        GObject.signal_handlers_destroy(this);
    }
});

//DOMAIN ERROR:0:RED, INFO:1:BLUE, DEBUG:2:GREEN
const domain_color = ["00;31","00;32","00;34"];
const domain_name = ["EE","II","DD"];

function error (source, msg) {
    print_msg (0, source, msg);
}

function info (source, msg) {
    print_msg (1, source, msg);
}

function debug (source, msg) {
    print_msg (2, source, msg);
}

function print_msg (domain, source, output) {
    let ds = new Date().toString ();
    let i = ds.indexOf (" GMT");
    if (i > 0) ds = ds.substring (0, i);

    print ("\x1b[%sm[%s](%s) [obmin][%s]\x1b[0m %s".format (
        domain_color[domain],ds,domain_name[domain],source,output));
}
