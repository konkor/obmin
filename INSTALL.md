# [OBMIN](https://extensions.gnome.org/extension/1254/obmin/)
**One-Click** File Sharing Solution over a network.
-----

## Installation
### Dependencies
* gjs
* GTK3 libraries:
 * gir1.2-atk-1.0
 * gir1.2-clutter-1.0
 * gir1.2-glib-2.0
 * gir1.2-gtk-3.0
 * gir1.2-soup-2.4
* psmisc, curl
* gir1.2-appindicator3 (the obmin-indicator gor non-Gnome shell extension)
* Gnome Shell 3.14+ (the gnome version only)

```
sudo apt-get update
sudo apt-get install gjs gir1.2-atk-1.0 gir1.2-glib-2.0 gir1.2-gtk-3.0 gir1.2-soup-2.4 psmisc curl gir1.2-appindicator3
```

### Official repository [extensions.gnome.org](https://extensions.gnome.org/extension/1254/obmin/)

### Install from GitHub branch (default master)
1. Download [install_obmin.sh](https://github.com/konkor/obmin/raw/master/install_obmin.sh)
```
wget https://github.com/konkor/obmin/raw/master/install_obmin.sh
chmod +x ./install_obmin.sh
```
2. Run install script
```
./install_obmin.sh
```
or for `devel` branch to example
```
./install_obmin.sh devel
```
3. Restart Gnome to reload extensions by:
 * user's `Log-out/Log-in` (_X11/Wayland_)
 * Alt-F2 `r` command (_X11 only_)
 * or just reboot PC (_X11/Wayland_)
4. Turn on the extension
 * [local extensions page](https://extensions.gnome.org/local/)
 * or `gnome-shell-extension-prefs` tool
 * or in the `gnome-tweak-tool`

### From the sources
```
git clone git@github.com:konkor/obmin.git
cd obmin
./autogen.sh
make
make zip-file
```
To make a distribution source package:
```
make dist
```
To make a deb package for the package manager:
```
make dist
cd packaging
./packaging.sh
```
### Sources and binary packages
* [GitHub master branch](https://github.com/konkor/obmin/archive/master.zip)
* [GitHub development branch](https://github.com/konkor/obmin/archive/devel.zip)
* [Gnome extensions repository](https://extensions.gnome.org/extension/1254/obmin/)
* [Latest Debian/Ubuntu flavors](https://github.com/konkor/obmin/raw/devel/releases/obmin_latest_all.deb)
