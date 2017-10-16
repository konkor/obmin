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

const Lang = imports.lang;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

const PlugType = {
UNDEFINED: 0,
MENU_ITEM: 1,
PROVIDER: 2
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

const Plugin = new Lang.Class ({
    Name: 'BasePlugin',
    Extends: GObject.Object,

    _init: function (server, meta) {
        this.parent();
        this.obmin = null;
        if (server) this.obmin = server;
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

    menu_item: function (class_name) {
        return '';
    },

    response: function (server, msg, path, query, client, num) {
        return null;
    },

    destroy: function () {
        GObject.signal_handlers_destroy(this);
    }
});
