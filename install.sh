#!/usr/bin/env bash
set -e

DEST="$HOME/.local/share/gnome-shell/extensions/claude-quota@monitor"

echo "Installing Claude Code Quota Monitor extension..."
mkdir -p "$DEST"
cp metadata.json extension.js "$DEST/"

echo "Done. Now enable it:"
echo "  gnome-extensions enable claude-quota@monitor"
echo ""
echo "Or use GNOME Extensions app / Extensions Manager to toggle it on."
echo "You may need to restart GNOME Shell first: Alt+F2 → r → Enter"
