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
    }
};
