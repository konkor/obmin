schemadir=$(datadir)/gnome-shell/extensions/obmin@konkor/schemas
schema_DATA= \
    org.gnome.shell.extensions.obmin.gschema.xml \
    gschemas.compiled

gsettings_SCHEMAS = org.gnome.shell.extensions.obmin.gschema.xml
@GSETTINGS_RULES@

EXTRA_DIST = \
    $(schema_DATA) \
	$(gsettings_SCHEMAS) \
	$(NULL)
