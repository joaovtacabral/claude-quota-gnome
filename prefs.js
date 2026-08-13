import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClaudeQuotaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page  = new Adw.PreferencesPage({ title: 'Claude Quota', icon_name: 'dialog-information-symbolic' });
        const group = new Adw.PreferencesGroup({ title: 'Token Budget', description: 'Controls the progress bar maximum.' });

        const row = new Adw.SpinRow({
            title: 'Daily token limit',
            subtitle: 'Input + output tokens per day (default: 500 000)',
            adjustment: new Gtk.Adjustment({
                lower: 10_000,
                upper: 10_000_000,
                step_increment: 10_000,
                page_increment: 100_000,
                value: settings.get_int('daily-token-limit'),
            }),
        });

        settings.bind('daily-token-limit', row, 'value', Gio.SettingsBindFlags.DEFAULT);

        group.add(row);
        page.add(group);
        window.add(page);
    }
}
