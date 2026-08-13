#!/usr/bin/env bash
set -e

DEST="$HOME/.local/share/gnome-shell/extensions/claude-quota@monitor"

echo "Installing Claude Code Quota Monitor..."
mkdir -p "$DEST/schemas"
cp metadata.json extension.js prefs.js claude-code.svg "$DEST/"
cp schemas/org.gnome.shell.extensions.claude-quota.gschema.xml "$DEST/schemas/"

echo "Compiling GSettings schema..."
glib-compile-schemas "$DEST/schemas/"

echo ""
echo "Done! Enable with:"
echo "  gnome-extensions enable claude-quota@monitor"
echo ""
echo "Then restart GNOME Shell: Alt+F2 → r → Enter"
echo "Open preferences: gnome-extensions prefs claude-quota@monitor"
