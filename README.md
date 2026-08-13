# Claude Code Quota Monitor

A GNOME Shell extension that shows your [Claude Code](https://claude.ai/code) token usage and a live progress bar in the top bar.

## What it shows

**In the top bar:**
- Claude Code icon + `32.2K` — tokens used today (input + output)
- Claude Code icon + `32.2K [1]` — with an active Claude Code session running

**Click to expand:**

```
── Token Usage Today ──────────────────
  32.2K / 500K tokens          6%
  [████░░░░░░░░░░░░░░░░░░░░░░░░]

── Breakdown ──────────────────────────
  Input:        0.1K
  Output:       32.2K
  Cache read:   1.2M
  Prompts today: 12
  Active sessions: 1

── Last prompt ────────────────────────
  5m ago
  "add a progress bar to the token usage"
```

The progress bar turns **yellow** at 60% and **red** at 80% of your daily limit.

## Requirements

- GNOME Shell 45, 46, or 47
- [Claude Code](https://claude.ai/code) installed and used at least once

## Installation

```bash
git clone https://github.com/joaovtacabral/claude-quota-gnome.git
cd claude-quota-gnome
bash install.sh
```

Then enable the extension:

```bash
gnome-extensions enable claude-quota@monitor
```

Or use the **Extensions** app (available in Ubuntu Software) to toggle it on.

> If GNOME Shell doesn't pick it up, restart it with `Alt+F2` → type `r` → `Enter`.

## Configuring the daily token limit

Open preferences to set your daily token budget (default: 500 000):

```bash
gnome-extensions prefs claude-quota@monitor
```

Or go to **Settings → Extensions → Claude Code Quota Monitor → Preferences**.

## How it works

Reads token usage directly from `~/.claude/projects/**/*.jsonl` — the same files Claude Code uses to store conversation history. No API key required, no network requests.

Updates every 60 seconds.

## Icon

The panel icon is `claude-code.svg`, bundled with the extension and loaded directly from disk — no system icon theme required. To swap it out, replace `claude-code.svg` in the extension directory (`~/.local/share/gnome-shell/extensions/claude-quota@monitor/`) with any same-named SVG and restart GNOME Shell.

## License

MIT
