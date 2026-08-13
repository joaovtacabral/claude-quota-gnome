# Claude Code Quota Monitor

A GNOME Shell extension that shows your [Claude Code](https://claude.ai/code) usage stats directly in the top bar.

![GNOME top bar showing: ⚡ 12 [1 active]](https://via.placeholder.com/400x40/1a1a2e/ffffff?text=%E2%9A%A1+12+%5B1+active%5D)

## What it shows

**In the top bar:**
- `⚡ 5` — prompts sent today
- `⚡ 5 [1 active]` — with an active Claude Code session running

**Click to expand:**
- Today's prompt count
- All-time total prompts
- Active session count
- Last activity time (e.g. "5m ago", "2h ago")
- Preview of your last prompt

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

> If GNOME Shell doesn't pick it up immediately, restart it with `Alt+F2` → type `r` → `Enter`.

## How it works

Reads from `~/.claude/history.jsonl` and `~/.claude/sessions/` — fully local, no API key required, no network requests.

Updates every 60 seconds.

## License

MIT
