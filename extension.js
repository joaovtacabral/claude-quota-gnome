import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const HISTORY_PATH = GLib.build_filenamev([GLib.get_home_dir(), '.claude', 'history.jsonl']);
const SESSIONS_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.claude', 'sessions']);
const UPDATE_INTERVAL = 60; // seconds

function readFile(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const [ok, bytes] = file.load_contents(null);
        if (!ok) return null;
        return new TextDecoder().decode(bytes);
    } catch (_) {
        return null;
    }
}

function getUsageStats() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let todayCount = 0;
    let totalCount = 0;
    let lastPrompt = null;

    const raw = readFile(HISTORY_PATH);
    if (raw) {
        for (const line of raw.trim().split('\n')) {
            if (!line) continue;
            try {
                const entry = JSON.parse(line);
                const ts = entry.timestamp;
                if (!ts) continue;
                totalCount++;
                const date = new Date(ts).toISOString().slice(0, 10);
                if (date === todayStr) {
                    todayCount++;
                    if (!lastPrompt || ts > lastPrompt.ts) {
                        lastPrompt = { ts, text: entry.display || '' };
                    }
                }
            } catch (_) { /* skip malformed lines */ }
        }
    }

    // Count active sessions
    let activeSessions = 0;
    try {
        const sessDir = Gio.File.new_for_path(SESSIONS_DIR);
        const enumerator = sessDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (!name.endsWith('.json')) continue;
            const sessPath = GLib.build_filenamev([SESSIONS_DIR, name]);
            const content = readFile(sessPath);
            if (content) {
                try {
                    const sess = JSON.parse(content);
                    if (sess.status === 'busy' || sess.status === 'ready') activeSessions++;
                } catch (_) {}
            }
        }
    } catch (_) {}

    const lastTime = lastPrompt
        ? formatRelative(new Date(lastPrompt.ts), now)
        : 'never';

    return { todayCount, totalCount, activeSessions, lastTime, lastText: lastPrompt?.text || '' };
}

function formatRelative(date, now) {
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default class ClaudeQuotaExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Claude Quota', false);

        // Icon + label in the panel
        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this._icon = new St.Icon({
            icon_name: 'dialog-information-symbolic',
            style_class: 'system-status-icon',
        });
        this._label = new St.Label({
            text: 'Claude …',
            y_align: 2, // CLUTTER_ACTOR_ALIGN_CENTER
            style: 'margin-left: 4px;',
        });
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);

        // Popup menu items
        this._todayItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._totalItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._sessionItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._lastItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._lastTextItem = new PopupMenu.PopupMenuItem('', { reactive: false });

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Claude Code Usage'));
        this._indicator.menu.addMenuItem(this._todayItem);
        this._indicator.menu.addMenuItem(this._totalItem);
        this._indicator.menu.addMenuItem(this._sessionItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Last prompt'));
        this._indicator.menu.addMenuItem(this._lastItem);
        this._indicator.menu.addMenuItem(this._lastTextItem);

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
        this._indicator?.destroy();
        this._indicator = null;
    }

    _update() {
        try {
            const stats = getUsageStats();
            const sessionBadge = stats.activeSessions > 0 ? ` [${stats.activeSessions} active]` : '';
            this._label.set_text(`⚡ ${stats.todayCount}${sessionBadge}`);

            this._todayItem.label.set_text(`Today: ${stats.todayCount} prompt${stats.todayCount !== 1 ? 's' : ''}`);
            this._totalItem.label.set_text(`All time: ${stats.totalCount} prompts`);
            this._sessionItem.label.set_text(`Active sessions: ${stats.activeSessions}`);
            this._lastItem.label.set_text(`Last activity: ${stats.lastTime}`);

            const preview = stats.lastText.length > 60
                ? stats.lastText.slice(0, 57) + '…'
                : stats.lastText;
            this._lastTextItem.label.set_text(preview || '—');
        } catch (e) {
            this._label.set_text('Claude ?');
            console.error('[claude-quota]', e);
        }
    }
}
