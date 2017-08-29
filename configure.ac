dnl Process this file with autoconf to produce a configure script.

AC_INIT(obmin, 2.0)

AC_CONFIG_HEADERS([config.h])

AC_PREFIX_DEFAULT(~/.local/share/gnome-shell/extensions)

AM_INIT_AUTOMAKE([1.10 dist-xz no-dist-gzip foreign tar-ustar])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

AC_PATH_PROG([DESKTOP_FILE_VALIDATE], [desktop-file-validate], [/bin/true])

LT_INIT

AC_OUTPUT([
Makefile
data/Makefile
data/icons/Makefile
data/www/Makefile
data/themes/Makefile
schemas/Makefile
])
