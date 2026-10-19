# Maintainer: obrienck
# Local/dev package — builds C-Note directly from this source checkout.
# Usage: makepkg -si   (run from the repo root)
pkgname=c-note
pkgver=0.1.0
pkgrel=1
pkgdesc="A hi-fi desktop music player for collectors"
arch=('x86_64')
url="https://github.com/obrienck/C-Note"
license=('custom')
depends=('gtk3' 'nss' 'alsa-lib' 'libxss' 'libnotify' 'at-spi2-core' 'libdrm' 'mesa' 'libxkbcommon' 'libsecret')
makedepends=('nodejs' 'npm')
options=('!strip' '!emptydirs')
source=()
sha256sums=()

# Build out-of-tree: electron-builder walks the whole project directory
# when packaging, so it must not see makepkg's own src/pkg scratch dirs.
_repo="$startdir"
_build="/tmp/makepkg-c-note-build"

pkgver() {
  cd "$_repo"
  grep -m1 '"version"' package.json | sed -E 's/.*"version": *"([^"]+)".*/\1/'
}

prepare() {
  rm -rf "$_build"
  mkdir -p "$_build"
  tar --exclude='./node_modules' --exclude='./dist' --exclude='./dist-electron' --exclude='./release' --exclude='./.git' \
    -cf - -C "$_repo" . | tar -xf - -C "$_build"
}

build() {
  cd "$_build"
  npm ci
  npm run build:unpack
}

package() {
  cd "$_build"

  install -dm755 "$pkgdir/opt/c-note"
  cp -a release/linux-unpacked/. "$pkgdir/opt/c-note/"

  # Electron's setuid sandbox helper must be root-owned and setuid to work.
  chmod 4755 "$pkgdir/opt/c-note/chrome-sandbox"
  chown root:root "$pkgdir/opt/c-note/chrome-sandbox"

  install -dm755 "$pkgdir/usr/bin"
  ln -s /opt/c-note/c-note "$pkgdir/usr/bin/c-note"

  install -Dm644 build/icon.png "$pkgdir/usr/share/icons/hicolor/1024x1024/apps/c-note.png"
  install -Dm644 "$_repo/c-note.desktop" "$pkgdir/usr/share/applications/c-note.desktop"
}
