export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDateForInput(date) {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
}

export function formatTimeForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getTodayString() {
    return formatDateForInput(new Date());
}
