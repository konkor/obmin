# [OBMIN](https://extensions.gnome.org/extension/1254/obmin/)
**One-Click** File Sharing Solution for your home network and even worldwide.
-----
_The project is under development. So the project can have some issues and it's looking for [your contribution](#contributions) for better supporting and growing._

![screencast](https://user-images.githubusercontent.com/1944781/27997375-a73383c2-64ff-11e7-8a86-b9fddca45f42.png)

**Obmin** has convenient user-friendly systray applets for many Desktop Environments like Gnome Shell, Unity, KDE, Mate, LXDE, XFCE, Cinnamon, Pantheon, Budgie DE through the **obmin-indicator** and [Gnome Obmin Extension](https://extensions.gnome.org/extension/1254/obmin/).

## Main Features
* Easy installation.
* Easy setup just choose file(s) locations and click Obmin on.
* Doesn't require ROOT privileges.
* Doesn't require any special client side installation.
* HTTP(S) transfer protocol available everywhere Linux, OSX, Windows, Android, iOS so.
* Secure HTTPS connections.

## Enchanted Features
* Multiple file sources supporting.
* Content filters: symbolic links, backups, hidden files.
* Port configuration.
* TLS Certificate generating.
* Logging of detailed server connections information.
* Real-time monitor of incoming connections and traffic.
* Content theming.
* Various Linux Desktop Environments and distributions.
* Obmin extensions like compressor, slideshow, playlist generator.
* Real-time video streamer with build-in remuxing and encoding.

## Planned Features
* Project website (GitHub Pages).
* Improve logging and monitors.
* More useful extensions.
* Online service to enhance obmin connectivity (need donations).

## Project [Wiki](https://github.com/konkor/obmin/wiki)

## Contributions
* Report [a bug](https://github.com/konkor/obmin/issues).
* Test it on your favorite Linux distribution.
* Contribute with an idea, graphical content, translation or code [an issue](https://github.com/konkor/obmin/issues).
* Make donation to the project:
 * [PayPal EURO](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WVAS5RXRMYVC4)
 * [PayPal USD](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HGAFMMMQ9MQJ2)
* Contact to the author [here](https://konkor.github.io/index.html#contact).

_Behind the development for the Linux Desktop are ordinary people who spend a lot of time and their own resources to make the Linux Desktop better. Thank you for your contributions!_


## Installation
### Dependencies
* gjs (core dependency)
* GTK3 libraries:
 * gir1.2-atk-1.0
 * gir1.2-glib-2.0
 * gir1.2-gtk-3.0
 * gir1.2-soup-2.4
* psmisc (mics tools for applets)
* gir1.2-appindicator3 (the obmin-indicator for non-Gnome shell extension)
* Gnome Shell 3.14+ (for gnome extension only)

Debian/Ubuntu flavors:
```
sudo apt-get update
sudo apt-get install gjs gir1.2-gtk-3.0 gir1.2-soup-2.4 psmisc gir1.2-appindicator3
```

### Install From Gnome repository [extensions.gnome.org](https://extensions.gnome.org/extension/1254/obmin/)

_Notice about Gnome repository a releasing can take some time from few hours to few weeks here._ So to install the latest stable version you can install it via [Gnome extension package](https://github.com/konkor/obmin/raw/master/releases/obmin%40konkor.zip) through gnome-tweak-tool or simply by extracting the downloaded package to ~/.local/share/gnome-shell/extensions/obmin@konkor home folder.

**Remember** if you have installed Obmin on the system widely by deb package or manual installation the local extension installation has a priority and overriding system installation on Gnome Shell. So if you want to install newest different version you have to remove the local installation first at [Installed Extensions](https://extensions.gnome.org/local/) page.

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
 * user's **Log-out/Log-in** (_X11/Wayland_)
 * <kbd>Alt</kbd>+<kbd>F2</kbd> and enter <kbd>r</kbd> command (_X11 only_)
 * or just **reboot** PC (_X11/Wayland_)
4. Turn on the extension
 * [local extensions page](https://extensions.gnome.org/local/)
 * or `gnome-shell-extension-prefs` tool
 * or in the `gnome-tweak-tool`

[More about compilation and installation...](https://github.com/konkor/obmin/blob/master/INSTALL.md)

### Sources and binary packages
* [GitHub master branch](https://github.com/konkor/obmin/archive/master.zip)
* [GitHub development branch](https://github.com/konkor/obmin/archive/devel.zip)
* [Gnome extensions repository](https://extensions.gnome.org/extension/1254/obmin/)
* [Latest deb package for Debian/Ubuntu flavors](https://github.com/konkor/obmin/raw/devel/releases/obmin_latest_all.deb)
