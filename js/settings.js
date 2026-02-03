export const Settings = {
    // Default preferences
    defaults: {
        showList: true,
        showCalendar: true,
        showFinance: true,
        showKakeibo: true
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

        // Update UI logic (checkboxes)
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

    // Update checkbox states based on current prefs
    updateUI() {
        const toggleList = document.getElementById('toggle-list');
        const toggleCalendar = document.getElementById('toggle-calendar');
        const toggleFinance = document.getElementById('toggle-finance');
        const toggleKakeibo = document.getElementById('toggle-kakeibo');

        if (toggleList) toggleList.checked = this.prefs.showList;
        if (toggleCalendar) toggleCalendar.checked = this.prefs.showCalendar;
        if (toggleFinance) toggleFinance.checked = this.prefs.showFinance;
        if (toggleKakeibo) toggleKakeibo.checked = this.prefs.showKakeibo;
    },

    // Apply settings (show/hide tabs)
    apply() {
        const btnList = document.getElementById('btn-view-list');
        const btnCalendar = document.getElementById('btn-view-calendar');
        const btnFinance = document.getElementById('btn-finance');
        const btnKakeibo = document.getElementById('btn-kakeibo');

        if (btnList) btnList.style.display = this.prefs.showList ? '' : 'none';
        if (btnCalendar) btnCalendar.style.display = this.prefs.showCalendar ? '' : 'none';
        if (btnFinance) btnFinance.style.display = this.prefs.showFinance ? '' : 'none';
        if (btnKakeibo) btnKakeibo.style.display = this.prefs.showKakeibo ? '' : 'none';
    },

    // Setup event listeners for settings controls
    setupEventListeners() {
        const toggleList = document.getElementById('toggle-list');
        const toggleCalendar = document.getElementById('toggle-calendar');
        const toggleFinance = document.getElementById('toggle-finance');
        const toggleKakeibo = document.getElementById('toggle-kakeibo');

        if (toggleList) {
            toggleList.addEventListener('change', (e) => {
                this.prefs.showList = e.target.checked;
                this.save();
            });
        }

        if (toggleCalendar) {
            toggleCalendar.addEventListener('change', (e) => {
                this.prefs.showCalendar = e.target.checked;
                this.save();
            });
        }

        if (toggleFinance) {
            toggleFinance.addEventListener('change', (e) => {
                this.prefs.showFinance = e.target.checked;
                this.save();
            });
        }

        if (toggleKakeibo) {
            toggleKakeibo.addEventListener('change', (e) => {
                this.prefs.showKakeibo = e.target.checked;
                this.save();
            });
        }
    }
};
