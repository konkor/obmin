dnl Process this file with autoconf to produce a configure script.

AC_INIT(obmin, 3.0)

AC_CONFIG_HEADERS([config.h])

AC_PREFIX_DEFAULT(~/.local/share/gnome-shell/extensions)

AM_INIT_AUTOMAKE([1.10 dist-xz no-dist-gzip foreign tar-ustar])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

LT_INIT

GETTEXT_PACKAGE=gnome-shell-extensions-obmin
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE, "$GETTEXT_PACKAGE",
                   [The prefix for our gettext translation domains.])
IT_PROG_INTLTOOL()

AC_PATH_PROG([DESKTOP_FILE_VALIDATE], [desktop-file-validate], [/bin/true])

AC_OUTPUT([
Makefile
data/Makefile
data/icons/Makefile
data/www/Makefile
data/themes/Makefile
schemas/Makefile
po/Makefile.in
])
