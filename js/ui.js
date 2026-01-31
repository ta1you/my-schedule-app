import { Storage } from './storage.js';
import { getTodayString } from './utils.js';

export const UI = {
    currentCategory: 'all',

    init() {
        this.listElement = document.getElementById('schedule-list');
        this.render();
        this.setupTabEvents();
    },

    setupTabEvents() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                e.target.classList.add('active');
                // Set current category and re-render
                this.currentCategory = e.target.dataset.category;
                this.render();
            });
        });
    },

    render() {
        let schedules = Storage.getAll();
        
        // Filter by category if not 'all'
        if (this.currentCategory !== 'all') {
            schedules = schedules.filter(s => (s.category || 'その他') === this.currentCategory);
        }

        const today = getTodayString();
        // Simple filter for today/future for now, or just show all sorted
        // Let's grouping by date for better UX

        this.listElement.innerHTML = '';

        if (schedules.length === 0) {
            this.listElement.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    <p>予定がありません</p>
                    <p>+ボタンで追加してください</p>
                </div>
            `;
            return;
        }

        let currentDate = null;

        schedules.forEach(schedule => {
            if (schedule.date !== currentDate) {
                currentDate = schedule.date;
                const dateHeader = document.createElement('h3');
                dateHeader.style.cssText = 'font-size: 0.9rem; color: var(--text-secondary); margin-top: 1rem; margin-bottom: 0.5rem;';

                const dateObj = new Date(currentDate);
                const dayStr = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });

                dateHeader.textContent = isToday(dateObj) ? `今日 (${dayStr})` : dayStr;
                if (isToday(dateObj)) dateHeader.id = 'header-today';
                this.listElement.appendChild(dateHeader);
            }

            const el = document.createElement('div');
            el.className = 'schedule-item';
            el.dataset.id = schedule.id; // For click event
            el.onclick = () => window.openEditModal(schedule.id);

            const timeStr = (schedule.startTime && schedule.endTime)
                ? `${schedule.startTime} - ${schedule.endTime}`
                : (schedule.startTime || '終日');

            const category = schedule.category || 'その他';
            const categoryClass = `category-badge category-${category}`;

            el.innerHTML = `
                <div class="schedule-time">${timeStr}</div>
                <div class="schedule-title">${escapeHtml(schedule.title)}</div>
                <div class="${categoryClass}">${escapeHtml(category)}</div>
                ${schedule.description ? `<div class="schedule-desc">${escapeHtml(schedule.description)}</div>` : ''}
            `;
            this.listElement.appendChild(el);
        });
    }
};

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
