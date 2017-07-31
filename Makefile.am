## Process this file with automake to produce Makefile.in

EXTENSION_ID = obmin

packagedir = gnome-shell/extensions

SUBDIRS = data schemas

jsdir = $(prefix)/$(EXTENSION_ID)@konkor
js_DATA = \
    README.md \
	metadata.json \
	stylesheet.css

js_SCRIPTS = extension.js prefs.js convenience.js obmin-server obmin-preferences

EXTRA_DIST = $(js_DATA)

uninstall-local:
	-rm -r $(jsdir)
