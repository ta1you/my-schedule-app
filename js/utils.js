export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatTimeForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getTodayString() {
    return formatDateForInput(new Date());
}

export const SafeStorage = {
    getItem(key) {
        let data = localStorage.getItem(key);
        if (!data) {
            const backup = localStorage.getItem(key + '_backup');
            if (backup) {
                console.warn(`Restored ${key} from backup`);
                data = backup;
                localStorage.setItem(key, backup);
            }
        }
        return data;
    },
    setItem(key, value) {
        localStorage.setItem(key, value);
        localStorage.setItem(key + '_backup', value);
    }
};
