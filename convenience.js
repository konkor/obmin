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

const VERSION = 9;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

function initTranslations (domain) {
    domain = domain || 'gnome-shell-extensions-obmin';

    let localeDir = Gio.File.new_for_path (getCurrentFile()[1] + '/locale');
    if (localeDir.query_exists (null))
        Gettext.bindtextdomain (domain, localeDir.get_path());
    else
        Gettext.bindtextdomain (domain, '@datadir@/locale');
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
