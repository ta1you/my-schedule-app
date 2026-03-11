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
        this.setupEventListeners();
        this.apply();
        console.log('Settings initialized');
    },

    // Load preferences from localStorage
    load() {
        try {
            const saved = localStorage.getItem('app_settings');
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

        // Update UI logic
        this.updateUI();
    },

    // Save preferences to localStorage
    save() {
        try {
            localStorage.setItem('app_settings', JSON.stringify(this.prefs));
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
