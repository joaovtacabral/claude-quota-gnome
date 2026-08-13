import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const API_URL      = 'https://api.anthropic.com/api/oauth/usage';
const API_BETA     = 'oauth-2025-04-20';
const API_INTERVAL = 2 * 60;  // segundos entre chamadas à API
const LOCAL_INTERVAL = 60;    // segundos entre leituras locais
const BAR_WIDTH    = 220;     // px

const GROUP_LABELS = {
    session: 'Sessão',
    daily:   'Diário',
    weekly:  'Semanal',
    monthly: 'Mensal',
};

// ── Utilitários ───────────────────────────────────────────────────────────────

function readFileSafe(path) {
    try {
        const [ok, bytes] = Gio.File.new_for_path(path).load_contents(null);
        return ok ? new TextDecoder().decode(bytes) : null;
    } catch (_) { return null; }
}

function formatRelative(ms, nowMs) {
    const diff = Math.max(0, nowMs - ms);
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'agora mesmo';
    if (mins < 60) return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `há ${hrs}h`;
    return `há ${Math.floor(hrs / 24)}d`;
}

function formatResetsAt(isoStr) {
    const diff = new Date(isoStr).getTime() - Date.now();
    if (diff <= 0) return 'menos de 1min';
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `reseta em ${mins}min`;
    const hrs  = Math.floor(mins / 60);
    const remM = mins % 60;
    if (hrs < 24) return `reseta em ${hrs}h ${remM ? `${remM}min` : ''}`;
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return `reseta em ${days}d ${remH ? `${remH}h` : ''}`;
}

// ── Credenciais ───────────────────────────────────────────────────────────────

function readCredentials() {
    const path = GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
    const raw  = readFileSafe(path);
    if (!raw) return null;
    try {
        const creds = JSON.parse(raw);
        const oauth = creds?.claudeAiOauth;
        if (!oauth?.accessToken) return null;
        if (oauth.expiresAt && Date.now() > oauth.expiresAt) return null;
        return {
            token: oauth.accessToken,
            plan:  oauth.subscriptionType ?? null,
        };
    } catch (_) { return null; }
}

// ── API de quota (via curl, não bloqueante) ───────────────────────────────────

function fetchQuota(token, callback) {
    try {
        const proc = new Gio.Subprocess({
            argv: [
                'curl', '-sf', '-m', '10',
                '-H', `Authorization: Bearer ${token}`,
                '-H', `anthropic-beta: ${API_BETA}`,
                API_URL,
            ],
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
        });
        proc.init(null);
        proc.communicate_utf8_async(null, null, (_proc, result) => {
            try {
                const [, stdout] = _proc.communicate_utf8_finish(result);
                callback(null, JSON.parse(stdout));
            } catch (e) { callback(e, null); }
        });
    } catch (e) { callback(e, null); }
}

// ── Estatísticas locais (prompts + sessões) ───────────────────────────────────

function weekStartMs() {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}

function gatherLocalStats() {
    const home      = GLib.get_home_dir();
    const todayStr  = new Date().toISOString().slice(0, 10);
    const nowMs     = Date.now();
    const weekMs    = weekStartMs();

    let promptsToday = 0, promptsWeek = 0, lastActivity = null, activeSessions = 0;

    const histRaw = readFileSafe(GLib.build_filenamev([home, '.claude', 'history.jsonl']));
    if (histRaw) {
        for (const line of histRaw.split('\n')) {
            if (!line) continue;
            try {
                const entry = JSON.parse(line);
                const ts = entry.timestamp;
                if (!ts) continue;
                if (new Date(ts).getTime() < weekMs) continue;
                promptsWeek++;
                if (new Date(ts).toISOString().slice(0, 10) === todayStr) {
                    promptsToday++;
                    if (!lastActivity || ts > lastActivity.ms)
                        lastActivity = { ms: ts, text: entry.display ?? '' };
                }
            } catch (_) {}
        }
    }

    const sessDir = GLib.build_filenamev([home, '.claude', 'sessions']);
    try {
        const en = Gio.File.new_for_path(sessDir)
            .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let si;
        while ((si = en.next_file(null)) !== null) {
            if (!si.get_name().endsWith('.json')) continue;
            const raw = readFileSafe(GLib.build_filenamev([sessDir, si.get_name()]));
            if (!raw) continue;
            try {
                const s = JSON.parse(raw);
                if (s.status === 'busy' || s.status === 'ready') activeSessions++;
            } catch (_) {}
        }
    } catch (_) {}

    return {
        promptsToday, promptsWeek, activeSessions,
        lastTime: lastActivity ? formatRelative(lastActivity.ms, nowMs) : 'nunca',
        lastText: lastActivity?.text ?? '',
    };
}

// ── Extensão ──────────────────────────────────────────────────────────────────

