/*
 * This is a part of OBMIN Server
 * Copyright (C) 2017-2019 konkor <konkor.github.io>
 *
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

var FileStream = new Lang.Class({
    Name: 'FileStream',
    _init: function (server, request, file, finfo) {
        this.BUFFER = 65536;
        this.server = server;
        this.msg = request.msg;
        this.version = this.msg.get_http_version ();
        this.msg.connect ("wrote-chunk", this.wrote_chunk.bind (this));
        this.msg.connect ("finished", () => {
            //debug ("ContentStream " + this.num + " finished");
            this.done = true;
            if (this.read_event != 0) {
                GLib.source_remove (this.read_event);
                this.read_event = 0;
            }
            try{if (this.stream) this.stream.close_async (100, null, null);
            }catch (err) {
            error ("Error close stream " + err);
            }
            this.b = [];
            try{this.msg.set_status (200);
            }catch (err) {
            error ("Error set status " + err);
            }
            try{
            this.msg.response_body.complete ();
            }catch (err) {
            error ("Error complete " + err);
            }
        });
        this.file = file;
        this.mime = finfo.get_content_type ();
        this.size = finfo.get_size ();
        this.range = this.size - 1;
        this.date = new Date (finfo.get_attribute_uint64 (Gio.FILE_ATTRIBUTE_TIME_MODIFIED)*1000).toUTCString();
        this.num = request.num.toString();
        this.stream = null;
        this.offset = 0;
        this.uploaded = 0;
        this.wrotes = 0;
        this.reads = 0;
        this.read_event = 0;
        this.done = false;
        this.msg.request_headers.foreach ( (n, v) => {
            if (n.indexOf ("Range") > -1)
                if (v.indexOf ("bytes=") > -1) {
                    let s = v.slice (6).split("-");
                    if (s[0]) this.offset = parseInt(s[0]);
                    if (s[1]) this.range = parseInt(s[1]);
                }
        });
        this.range_type = (this.range - this.offset +1) < this.size;
        //debug ("Request(" + this.num + ") offset " + this.offset + ":" + this.range + " from " + this.size);
        if (this.offset >= this.size) {
            this.done = true;
            this.msg.set_status (200);
            this.msg.response_body.complete ();
            this.server.unpause_message (this.msg);
        }
        //debug ("Start steamimg");
        this.file.read_async (GLib.PRIORITY_DEFAULT, null, this.opened.bind (this));
    },

    wrote_chunk: function (sender, msg) {
        this.wrotes++;
    },

    opened: function (sender, result) {
        try {
            this.msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
            this.msg.response_headers.set_content_type (this.mime, null);
            this.msg.response_headers.set_content_length (this.range - this.offset + 1);
            this.msg.response_headers.append ("Last-Modified", this.date);
            this.msg.response_headers.append ("Accept-Ranges", "bytes");
            this.msg.response_headers.append ("Server", "Obmin");
            this.msg.response_headers.append ("Content-Disposition", "filename=\"" + this.file.get_basename () + "\"");
            this.msg.response_headers.set_content_range (this.offset,this.range,this.size);
            this.msg.response_body.set_accumulate (false);
            this.stream = this.file.read_finish (result);
            if ((this.version == 1) && this.range_type) this.msg.set_status (206);
            else this.msg.set_status (200);
            this.read_more (this.offset > 0);
        } catch (err) {
            error (err);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    read_more: function (seek) {
        if (this.read_event != 0) {
            GLib.source_remove (this.read_event);
            this.read_event = 0;
        }
        if (this.done) return;
        if (seek) this.stream.seek (this.offset, GLib.SeekType.SET, null);
        if ((this.reads - this.wrotes) > 32) {
            this.read_event = GLib.timeout_add (0, 250, this.read_more.bind (this));
            return;
        }
        if ((this.range - this.offset + 1) < this.BUFFER) this.BUFFER = this.range - this.offset + 1;
        this.stream.read_bytes_async (this.BUFFER, GLib.PRIORITY_DEFAULT, null, this.read_done.bind (this));
        this.reads++;
    },

    read_done: function (sender, result) {
        try {
            this.b = this.stream.read_bytes_finish (result);
            if (this.done) {
                //debug ("Stream " + this.num + " done");
                this.b = [];
                this.msg.response_body.complete ();
                this.stream.close_async (100, null, null);
                //counter.upload += this.b.get_size ();
                return;
            }
            if (this.b.get_size() == 0) {
                //debug (this.b + " " + this.b.get_size());
                this.done = true;
                this.msg.response_body.complete ();
                this.server.unpause_message (this.msg);
                this.stream.close_async (100, null, null);
            } else {
                this.offset += this.b.get_size ();
                this.msg.response_body.append_buffer (Soup.Buffer.new (this.b.get_data()));
                this.server.unpause_message (this.msg);
                this.uploaded += this.b.get_size ();
                if (this.offset < this.range)
                    this.read_event = GLib.timeout_add (0, 10, this.read_more.bind (this));
            }
        } catch (err) {
            error ("read_done" + err);
            if (this.offset == 0) this.msg.set_status (500);
            else this.msg.response_body.complete ();
            this.server.unpause_message (this.msg);
            this.done = true;
        }
    }
});

var PipeStream = new Lang.Class({
    Name: 'PipeStream',
    _init: function (server, request, args, name, mime, dir) {
        //debug (args);
        dir = dir || "/";
        this.BUFFER = 1048576;
        this.b = [];
        this.bsize = 0;
        this.offset = 0;
        this.server = server;
        this.msg = request.msg;
        this.version = this.msg.get_http_version ();
        this.msg.connect ("wrote-chunk", this.wrote_chunk.bind (this));
        this.msg.connect ("finished", () => {
            //debug ("PipeStream " + this.num + " finished");
            this.done = true;
            if (this.read_event != 0) {
                GLib.source_remove (this.read_event);
                this.read_event = 0;
            }
            try{if (this.stream) this.stream.close_async (100, null, null);
            }catch (err) {
            error ("Error close stream " + err);
            }
            this.b = [];
            try{this.msg.set_status (200);
            }catch (err) {
            error ("Error set status " + err);
            }
            try{
            this.msg.response_body.complete ();
            }catch (err) {
            error ("Error complete " + err);
            }
        });
        this.name = name;
        this.mime = mime;
        this.date = new Date().toUTCString();
        this.num = request.num.toString();
        this.stream = null;
        this.wrotes = 0;
        this.reads = 0;
        this.read_event = 0;
        this.done = false;
        this.add_headers ();
        this.stdout_fd = 0;
//        var filename = new_filename();
//        while (GLib.file_test (filename, GLib.FileTest.EXISTS))
//            filename = this.new_filename;
//        var f = Gio.File.new_for_path (filename);
//        this.test_ios = f.create_readwrite (Gio.FileCreateFlags.PRIVATE,null);
//        this.test_stream = this.test_ios.output_stream;

        try{
            let exit, pid, stdin_fd, stderr_fd;
            [exit, pid, stdin_fd, this.stdout_fd, stderr_fd] = GLib.spawn_async_with_pipes (dir,
                                            args,
                                            null,
                                            GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                            null);
            this.stdout = new Gio.UnixInputStream ({fd: this.stdout_fd, close_fd: true});
            this.stream = Gio.DataInputStream.new (this.stdout);
            this.stream.buffer_size = this.BUFFER;
            GLib.close (stdin_fd);
            //GLib.close (stderr_fd);
            let errchannel = GLib.IOChannel.unix_new (stderr_fd);
            GLib.io_add_watch (errchannel,0,GLib.IOCondition.IN | GLib.IOCondition.HUP, (channel, condition) => {
                if (condition == GLib.IOCondition.HUP) return false;
                try {
                var [,line,] = channel.read_line ();
                if (line) debug (line);
                } catch (e) {
                    return false;
                }
                return true;
            });
            let watch = GLib.child_watch_add (GLib.PRIORITY_DEFAULT, pid, (pid, status, o) => {
                //debug ("watch handler " + pid + ":" + status + ":" + o);
                GLib.source_remove (watch);
                //GLib.spawn_close_pid (pid);
            });
            this.read_more ();
        } catch (e) {
            error (e);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    wrote_chunk: function (sender, msg) {
        this.wrotes++;
    },

    add_headers: function (sender, result) {
        try {
            this.msg.response_headers.set_encoding (Soup.Encoding.CHUNKED);
            this.msg.response_headers.set_content_type (this.mime, null);
            this.msg.response_headers.append ("Last-Modified", this.date);
            this.msg.response_headers.append ("Server", "Obmin");
            this.msg.response_headers.append ("Content-Disposition", "filename=\"" + this.name + "\"");
            this.msg.response_body.set_accumulate (false);
            this.msg.set_status (200);
        } catch (e) {
            error (e);
            this.msg.set_status (500);
            this.server.unpause_message (this.msg);
        }
    },

    read_more: function () {
        if (this.read_event != 0) {
            GLib.Source.remove (this.read_event);
            this.read_event = 0;
        }
        if (this.done) return;
        if ((this.reads - this.wrotes) > 32) {
            this.read_event = GLib.timeout_add (0, 250, this.read_more.bind (this));
            return;
        }
        this.stream.read_bytes_async (this.BUFFER, GLib.PRIORITY_DEFAULT, null, this.read_done.bind (this));
        this.reads++;
    },

    read_done: function (sender, result) {
        try {
            this.b = this.stream.read_bytes_finish (result);
            if (this.b.get_size() == 0) {
                //debug ("read_done offset:" + this.offset);
                if (this.offset == 0) this.msg.set_status (500);
                else this.msg.set_status (200);
                this.complete ();
            } else if (this.done) {
                //debug ("Stream " + this.num + " done");
                this.msg.response_headers.set_content_length (this.offset);
                if (this.offset == 0) this.msg.set_status (500);
                else this.msg.set_status (200);
                this.complete ();
                return;
            } else {
                this.offset += this.b.get_size();
                //this.test_stream.write (this.b.get_data(),null);
                this.msg.response_body.append_buffer (Soup.Buffer.new (this.b.get_data()));
                this.server.unpause_message (this.msg);
                this.read_event = GLib.timeout_add (0, 10, this.read_more.bind (this));
            }
        } catch (err) {
            error ("read_done " + err);
            if (this.offset == 0) this.msg.set_status (500);
            else this.msg.set_status (200);
            this.complete ();
        }
    },

    complete: function () {
        this.done = true;
        try {
            this.msg.response_body.complete ();
            this.server.unpause_message (this.msg);
        } catch (e) {
            error (e.message);
        }
        try {
            GLib.close (this.stdout_fd);
        } catch (e) {
            error (e.message);
        }
        try {
            this.stream.close_async (100, null, null);
        } catch (e) {
            error (e.message);
        }
        //this.test_stream.close_async (100, null, null);
        this.b = [];
    }
});

function debug (text) {
    print ("streams", text);
}

function error (text) {
    printerr ("streams", text);
}
