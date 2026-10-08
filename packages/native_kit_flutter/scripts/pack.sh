#!/usr/bin/env bash
# Pack native_kit_flutter into a zip for create-flutter-template vendor/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(awk '/^version:/{print $2; exit}' "$ROOT/pubspec.yaml")"
DIST="$ROOT/dist"
STAGE="$(mktemp -d)"
ZIP_NAME="native_kit_flutter-${VERSION}.zip"

mkdir -p "$DIST"
mkdir -p "$STAGE/native_kit_flutter"
rsync -a \
  --exclude '.dart_tool/' \
  --exclude 'build/' \
  --exclude 'example/' \
  --exclude 'dist/' \
  --exclude '.idea/' \
  --exclude '*.iml' \
  --exclude 'pubspec.lock' \
  --exclude '.flutter-plugins' \
  --exclude '.flutter-plugins-dependencies' \
  --exclude '.packages' \
  --exclude '**/build/' \
  --exclude 'scripts/' \
  "$ROOT/" "$STAGE/native_kit_flutter/"

(cd "$STAGE" && zip -qr "$DIST/$ZIP_NAME" native_kit_flutter)
rm -rf "$STAGE"
echo "Wrote $DIST/$ZIP_NAME"
ls -lh "$DIST/$ZIP_NAME"
