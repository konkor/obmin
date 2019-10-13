/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * This is a part of OBMIN Server
 * Copyright (C) 2017-2019 konkor <konkor.github.io>
 *
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const API_VERSION = 1;

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;

var Format = imports.format;
String.prototype.format = Format.format;

var realm = "obmin access";

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

let log_path = GLib.get_user_data_dir () + "/obmin/logs/";
const Logger = new Lang.Class({
    Name: 'Logger',

    _init: function (source) {
        let filename;
        this.prefix = source?source:"";
        if (!GLib.file_test (log_path, GLib.FileTest.EXISTS))
            GLib.mkdir_with_parents (log_path, 484);
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
        if (!rotation) return;
        GLib.timeout_add_seconds (0, 2, rotation_worker);
    },

    put: function (text) {
        if (!text || !this.stream) return;
        this.stream.put_string (text + "\n", null);
        //this.stream.flush_async (0, null, null);
    },

    get new_filename () {
        let d = new Date();
        return "%s%s-%04d%02d%02d-%02d%02d%02d%03d.log".format(log_path, this.prefix,
            d.getFullYear(),d.getMonth()+1,d.getDate(),
            d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds());
    }
});

let rotation = getSettings().get_int ('logs-rotation');
function rotation_worker () {
    if (!rotation) return false;
    let d = 0, now = new Date (), fname, finfo, count = 0;
    let dir = Gio.File.new_for_path (log_path);
    if (!dir.query_exists (null)) return false;
    var e = dir.enumerate_children ("*", Gio.FileQueryInfoFlags.NONE, null);
    while ((finfo = e.next_file (null)) != null) {
        if (finfo.get_file_type () == Gio.FileType.DIRECTORY) continue;
        fname = finfo.get_name ();
        if (!fname.endsWith (".log")) continue;
        d = now.valueOf() - finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED) * 1000;
        if (d > 2592000000*rotation) {
            if (Gio.File.new_for_path (log_path+fname).delete(null))
                count++;
        }
    }
    debug ("rotation_worker", "removed %d logs...".format (count));
    return false;
}

function fetch (url, agent, headers, callback) {
    callback = callback || null;
    agent = agent || "Obmin ver." + API_VERSION;

    let session = new Soup.SessionAsync({ user_agent: agent });
    Soup.Session.prototype.add_feature.call (session, new Soup.ProxyResolverDefault());
    let request = Soup.Message.new ("GET", url);
    if (headers) headers.forEach (h=>{
        request.request_headers.append (h[0], h[1]);
    });
    session.queue_message (request, (source, message) => {
        if (callback)
            callback (message.response_body.data?message.response_body.data.toString():"", message.status_code);
    });
}

function fetch_sync (url, agent, headers) {
    agent = agent || "Obmin ver." + API_VERSION;

    let responce = [];
    let cancellable = new Gio.Cancellable();
    let session = new Soup.SessionSync({ user_agent: agent });
    let request = Soup.Message.new ("GET", url);
    if (headers) headers.forEach (h=>{
        request.request_headers.append (h[0], h[1]);
    });
    let timeout_id = GLib.timeout_add_seconds (0, 4, Lang.bind (this, function () {
        if (cancelable) cancelable.cancel();
        return false;
    }));
    let stream = session.send (request, cancellable);
    GLib.Source.remove (timeout_id);
    if (stream) {
        let dis = new Gio.DataInputStream ({base_stream: stream});
        let line = "";
        while (line != null) {
            [line,] = dis.read_line_utf8 (null);
            if (line != null) responce.push (line);
        }
        dis.close (null);
    }
    return responce;
}

var CONFIG_PATH = GLib.get_user_config_dir() + "/obmin";

function gen_certificate () {
    if (!GLib.file_test (CONFIG_PATH, GLib.FileTest.IS_DIR))
        GLib.mkdir_with_parents (CONFIG_PATH, 493);

    let key = GLib.file_test (CONFIG_PATH + "/private.pem", GLib.FileTest.EXISTS);

    let certificate = GLib.file_test (CONFIG_PATH + "/certificate.pem", GLib.FileTest.EXISTS);

    if (!key || !certificate) {
        let cmd = [
            "openssl", "req", "-new", "-x509", "-sha256", "-newkey",
            "rsa:2048", "-nodes", "-keyout", "private.pem", "-days", "3650",
            "-out", "certificate.pem", "-subj",
            "/CN=" + Gio.dbus_generate_guid ()
        ];

        let proc = GLib.spawn_sync(
            CONFIG_PATH,
            cmd,
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );
    }

    GLib.spawn_command_line_async("chmod 0600 " + CONFIG_PATH + "/private.pem");
    GLib.spawn_command_line_async("chmod 0600 " + CONFIG_PATH + "/certificate.pem");
};

function md5 (text) {
    let checksum = new GLib.Checksum (GLib.ChecksumType.MD5);
    checksum.update (text);
    return checksum.get_string ();
}

function get_ip_addresses () {
    let addresses = [];
    var cmd_output = GLib.spawn_command_line_sync ('ip addr show');
    if (!cmd_output[0]) return ['127.0.0.1'];
    var list = byteArrayToString (cmd_output[1]).toString ().split ('\n');
    list.forEach ((s)=>{
        let ar;
        if ((s.indexOf ('inet') > -1) && (s.indexOf ('scope global') > -1)) {
            ar = s.trim ().split (' ');
            if (ar[1].indexOf ('/') > -1)
                addresses.push (ar[1].substr (0, ar[1].indexOf ('/')));
        }
    });
    if (addresses.length == 0) addresses.push ('127.0.0.1');
    return addresses;
}

function byteArrayToString (array) {
  return array instanceof Uint8Array ? ByteArray.toString (array):array;
}
