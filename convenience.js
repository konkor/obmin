/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
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

const API_VERSION = 1;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Gettext = imports.gettext;
const Format = imports.format;

String.prototype.format = Format.format;

function initTranslations (domain) {
    domain = domain || 'gnome-shell-extensions-obmin';

    let localeDir = Gio.File.new_for_path (getCurrentFile()[1] + '/locale');
    if (localeDir.query_exists (null))
        Gettext.bindtextdomain (domain, localeDir.get_path());
    else
        Gettext.bindtextdomain (domain, '/usr/share/locale');
}

function getSettings (schema) {
    schema = schema || 'org.gnome.shell.extensions.obmin';

    const GioSSS = Gio.SettingsSchemaSource;

    let schemaDir = Gio.File.new_for_path (getCurrentFile()[1] + '/schemas');
    let schemaSource;
    if (schemaDir.query_exists(null))
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                 GioSSS.get_default(),
                                                 false);
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension '
                        + 'obmin@konkor. Please check your installation.');

    return new Gio.Settings({ settings_schema: schemaObj });
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

//DOMAIN ERROR:0:RED, INFO:1:BLUE, DEBUG:2:GREEN
const domain_color = ["00;31","00;34","00;32"];
const domain_name = ["EE","II","DD"];

let logger = null;

function info (source, msg) {
    print_msg (1, source, msg);
    if (!logger) logger = new Logger (source);
}

function debug (source, msg) {
    print_msg (2, source, msg);
}

function error (source, msg) {
    print_msg (0, source, msg);
}

function print_msg (domain, source, output) {
    let ds = new Date().toString ();
    let i = ds.indexOf (" GMT");
    if (i > 0) ds = ds.substring (0, i);

    if (domain == 2) print ("\x1b[%sm[%s](%s) [obmin][%s]\x1b[0m %s".format (
        domain_color[domain],ds,domain_name[domain],source,output));
    else {
        log ("(%s) [obmin][%s] %s".format (domain_name[domain], source, output));
        if (logger) logger.put ("[%s](%s) %s".format (ds, domain_name[domain], output));
    }
}

function InitLogger (source) {
    logger = new Logger (source);
}

const Logger = new Lang.Class({
    Name: 'Logger',

    _init: function (source) {
        let filename;
        this.prefix = source?source:"";
        this.path = GLib.get_user_data_dir () + "/obmin/";
        if (!GLib.file_test (this.path, GLib.FileTest.EXISTS))
            GLib.mkdir_with_parents (this.path, 484);
        filename = this.new_filename;
        while (GLib.file_test (filename, GLib.FileTest.EXISTS))
            filename = this.new_filename;
        debug ("logger", filename);
        var f = Gio.File.new_for_path (filename);
        try {
            var out_stream = f.create (Gio.FileCreateFlags.NONE, null);
            this.stream = Gio.DataOutputStream.new (out_stream);
        } catch (e) {
            log (e.message);
        }
    },

    put: function (text) {
        if (!text || !this.stream) return;
        this.stream.put_string (text + "\n", null);
        //this.stream.flush_async (0, null, null);
    },

    get new_filename () {
        let d = new Date();
        return "%s%s-%04d%02d%02d-%02d%02d%02d%03d.log".format(this.path, this.prefix,
            d.getFullYear(),d.getMonth()+1,d.getDate(),
            d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds());
    }
});
