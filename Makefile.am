## Process this file with automake to produce Makefile.in

EXTENSION_ID = obmin

packagedir = gnome-shell/extensions

DIST_SUBDIRS = man data schemas po common plugins

SUBDIRS = man data schemas po common plugins

jsdir = $(datadir)/$(packagedir)/$(EXTENSION_ID)@konkor
js_DATA = \
    README.md \
	INSTALL.md \
    extension.js \
    prefs.js \
    convenience.js \
	metadata.json \
	stylesheet.css \
	config_sample.json

js_SCRIPTS = obmin-server \
    obmin-preferences \
    obmin-indicator \
    obmin-center \
    obmin-extensions

bin_SCRIPTS = obmin-server \
    obmin-preferences \
    obmin-indicator \
    obmin-center \
    obmin-extensions

dist_js_DATA = $(js_SCRIPTS)

dist_doc_DATA = \
	README.md \
	config_sample.json

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
	cp -r "$(builddir)/_build$(datadir)/locale" "$(builddir)/_build/$(EXTENSION_ID)@konkor"; \
	(cd "$(builddir)/_build/$(EXTENSION_ID)@konkor"; \
	 zip -qr "../../zip-files/$(EXTENSION_ID)@konkor.zip" .; \
	);
	-rm -fR $(builddir)/_build

