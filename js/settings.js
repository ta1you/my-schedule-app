import { SafeStorage } from './utils.js';
import { CalendarSync } from './calendarSync.js';

export const Settings = {
    // Default preferences
    defaults: {
        showList: true,
        showCalendar: true,
        showFinance: false,
        showKakeibo: false,
        showBookkeeping: false,
        showNotes: false,
        calendarStart: 5,
        calendarEnd: 24,
        backgroundImage: null,
        showShiftSalary: false,
        hourlyWage: 1000,
        syncAlertTime: 10,
        showShare: true,
        showTodaySchedule: true
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
            const data = SafeStorage.getItem('app_settings');
            if (data) {
                this.prefs = Object.assign({}, this.defaults, JSON.parse(data));
                
                // One-time auto-hide migration for users who had them implicitly on before
                if (!this.prefs._v2_nav_migrated) {
                    this.prefs.showFinance = false;
                    this.prefs.showKakeibo = false;
                    this.prefs.showBookkeeping = false;
                    this.prefs.showNotes = false;
                    this.prefs._v2_nav_migrated = true;
                    // Don't call this.save() here as it causes a loop or pre-mature DOM apply. 
                    // It will stay in memory until next user save, but apply() will hide them anyway.
                }
            } else {
                this.prefs = { ...this.defaults, _v2_nav_migrated: true };
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
        const btnBgClear = document.getElementById('btn-bg-clear');
        const toggleShiftSalary = document.getElementById('toggle-shift-salary');
        const hourlyWageInput = document.getElementById('setting-hourly-wage');
        const hourlyWageContainer = document.getElementById('setting-hourly-wage-container');
        const syncAlertInput = document.getElementById('setting-sync-alert');
        const toggleShare = document.getElementById('toggle-share');
        const toggleTodaySchedule = document.getElementById('toggle-today-schedule');

        if (toggleFinance) toggleFinance.checked = this.prefs.showFinance;
        if (toggleKakeibo) toggleKakeibo.checked = this.prefs.showKakeibo;
        if (toggleBookkeeping) toggleBookkeeping.checked = this.prefs.showBookkeeping;
        if (toggleNotes) toggleNotes.checked = this.prefs.showNotes;
        if (calStart) calStart.value = this.prefs.calendarStart;
        if (calEnd) calEnd.value = this.prefs.calendarEnd;
        if (btnBgClear) btnBgClear.style.display = this.prefs.backgroundImage ? 'flex' : 'none';
        
        if (toggleShiftSalary) toggleShiftSalary.checked = this.prefs.showShiftSalary;
        if (hourlyWageInput) hourlyWageInput.value = this.prefs.hourlyWage;
        if (hourlyWageContainer) hourlyWageContainer.style.display = this.prefs.showShiftSalary ? 'flex' : 'none';
        if (syncAlertInput) syncAlertInput.value = this.prefs.syncAlertTime !== undefined ? this.prefs.syncAlertTime : 10;
        if (toggleShare) toggleShare.checked = this.prefs.showShare !== false;
        if (toggleTodaySchedule) toggleTodaySchedule.checked = this.prefs.showTodaySchedule !== false;
    },

    // Apply settings
    apply() {
        const btnFinance = document.getElementById('btn-finance');
        const btnKakeibo = document.getElementById('btn-kakeibo');
        const btnBookkeeping = document.getElementById('btn-bookkeeping');
        const btnNotes = document.getElementById('btn-notes');
        const btnShare = document.getElementById('btn-share');

        if (btnFinance) btnFinance.style.display = this.prefs.showFinance ? '' : 'none';
        if (btnKakeibo) btnKakeibo.style.display = this.prefs.showKakeibo ? '' : 'none';
        if (btnBookkeeping) btnBookkeeping.style.display = this.prefs.showBookkeeping ? '' : 'none';
        if (btnNotes) btnNotes.style.display = this.prefs.showNotes ? '' : 'none';
        if (btnShare) btnShare.style.display = this.prefs.showShare !== false ? '' : 'none';

        if (this.prefs.backgroundImage) {
            document.body.style.setProperty('--bg-image', `url(${this.prefs.backgroundImage})`);
            document.body.classList.add('has-wallpaper');
            const appEl = document.getElementById('app');
            if (appEl) appEl.style.backgroundColor = 'transparent';
        } else {
            document.body.style.removeProperty('--bg-image');
            document.body.classList.remove('has-wallpaper');
            const appEl = document.getElementById('app');
            if (appEl) appEl.style.backgroundColor = '';
        }

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
        const tShiftSalary = document.getElementById('toggle-shift-salary');
        const hwInput = document.getElementById('setting-hourly-wage');
        const syncAlertInput = document.getElementById('setting-sync-alert');
        const tShare = document.getElementById('toggle-share');
        const tTodaySchedule = document.getElementById('toggle-today-schedule');
        
        const btnExport = document.getElementById('btn-export-backup');
        const fileInput = document.getElementById('backup-file-input');
        const btnSyncCalendar = document.getElementById('btn-sync-calendar');

        if (btnExport) btnExport.addEventListener('click', () => this.exportData());
        if (btnSyncCalendar) btnSyncCalendar.addEventListener('click', () => CalendarSync.downloadICS(this.prefs.syncAlertTime !== undefined ? this.prefs.syncAlertTime : 10));
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
        if (tShare) tShare.addEventListener('change', (e) => { this.prefs.showShare = e.target.checked; this.save(); });
        if (tTodaySchedule) {
            tTodaySchedule.addEventListener('change', (e) => {
                this.prefs.showTodaySchedule = e.target.checked;
                this.save();
            });
        }
        
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
        
        if (tShiftSalary) {
            tShiftSalary.addEventListener('change', (e) => {
                this.prefs.showShiftSalary = e.target.checked;
                this.save();
                this.updateUI(); // to toggle the wage input visibility
            });
        }
        
        if (hwInput) {
            hwInput.addEventListener('change', (e) => {
                this.prefs.hourlyWage = parseInt(e.target.value) || 1000;
                this.save();
            });
        }
        
        if (syncAlertInput) {
            syncAlertInput.addEventListener('change', (e) => {
                this.prefs.syncAlertTime = parseInt(e.target.value);
                this.save();
            });
        }

        const bgInput = document.getElementById('setting-bg-image');
        const bgClear = document.getElementById('btn-bg-clear');
        const cropModal = document.getElementById('crop-modal');
        const cropImage = document.getElementById('crop-image');
        const btnCropApply = document.getElementById('btn-crop-apply');
        let cropper = null;

        if (bgInput && cropModal) {
            bgInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    if (file.size > 10 * 1024 * 1024) {
                        alert('画像サイズが10MBを超えています。少し軽い画像を選択してください。');
                        e.target.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        cropImage.src = event.target.result;
                        cropModal.showModal();
                        
                        if (cropper) {
                            cropper.destroy();
                        }
                        
                        // Wait for modal to render
                        setTimeout(() => {
                            cropper = new Cropper(cropImage, {
                                aspectRatio: window.innerWidth / window.innerHeight,
                                viewMode: 3,
                                dragMode: 'move',
                                guides: false,
                                center: false,
                                autoCropArea: 1,
                                background: false,
                            });
                        }, 50);
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = ''; // Reset
            });

            btnCropApply.addEventListener('click', () => {
                if (!cropper) return;
                
                // Crop and compress
                const canvas = cropper.getCroppedCanvas({
                    maxWidth: 1080,
                    maxHeight: 1920
                });
                
                const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                
                this.prefs.backgroundImage = croppedDataUrl;
                try {
                    this.save();
                    this.updateUI(); // Important to show the clear button
                    cropModal.close();
                } catch (err) {
                    alert('保存に失敗しました。解像度が高すぎる可能性があります。');
                    this.prefs.backgroundImage = null;
                    this.updateUI();
                }
            });
        }
        
        if (bgClear) {
            bgClear.addEventListener('click', (e) => {
                e.stopPropagation();
                this.prefs.backgroundImage = null;
                this.save();
                this.updateUI(); // Hide clear button
            });
        }
    }
};
