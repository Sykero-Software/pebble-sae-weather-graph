#!/usr/bin/env bash
set -euo pipefail

EMULATOR="${PEBBLE_EMULATOR:-emery}"
SS_DIR="screenshots"
RAW_DIR="$SS_DIR/raw_png"
mkdir -p "$RAW_DIR" "$SS_DIR"

ss_index=0
ss() {
    local filename
    filename="$(printf '%s/%03d_%s.png' "$RAW_DIR" "$ss_index" "$1")"
    pebble screenshot --emulator "$EMULATOR" --no-open "$filename"
    ss_index=$((ss_index + 1))
}

btn() {
    pebble emu-button --emulator "$EMULATOR" click "$1"
}

echo "Building and installing..."
make install_emulator

echo "Waiting 10 seconds for app to start..."
sleep 10

# ---- GIF 1: zoom-out, toggle mode, scroll up, toggle back ----
# Initial state
ss "start"

# Press down twice (zoom out to 5-day view)
ss "before_down_1"
btn down; ss "down_1"
ss "before_down_2"
btn down; ss "down_2"

# Press select (e.g. open popup / toggle something)
ss "before_select_1"
btn select; ss "select_1_a"; ss "select_1_b"

# Press up 8 times (scroll)
ss "before_up_1"
btn up; ss "up_1"
ss "before_up_2"
btn up; ss "up_2"
ss "before_up_3"
btn up; ss "up_3"
ss "before_up_4"
btn up; ss "up_4"
ss "before_up_5"
btn up; ss "up_5"
ss "before_up_6"
btn up; ss "up_6"
ss "before_up_7"
btn up; ss "up_7"
ss "before_up_8"
btn up; ss "up_8"

# Press select again
ss "before_select_2"
btn select; ss "select_2_a"; ss "select_2_b"

ss "end"

echo "Done. Raw screenshots saved to $RAW_DIR/"

echo "Copying selected screenshots..."
cp "$RAW_DIR/000_start.png"      "$SS_DIR/screenshot_02.png"
cp "$RAW_DIR/006_select_1_a.png" "$SS_DIR/screenshot_03.png"
echo "Selected screenshots saved to $SS_DIR/"

echo "Creating GIF 1..."
magick -delay 60 -loop 0 "$RAW_DIR"/*.png -layers Optimize "$SS_DIR/screenshot_01.gif"
xattr -dr com.apple.quarantine "$SS_DIR/screenshot_01.gif" 2>/dev/null || true
echo "GIF saved to $SS_DIR/screenshot_01.gif"
