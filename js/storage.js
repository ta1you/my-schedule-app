const STORAGE_KEY = 'my_schedule_pwa_data';

export const Storage = {
    getAll() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    save(schedule) {
        const schedules = this.getAll();
        const existingIndex = schedules.findIndex(s => s.id === schedule.id);

        if (existingIndex >= 0) {
            schedules[existingIndex] = schedule;
        } else {
            schedules.push(schedule);
        }

        // Sort by start time
        schedules.sort((a, b) => new Date(a.date + 'T' + (a.startTime || '00:00')) - new Date(b.date + 'T' + (b.startTime || '00:00')));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    },

    delete(id) {
        const schedules = this.getAll();
        const filtered = schedules.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    },

    getById(id) {
        const schedules = this.getAll();
        return schedules.find(s => s.id === id);
    },

    // Backup & Restore
    exportAll() {
        const schedules = localStorage.getItem(SCHEDULE_KEY);
        const finance = localStorage.getItem('my_finance_pwa_data');
        const data = {
            schedules: schedules ? JSON.parse(schedules) : [],
            finance: finance ? JSON.parse(finance) : [],
            timestamp: new Date().toISOString(),
            version: 1
        };
        return JSON.stringify(data, null, 2);
    },

    importAll(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.schedules || !data.finance) {
                alert('無効なデータ形式です。');
                return false;
            }
            if (!confirm('現在のデータをすべて上書きして復元しますか？\n（この操作は取り消せません）')) {
                return false;
            }

            localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data.schedules));
            localStorage.setItem('my_finance_pwa_data', JSON.stringify(data.finance));
            return true;
        } catch (e) {
            console.error('Import failed', e);
            alert('データの読み込みに失敗しました。');
            return false;
        }
    }
};
