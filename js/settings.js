import { SafeStorage } from './utils.js';

export const Settings = {
    // Default preferences
    defaults: {
        showList: true,
        showCalendar: true,
        showFinance: true,
        showKakeibo: true,
        showBookkeeping: true,
        showNotes: true,
        calendarStart: 5,
        calendarEnd: 24
    },

    // Current preferences
    prefs: {},

    // Initialize settings
    init() {
        this.load();
        this.updateUI();
        this.setupEventListeners();
        this.apply();
        console.log('Settings initialized');
    },

    showCalendarSubSettings(show) {
        const mainView = document.getElementById('settings-view');
        const calView = document.getElementById('settings-calendar-view');
        if (show) {
            mainView.hidden = true;
            calView.hidden = false;
        } else {
            mainView.hidden = false;
            calView.hidden = true;
        }
    },

    exportData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            try {
                data[key] = JSON.parse(value);
            } catch(e) {
                data[key] = value;
            }
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my_schedule_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async importData(file) {
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            for (const key in data) {
                const value = data[key];
                localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
            alert('データを復元しました。アプリを再読み込みします。');
            location.reload();
        } catch (e) {
            console.error('Import failed', e);
            alert('データの復元に失敗しました。無効なファイルです。');
        }
    },

    // Load preferences from localStorage
    load() {
        try {
            const saved = SafeStorage.getItem('app_settings');
            if (saved) {
                this.prefs = { ...this.defaults, ...JSON.parse(saved) };
            } else {
                this.prefs = { ...this.defaults };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
            this.prefs = { ...this.defaults };
        }

        // List and Calendar are now mandatory
        this.prefs.showList = true;
        this.prefs.showCalendar = true;
    },

    // Save preferences to localStorage
    save() {
        try {
            SafeStorage.setItem('app_settings', JSON.stringify(this.prefs));
            this.apply();
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    },

    // Update form states based on current prefs
    updateUI() {
        const toggleFinance = document.getElementById('toggle-finance');
        const toggleKakeibo = document.getElementById('toggle-kakeibo');
        const toggleBookkeeping = document.getElementById('toggle-bookkeeping');
        const toggleNotes = document.getElementById('toggle-notes');
        const calStart = document.getElementById('setting-calendar-start');
        const calEnd = document.getElementById('setting-calendar-end');

        if (toggleFinance) toggleFinance.checked = this.prefs.showFinance;
        if (toggleKakeibo) toggleKakeibo.checked = this.prefs.showKakeibo;
        if (toggleBookkeeping) toggleBookkeeping.checked = this.prefs.showBookkeeping;
        if (toggleNotes) toggleNotes.checked = this.prefs.showNotes;
        if (calStart) calStart.value = this.prefs.calendarStart;
        if (calEnd) calEnd.value = this.prefs.calendarEnd;
    },

    // Apply settings
    apply() {
        const btnFinance = document.getElementById('btn-finance');
        const btnKakeibo = document.getElementById('btn-kakeibo');
        const btnBookkeeping = document.getElementById('btn-bookkeeping');
        const btnNotes = document.getElementById('btn-notes');

        if (btnFinance) btnFinance.style.display = this.prefs.showFinance ? '' : 'none';
        if (btnKakeibo) btnKakeibo.style.display = this.prefs.showKakeibo ? '' : 'none';
        if (btnBookkeeping) btnBookkeeping.style.display = this.prefs.showBookkeeping ? '' : 'none';
        if (btnNotes) btnNotes.style.display = this.prefs.showNotes ? '' : 'none';

        // Notify Calendar to refresh if it exists
        if (window.Calendar && window.Calendar.refresh) {
            window.Calendar.refresh();
        }
    },

    // Setup event listeners for settings controls
    setupEventListeners() {
        const tFinance = document.getElementById('toggle-finance');
        const tKakeibo = document.getElementById('toggle-kakeibo');
        const tBookkeeping = document.getElementById('toggle-bookkeeping');
        const tNotes = document.getElementById('toggle-notes');
        const calStart = document.getElementById('setting-calendar-start');
        const calEnd = document.getElementById('setting-calendar-end');
        
        const btnExport = document.getElementById('btn-export-backup');
        const fileInput = document.getElementById('backup-file-input');

        if (btnExport) btnExport.addEventListener('click', () => this.exportData());
        if (fileInput) fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (confirm('現在のデータは上書きされます。復元しますか？')) {
                    this.importData(e.target.files[0]);
                }
                e.target.value = ''; // Reset
            }
        });

        if (tFinance) tFinance.addEventListener('change', (e) => { this.prefs.showFinance = e.target.checked; this.save(); });
        if (tKakeibo) tKakeibo.addEventListener('change', (e) => { this.prefs.showKakeibo = e.target.checked; this.save(); });
        if (tBookkeeping) tBookkeeping.addEventListener('change', (e) => { this.prefs.showBookkeeping = e.target.checked; this.save(); });
        if (tNotes) tNotes.addEventListener('change', (e) => { this.prefs.showNotes = e.target.checked; this.save(); });
        
        if (calStart) {
            calStart.addEventListener('change', (e) => {
                this.prefs.calendarStart = parseInt(e.target.value);
                this.save();
            });
        }
        if (calEnd) {
            calEnd.addEventListener('change', (e) => {
                this.prefs.calendarEnd = parseInt(e.target.value);
                this.save();
            });
        }
    }
};
