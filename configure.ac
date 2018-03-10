dnl Process this file with autoconf to produce a configure script.

AC_INIT(obmin, 15)

AC_CONFIG_HEADERS([config.h])

AC_PREFIX_DEFAULT(~/.local/share/gnome-shell/extensions)

AM_INIT_AUTOMAKE([1.10 dist-xz no-dist-gzip foreign tar-ustar])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

LT_INIT

GLIB_GSETTINGS

GETTEXT_PACKAGE=gnome-shell-extensions-obmin
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE, "$GETTEXT_PACKAGE",
                   [The prefix for our gettext translation domains.])
IT_PROG_INTLTOOL()

AC_PATH_PROG([DESKTOP_FILE_VALIDATE], [desktop-file-validate], [/bin/true])

dnl Packaging version
echo "${VERSION}" > packaging/VERSION

AC_OUTPUT([
Makefile
common/Makefile
plugins/Makefile
man/Makefile
data/Makefile
data/icons/Makefile
data/www/Makefile
data/www/themes/Makefile
data/themes/Makefile
schemas/Makefile
po/Makefile.in
metadata.json
])

echo "

                    ${PACKAGE} ${VERSION}
                    =========
"
