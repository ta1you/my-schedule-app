import { Storage } from './storage.js';
import { getTodayString } from './utils.js';

export const Schedule2 = {
    init() {
        this.container = document.getElementById('schedule2-view');
        if (!this.container) return;
        this.render();
    },

    render() {
        this.container.innerHTML = '';
        const schedules = Storage.getAll();

        const timetableContainer = document.createElement('div');
        timetableContainer.className = 'timetable-container';

        // 1. Header (Dates)
        const header = document.createElement('div');
        header.className = 'timetable-header';

        // 2. Body (Time Axis + Grid)
        const gridContainer = document.createElement('div');
        gridContainer.className = 'timetable-grid-container';

        const timeAxis = document.createElement('div');
        timeAxis.className = 'timetable-time-axis';
        for (let i = 0; i < 24; i++) {
            const slot = document.createElement('div');
            slot.className = 'time-slot-label';
            slot.textContent = `${i}:00`;
            timeAxis.appendChild(slot);
        }

        const grid = document.createElement('div');
        grid.className = 'timetable-grid';

        // Generate next 14 days
        const today = new Date();
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            // Header day
            const dayHeader = document.createElement('div');
            dayHeader.className = 'timetable-header-day';
            if (i === 0) dayHeader.classList.add('is-today');

            const dayNum = document.createElement('div');
            dayNum.className = 'day-num';
            dayNum.textContent = date.getDate();

            const dayName = document.createElement('div');
            dayName.className = 'day-name';
            dayName.textContent = date.toLocaleDateString('ja-JP', { weekday: 'short' });

            dayHeader.appendChild(dayNum);
            dayHeader.appendChild(dayName);
            header.appendChild(dayHeader);

            // Column
            const column = document.createElement('div');
            column.className = 'timetable-day-column';
            column.dataset.date = dateStr;

            // Fill with entries
            const daySchedules = schedules.filter(s => s.date === dateStr);
            daySchedules.forEach(s => {
                if (s.startTime) {
                    const entry = this.createEntry(s);
                    column.appendChild(entry);
                }
            });

            grid.appendChild(column);
        }

        gridContainer.appendChild(timeAxis);
        gridContainer.appendChild(grid);

        timetableContainer.appendChild(header);
        timetableContainer.appendChild(gridContainer);
        this.container.appendChild(timetableContainer);

        // Sync scrolling
        gridContainer.onscroll = () => {
            header.scrollLeft = gridContainer.scrollLeft;
        };

        // Add 'Now' line if today is visible
        this.updateNowLine(grid);
        setInterval(() => this.updateNowLine(grid), 60000);
    },

    createEntry(s) {
        const el = document.createElement('div');
        el.className = `timetable-entry category-${s.category || 'その他'}`;

        // Calculate position
        const [h, m] = s.startTime.split(':').map(Number);
        const top = (h * 60) + m;

        let height = 60; // default 1 hour
        if (s.endTime) {
            const [eh, em] = s.endTime.split(':').map(Number);
            height = (eh * 60 + em) - top;
        }

        el.style.top = `${top}px`;
        el.style.height = `${Math.max(20, height)}px`;

        el.innerHTML = `
            <div class="entry-title">${s.title}</div>
            <div class="entry-time">${s.startTime}${s.endTime ? ' - ' + s.endTime : ''}</div>
        `;

        el.onclick = () => window.openEditModal(s.id);

        return el;
    },

    updateNowLine(grid) {
        let line = grid.querySelector('.timetable-now-line');
        if (!line) {
            line = document.createElement('div');
            line.className = 'timetable-now-line';
            grid.appendChild(line);
        }

        const now = new Date();
        const top = (now.getHours() * 60) + now.getMinutes();
        line.style.top = `${top}px`;
    }
};
