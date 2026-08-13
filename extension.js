import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const UPDATE_INTERVAL = 60; // seconds
const BAR_WIDTH = 220;      // px — fixed width for the progress bar fill calculation

// ── Data helpers ──────────────────────────────────────────────────────────────

function readFileSafe(path) {
    try {
        const [ok, bytes] = Gio.File.new_for_path(path).load_contents(null);
        return ok ? new TextDecoder().decode(bytes) : null;
    } catch (_) {
        return null;
    }
}

function formatTokens(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function formatRelative(ms, nowMs) {
    const diff = Math.max(0, nowMs - ms);
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function gatherStats() {
    const home     = GLib.get_home_dir();
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowMs    = Date.now();

    let inputTokens  = 0;
    let outputTokens = 0;
    let cacheRead    = 0;
    let promptsToday = 0;
    let lastActivity = null; // { ms, text }
    let activeSessions = 0;

    // ── Token usage from project conversation files ───────────────────────────
    const projectsDir = GLib.build_filenamev([home, '.claude', 'projects']);
    try {
        const projectEnum = Gio.File.new_for_path(projectsDir)
            .enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let projInfo;
        while ((projInfo = projectEnum.next_file(null)) !== null) {
            if (projInfo.get_file_type() !== Gio.FileType.DIRECTORY) continue;
            const projPath = GLib.build_filenamev([projectsDir, projInfo.get_name()]);
            const sessEnum = Gio.File.new_for_path(projPath)
                .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let sessInfo;
            while ((sessInfo = sessEnum.next_file(null)) !== null) {
                const name = sessInfo.get_name();
                if (!name.endsWith('.jsonl')) continue;
                const raw = readFileSafe(GLib.build_filenamev([projPath, name]));
                if (!raw) continue;
                for (const line of raw.split('\n')) {
                    if (!line || !line.includes('input_tokens')) continue;
                    try {
                        const entry = JSON.parse(line);
                        const ts = entry.timestamp;
                        if (!ts || !String(ts).startsWith(todayStr)) continue;
                        // Recursively find the first usage object
                        const usage = findUsage(entry);
                        if (usage) {
                            inputTokens  += usage.input_tokens                ?? 0;
                            outputTokens += usage.output_tokens               ?? 0;
                            cacheRead    += usage.cache_read_input_tokens      ?? 0;
                        }
                    } catch (_) {}
                }
            }
        }
    } catch (_) {}

    // ── Prompt count + last activity from history ─────────────────────────────
    const historyPath = GLib.build_filenamev([home, '.claude', 'history.jsonl']);
    const histRaw = readFileSafe(historyPath);
    if (histRaw) {
        for (const line of histRaw.split('\n')) {
            if (!line) continue;
            try {
                const entry = JSON.parse(line);
                const ts = entry.timestamp;
                if (!ts) continue;
                const date = new Date(ts).toISOString().slice(0, 10);
                if (date !== todayStr) continue;
                promptsToday++;
                if (!lastActivity || ts > lastActivity.ms) {
                    lastActivity = { ms: ts, text: entry.display ?? '' };
                }
            } catch (_) {}
        }
    }

    // ── Active sessions ───────────────────────────────────────────────────────
    const sessionsDir = GLib.build_filenamev([home, '.claude', 'sessions']);
    try {
        const sessEnum = Gio.File.new_for_path(sessionsDir)
            .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let si;
        while ((si = sessEnum.next_file(null)) !== null) {
            if (!si.get_name().endsWith('.json')) continue;
            const raw = readFileSafe(GLib.build_filenamev([sessionsDir, si.get_name()]));
            if (!raw) continue;
            try {
                const s = JSON.parse(raw);
                if (s.status === 'busy' || s.status === 'ready') activeSessions++;
            } catch (_) {}
        }
    } catch (_) {}

    return {
        inputTokens,
        outputTokens,
        cacheRead,
        totalTokens: inputTokens + outputTokens,
        promptsToday,
        activeSessions,
        lastTime: lastActivity ? formatRelative(lastActivity.ms, nowMs) : 'never',
        lastText: lastActivity?.text ?? '',
    };
}

function findUsage(obj, depth = 0) {
    if (depth > 6 || obj === null || typeof obj !== 'object') return null;
    if ('input_tokens' in obj) return obj;
    for (const v of Object.values(obj)) {
        const found = findUsage(v, depth + 1);
        if (found) return found;
    }
    return null;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default class ClaudeQuotaExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new PanelMenu.Button(0.0, 'Claude Quota', false);

        // Panel label
        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        const svgPath = GLib.build_filenamev([this.path, 'claude-code.svg']);
        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(svgPath),
            style_class: 'system-status-icon',
        });
        this._label = new St.Label({
            text: 'Claude …',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 4px;',
        });
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);

        // ── Popup menu ──────────────────────────────────────────────────────
        const menu = this._indicator.menu;

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Token Usage Today'));

        // Progress bar item
        const barItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        const barBox  = new St.BoxLayout({ vertical: true, x_expand: true, style: 'padding: 2px 0;' });

        const labelRow = new St.BoxLayout({ x_expand: true });
        this._barLabel   = new St.Label({ text: '—', x_expand: true });
        this._barPercent = new St.Label({ text: '—', x_align: Clutter.ActorAlign.END });
        labelRow.add_child(this._barLabel);
        labelRow.add_child(this._barPercent);

        this._barBg = new St.Widget({
            style: `width: ${BAR_WIDTH}px; height: 10px; background-color: rgba(255,255,255,0.15); border-radius: 5px; margin-top: 4px;`,
        });
        this._barFill = new St.Widget({
            style: `width: 0px; height: 10px; background-color: #57e389; border-radius: 5px;`,
        });
        this._barBg.add_child(this._barFill);

        barBox.add_child(labelRow);
        barBox.add_child(this._barBg);
        barItem.add_child(barBox);
        menu.addMenuItem(barItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Breakdown'));
        this._inputItem    = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._outputItem   = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._cacheItem    = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._promptsItem  = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._sessionsItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        menu.addMenuItem(this._inputItem);
        menu.addMenuItem(this._outputItem);
        menu.addMenuItem(this._cacheItem);
        menu.addMenuItem(this._promptsItem);
        menu.addMenuItem(this._sessionsItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Last prompt'));
        this._lastTimeItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._lastTextItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        menu.addMenuItem(this._lastTimeItem);
        menu.addMenuItem(this._lastTextItem);

        Main.panel.addToStatusArea('claude-quota', this._indicator);

        this._update();
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, UPDATE_INTERVAL, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
        this._settings = null;
        this._indicator?.destroy();
        this._indicator = null;
    }

    _update() {
        try {
            const stats = gatherStats();
            const limit = this._settings.get_int('daily-token-limit');
            const pct   = Math.min(1, stats.totalTokens / limit);
            const pctRounded = Math.round(pct * 100);

            // Panel label
            const badge = stats.activeSessions > 0 ? ` [${stats.activeSessions}]` : '';
            this._label.set_text(`⚡ ${formatTokens(stats.totalTokens)}${badge}`);

            // Progress bar fill + colour
            const fillPx = Math.max(0, Math.round(pct * BAR_WIDTH));
            const color   = pct < 0.6 ? '#57e389' : pct < 0.8 ? '#f5c211' : '#e01b24';
            this._barFill.style = `width: ${fillPx}px; height: 10px; background-color: ${color}; border-radius: 5px;`;
            this._barLabel.set_text(`${formatTokens(stats.totalTokens)} / ${formatTokens(limit)} tokens`);
            this._barPercent.set_text(`${pctRounded}%`);

            // Breakdown
            this._inputItem.label.set_text(`  Input:   ${formatTokens(stats.inputTokens)}`);
            this._outputItem.label.set_text(`  Output:  ${formatTokens(stats.outputTokens)}`);
            this._cacheItem.label.set_text(`  Cache read: ${formatTokens(stats.cacheRead)}`);
            this._promptsItem.label.set_text(`  Prompts today: ${stats.promptsToday}`);
            this._sessionsItem.label.set_text(`  Active sessions: ${stats.activeSessions}`);

            // Last prompt
            this._lastTimeItem.label.set_text(`  ${stats.lastTime}`);
            const preview = stats.lastText.length > 60
                ? stats.lastText.slice(0, 57) + '…'
                : stats.lastText;
            this._lastTextItem.label.set_text(`  ${preview || '—'}`);
        } catch (e) {
            this._label.set_text('Claude ?');
            console.error('[claude-quota]', e);
        }
    }
}
