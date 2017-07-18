# [OBMIN](https://extensions.gnome.org/extension/1254/obmin/)
**One-Click** File Sharing Solution for your home network or/and even worldwide.
-----
_It's very first alpha version. So the project can have some issues and it's looking for [your contribution](#contributions) for better supporting and growing._

![screencast](https://user-images.githubusercontent.com/1944781/27997375-a73383c2-64ff-11e7-8a86-b9fddca45f42.png)

**Obmin** is lightweight HTTP/File Server solution for GNU/Linux systems. The solution divided into a few parts to be more lightweight and flexible. Now Here's two parts: the server backend and the Gnome Shell Extension to control, run and monitor server part with preferences graphical frontend. In the near feature here could be more frontends for Unity/Elementary OS etc.

## Main Features
* Easy installation.
* Easy setup just choose file(s) locations and click Obmin on.
* Doesn't require ROOT privileges.
* Doesn't require any special client side installation.
* HTTP transfer protocol available everywhere Linux, OSX, Windows, Android, iOS so.

## Enchanted Features
* Multiple file sources supporting.
* Content filters: symbolic links, backups, hidden files.
* Port configuration.
* Content theming.

## Planned Features
* Secure HTTPS connections.
* HTTP authorization.
* Detailed statistic about traffic, incoming connections so.
* Other security options like run on a local home network only.
* Allowed IP Addresses.
* Embedded JavaScript applications for compressing, slideshow, music player, playlist/file lists generator, video player.
* More

## Contributions
* Report [a bug](https://github.com/konkor/obmin/issues).
* Test it on your favorite Linux distribution.
* Contribute with an idea, graphical content, translation or code.

## Installation
## Dependencies
* gjs (apt-get install gjs)
* Gnome Shell 3.14+ (the extension only)

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
