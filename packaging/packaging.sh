#!/bin/bash

VERSION="3.0"

rm -rf debs
mkdir debs
cd debs
ln -s ../../obmin-$VERSION.tar.xz obmin_$VERSION.orig.tar.xz
tar xf obmin_$VERSION.orig.tar.xz
cd obmin-$VERSION
cp -r ../../../debian/ .
debuild -us -uc
