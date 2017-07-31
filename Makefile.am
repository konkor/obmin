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

zip-file: all
	-rm -fR $(builddir)/_build
	-rm -fR $(builddir)/zip-files
	$(MKDIR_P) $(builddir)/_build; \
	$(MKDIR_P) $(builddir)/zip-files; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_build"; \
	mv "$(builddir)/_build/$(jsdir)" "$(builddir)/_build/"; \
	(cd "$(builddir)/_build/$(EXTENSION_ID)@konkor"; \
	 zip -qr "../../zip-files/$(EXTENSION_ID)@konkor.shell-extension.zip" .; \
	);
	-rm -fR $(builddir)/_build

