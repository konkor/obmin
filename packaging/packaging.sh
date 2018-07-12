#!/bin/bash

VERSION=$(cat VERSION)

echo Version: $VERSION
rm -rf debs
mkdir debs
cd debs
ln -s ../../obmin-$VERSION.tar.xz obmin_$VERSION.orig.tar.xz
tar xf obmin_$VERSION.orig.tar.xz
cd obmin-$VERSION
cp -r ../../../debian/ .
debuild -us -uc
cp -f ../obmin_$VERSION-1_all.deb ../../../releases/obmin_latest_all.deb
