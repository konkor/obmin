# [OBMIN](https://extensions.gnome.org/extension/1254/obmin/)
**One-Click** File Sharing Solution over a network.
-----

## Installation
### Dependencies
* gjs (core dependency)
* GTK3 libraries:
 * gir1.2-atk-1.0
 * gir1.2-glib-2.0
 * gir1.2-gtk-3.0
 * gir1.2-soup-2.4
* psmisc, curl or wget (mics tools for applets)
* gir1.2-appindicator3 (the obmin-indicator for non-Gnome shell extension)
* Gnome Shell 3.14+ (the gnome version only)
* Font Roboto (recommended for the client side browsers)

```
sudo apt-get update
sudo apt-get install gjs gir1.2-atk-1.0 gir1.2-glib-2.0 gir1.2-gtk-3.0 gir1.2-soup-2.4 psmisc curl gir1.2-appindicator3
```

### Install From Gnome repository [extensions.gnome.org](https://extensions.gnome.org/extension/1254/obmin/)
_Notice about Gnome repo a releasing can take some time from few hours to few weeks here._

### Install on Debian/Ubuntu flavors [binary package](#sources-and-binary-packages)
`This method is useful for almost distributions and desktop environments`
1. Download the [debian package](https://github.com/konkor/obmin/raw/master/releases/obmin_latest_all.deb) from the stable branch or the [devel branch](https://github.com/konkor/obmin/raw/devel/releases/obmin_latest_all.deb).
2. Open terminal where is the deb package was downloaded. _If you are running an Ubuntu flavor make sure `universe` repository is enabled in the sources._
```
sudo su
apt-get update
dpkg -i obmin_latest_all.deb
apt-get -f install
# optional you can install Roboto font
apt-get install fonts-roboto
exit
```

### Running without installation from [zip package](#sources-and-binary-packages)
`This method is useful for almost distributions and desktop environments`
1. Download the [zip package](https://github.com/konkor/obmin/raw/master/releases/obmin@konkor.zip) from the stable branch or the [devel branch](https://github.com/konkor/obmin/raw/devel/releases/obmin@konkor.zip) and extract it.
2. Install dependencies for apt based distributions:
```
sudo apt-get update
sudo apt-get install gjs gir1.2-atk-1.0 gir1.2-glib-2.0 gir1.2-gtk-3.0 gir1.2-soup-2.4 psmisc curl gir1.2-appindicator3
```
3. Open terminal where is the zip package was extracted.
```
# to run the obmin systray applet
./obmin-indicator
# to open the obmin preferences window
./obmin-preferences
# to run the obmin server from the terminal
./obmin-server
```
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
or for **devel** branch to example
```
./install_obmin.sh devel
```
3. Restart Gnome to reload extensions by:
 * user's **Log-out / Log-in** (_X11/Wayland_)
 * <kbd>Alt</kbd>+<kbd>F2</kbd> and enter <kbd>r</kbd> command (_X11 only_)
 * or just **reboot** PC (_X11/Wayland_)
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

## Check your installation
1. Enable Obmin Server from user interface or run it in terminal.
2. Open your browser and enter the local IP address and obmin server port (default 8088). So you can look your local address in the gnome or obmin-indicator applets it's looking like http://192.168.1.10:8088 to an example or just enter localhost:8088. You should see obmin home page with selected file locations or link to your Home Folder if it's not configured yet.
3. Now you can check it from other devices (mobile phones, other machines) connected to the same the network. Do the same at 2 for your local IP address (ex. http://192.168.1.10:8088). `If not you have to check your Firewalls on the server and/or guest sides.`
