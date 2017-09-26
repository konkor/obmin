#the application icon
iconsdir=$(datadir)/gnome-shell/extensions/obmin@konkor/data/icons
icons_DATA= \
    obmin-run.png \
    obmin-off.png \
    obmin-on.png \
    pp.svg \
    pp.png

#the application icon
icondir=$(datadir)/icons
nobase_icon_DATA = hicolor/scalable/apps/obmin.svg \
    hicolor/32x32/status/obmin-run.png \
    hicolor/32x32/status/obmin-off.png \
    hicolor/32x32/status/obmin-on.png \
    hicolor/32x32/apps/obmin.png \
    $(NULL)

EXTRA_DIST = \
        $(icons_DATA) \
        $(nobase_icon_DATA)

gtk_update_icon_cache = gtk-update-icon-cache -f -t $(datadir)/icons/hicolor

install-data-hook: update-icon-cache
uninstall-hook: update-icon-cache
update-icon-cache:
	@-if test -z "$(DESTDIR)"; then                                           \
		echo "Updating Gtk icon cache.";                                  \
		$(gtk_update_icon_cache);                                         \
	else                                                                      \
		echo "*** Icon cache not updated.  After (un)install, run this:"; \
		echo "***   $(gtk_update_icon_cache)";                            \
	fi