export default class ClaudeQuotaExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Claude Quota', false);

        // Painel
        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        const svgPath = GLib.build_filenamev([this.path, 'claude-code.svg']);
        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(svgPath),
            style_class: 'system-status-icon',
        });
        this._label = new St.Label({
            text: '…',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 4px;',
        });
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);

        // Menu
        const menu = this._indicator.menu;
        this._planItem = new PopupMenu.PopupSeparatorMenuItem('Claude');
        menu.addMenuItem(this._planItem);

        // Barras dinâmicas por grupo (session, daily, weekly, monthly)
        this._groupBars = {};
        for (const [key, label] of Object.entries(GROUP_LABELS)) {
            const sep  = new PopupMenu.PopupSeparatorMenuItem(label);
            const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
            const vbox = new St.BoxLayout({ vertical: true, x_expand: true, style: 'padding: 2px 0;' });

            const row   = new St.BoxLayout({ x_expand: true });
            const pctLbl  = new St.Label({ text: '—', x_expand: true });
            const resetLbl = new St.Label({ text: '', x_align: Clutter.ActorAlign.END, style: 'color: #aaa; font-size: 0.85em;' });
            row.add_child(pctLbl);
            row.add_child(resetLbl);

            const bg   = new St.Widget({ style: `width: ${BAR_WIDTH}px; height: 10px; background-color: rgba(255,255,255,0.15); border-radius: 5px; margin-top: 4px;` });
            const fill = new St.Widget({ style: `width: 0px; height: 10px; background-color: #57e389; border-radius: 5px;` });
            bg.add_child(fill);

            vbox.add_child(row);
            vbox.add_child(bg);
            item.add_child(vbox);

            menu.addMenuItem(sep);
            menu.addMenuItem(item);

            this._groupBars[key] = { sep, item, pctLbl, resetLbl, fill };
            sep.visible  = false;
            item.visible = false;
        }

        // Atividade local
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Atividade'));
        this._todayItem   = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._weekItem    = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._sessItem    = new PopupMenu.PopupMenuItem('', { reactive: false });
        menu.addMenuItem(this._todayItem);
        menu.addMenuItem(this._weekItem);
        menu.addMenuItem(this._sessItem);

        // Último prompt
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Último prompt'));
        this._lastTimeItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._lastTextItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        menu.addMenuItem(this._lastTimeItem);
        menu.addMenuItem(this._lastTextItem);

        Main.panel.addToStatusArea('claude-quota', this._indicator);

        this._menuConn = menu.connect('open-state-changed', (_, open) => {
            if (open) {
                this._updateAPI();
                this._updateLocal();
            }
        });

        this._apiData = null;
        this._updateAPI();
        this._updateLocal();

        this._apiTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, API_INTERVAL, () => {
            this._updateAPI();
            return GLib.SOURCE_CONTINUE;
        });
        this._localTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, LOCAL_INTERVAL, () => {
            this._updateLocal();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._menuConn) {
            this._indicator?.menu.disconnect(this._menuConn);
            this._menuConn = null;
        }
        [this._apiTimer, this._localTimer].forEach(id => {
            if (id) GLib.source_remove(id);
        });
        this._apiTimer = this._localTimer = null;
        this._indicator?.destroy();
        this._indicator = null;
    }

    _updateAPI() {
        const creds = readCredentials();
        if (!creds) {
            this._label.set_text('sem token');
            return;
        }

        fetchQuota(creds.token, (err, data) => {
            if (err || !data) {
                console.error('[claude-quota] API error:', err);
                return;
            }
            this._apiData = data;
            this._applyAPIData(creds.plan);
        });
    }

    _applyAPIData(plan) {
        const data = this._apiData;
        if (!data) return;

        // Título do menu com plano
        const planName = plan
            ? `Claude ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
            : 'Claude';
        this._planItem.label.set_text(planName);

        // Esconder todas as barras
        for (const bar of Object.values(this._groupBars)) {
            bar.sep.visible  = false;
            bar.item.visible = false;
        }

        const limits = data?.limits ?? [];
        let highestPct = null;

        for (const limit of limits) {
            const key = limit.group;
            const bar = this._groupBars[key];
            if (!bar) continue;

            const pct    = Math.min(100, Math.max(0, limit.percent ?? 0));
            const fillPx = Math.round((pct / 100) * BAR_WIDTH);
            const color  = pct < 60 ? '#57e389' : pct < 80 ? '#f5c211' : '#e01b24';

            bar.fill.style = `width: ${fillPx}px; height: 10px; background-color: ${color}; border-radius: 5px;`;
            bar.pctLbl.set_text(`${pct.toFixed(1)}% usado`);
            bar.resetLbl.set_text(limit.resets_at ? formatResetsAt(limit.resets_at) : '');
            bar.sep.visible  = true;
            bar.item.visible = true;

            if (highestPct === null || pct > highestPct) highestPct = pct;
        }

        // Label do painel: maior percentual entre os grupos
        // Painel: prioriza diário, depois o maior entre os grupos
        const dailyLimit = limits.find(l => l.group === 'daily');
        const panelPct   = dailyLimit ? dailyLimit.percent : highestPct;
        if (panelPct !== null)
            this._label.set_text(`${panelPct.toFixed(0)}%`);
    }

    _updateLocal() {
        try {
            const s = gatherLocalStats();
            this._todayItem.label.set_text(`  Prompts hoje:    ${s.promptsToday}`);
            this._weekItem.label.set_text(`  Prompts semana:  ${s.promptsWeek}`);
            this._sessItem.label.set_text(`  Sessões ativas:  ${s.activeSessions}`);
            this._lastTimeItem.label.set_text(`  ${s.lastTime}`);
            const preview = s.lastText.length > 60 ? s.lastText.slice(0, 57) + '…' : s.lastText;
            this._lastTextItem.label.set_text(`  ${preview || '—'}`);

            // Badge de sessão ativa no painel
            if (s.activeSessions > 0 && this._label.get_text() !== '…') {
                const cur = this._label.get_text().replace(/ \[\d+\]$/, '');
                this._label.set_text(`${cur} [${s.activeSessions}]`);
            }
        } catch (e) {
            console.error('[claude-quota]', e);
        }
    }
}
