#!/usr/bin/gjs

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

GLib.listenv().forEach (s=>{print (s, GLib.getenv (s));});

