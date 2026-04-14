#!/usr/bin/env bash
# Usage: ./generate_icons.sh /path/to/your/logo.png
# Requires: macOS (uses sips)
#
# Generates all required iOS app icon sizes from a 1024x1024 source image
# and places them in the Xcode AppIcon.appiconset directory.

set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  echo "Usage: $0 /path/to/logo.png"
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "Error: file not found: $SRC"
  exit 1
fi

DEST="$(dirname "$0")/ios/Runner/Assets.xcassets/AppIcon.appiconset"

declare -A ICONS=(
  ["Icon-App-20x20@1x.png"]=20
  ["Icon-App-20x20@2x.png"]=40
  ["Icon-App-20x20@3x.png"]=60
  ["Icon-App-29x29@1x.png"]=29
  ["Icon-App-29x29@2x.png"]=58
  ["Icon-App-29x29@3x.png"]=87
  ["Icon-App-40x40@1x.png"]=40
  ["Icon-App-40x40@2x.png"]=80
  ["Icon-App-40x40@3x.png"]=120
  ["Icon-App-60x60@2x.png"]=120
  ["Icon-App-60x60@3x.png"]=180
  ["Icon-App-76x76@1x.png"]=76
  ["Icon-App-76x76@2x.png"]=152
  ["Icon-App-83.5x83.5@2x.png"]=167
  ["Icon-App-1024x1024@1x.png"]=1024
)

echo "Generating icons from: $SRC"
for FILENAME in "${!ICONS[@]}"; do
  SIZE="${ICONS[$FILENAME]}"
  OUT="$DEST/$FILENAME"
  sips -z "$SIZE" "$SIZE" "$SRC" --out "$OUT" > /dev/null
  echo "  ✓ ${FILENAME} (${SIZE}x${SIZE})"
done

echo ""
echo "Done! All icons written to:"
echo "  $DEST"
echo ""
echo "Next: flutter build ios --no-codesign"
