#!/usr/bin/env bash
set -e

DEST="$HOME/.local/share/gnome-shell/extensions/claude-quota@monitor"

echo "Atualizando Claude Code Quota Monitor..."
git pull
mkdir -p "$DEST"
cp metadata.json extension.js claude-code.svg "$DEST/"

echo ""
echo "Atualizado! Reinicie o GNOME Shell: Alt+F2 → r → Enter"
