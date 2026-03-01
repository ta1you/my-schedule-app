import { Storage } from './storage.js';
import { getTodayString } from './utils.js';

export const UI = {
    currentCategory: 'all',
    swipeState: {
        activeElement: null,
        startX: 0,
        currentX: 0,
        startTime: 0,
        threshold: 50, // min swipe to show delete
        maxSwipe: -80  // width of delete button
    },

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

    initSwipe(el) {
        const inner = el.querySelector('.schedule-item-inner');
        const id = el.dataset.id;
        let isSwiping = false;

        el.addEventListener('touchstart', (e) => {
            // Close any other open swipe actions
            if (this.swipeState.activeElement && this.swipeState.activeElement !== el) {
                this.closeSwipe(this.swipeState.activeElement);
            }

            this.swipeState.startX = e.touches[0].clientX;
            this.swipeState.startTime = Date.now();
            el.classList.add('swiping');
            isSwiping = false;
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            const diffX = e.touches[0].clientX - this.swipeState.startX;
            // Only allow left swipe
            if (diffX < 0) {
                // Limit swipe distance
                const moveX = Math.max(diffX, this.swipeState.maxSwipe - 20);
                inner.style.transform = `translateX(${moveX}px)`;
                if (Math.abs(diffX) > 10) isSwiping = true;
            } else if (inner.style.transform && inner.style.transform !== 'translateX(0px)') {
                // Allow user to swipe back right
                const moveX = Math.min(0, diffX + this.swipeState.maxSwipe);
                inner.style.transform = `translateX(${moveX}px)`;
                if (Math.abs(diffX) > 10) isSwiping = true;
            }
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            el.classList.remove('swiping');
            const diffX = e.changedTouches[0].clientX - this.swipeState.startX;
            const duration = Date.now() - this.swipeState.startTime;

            // If it was a quick flick or a long enough swipe
            if (diffX < -this.swipeState.threshold || (diffX < -20 && duration < 250)) {
                this.openSwipe(el);
            } else {
                this.closeSwipe(el);
            }

            // Prevent click if swipe was significant
            if (isSwiping) {
                el.style.pointerEvents = 'none';
                setTimeout(() => el.style.pointerEvents = '', 100);
            }
        });
    },

    openSwipe(el) {
        const inner = el.querySelector('.schedule-item-inner');
        inner.style.transform = `translateX(${this.swipeState.maxSwipe}px)`;
        this.swipeState.activeElement = el;
    },

    closeSwipe(el) {
        const inner = el.querySelector('.schedule-item-inner');
        inner.style.transform = 'translateX(0px)';
        if (this.swipeState.activeElement === el) {
            this.swipeState.activeElement = null;
        }
    },

    handleDelete(id) {
        if (confirm('この予定を削除しますか？')) {
            Storage.delete(id);
            // Notification is handled by Storage listener which calls UI.render()
        } else {
            if (this.swipeState.activeElement) {
                this.closeSwipe(this.swipeState.activeElement);
            }
        }
    },

    render() {
        this.listElement.innerHTML = '';
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
            let daySchedules = schedules.filter(s => s.date === dateStr);

            // Apply category filter
            if (this.currentCategory !== 'all') {
                daySchedules = daySchedules.filter(s => (s.category || 'その他') === this.currentCategory);
            }

            daySchedules.forEach(s => {
                const entry = this.createEntry(s);
                column.appendChild(entry);
            });

            grid.appendChild(column);
        }

        gridContainer.appendChild(timeAxis);
        gridContainer.appendChild(grid);

        timetableContainer.appendChild(header);
        timetableContainer.appendChild(gridContainer);
        this.listElement.appendChild(timetableContainer);

        // Sync scrolling
        gridContainer.onscroll = () => {
            header.scrollLeft = gridContainer.scrollLeft;
        };

        // Add 'Now' line
        this.updateNowLine(grid);
        if (this.nowInterval) clearInterval(this.nowInterval);
        this.nowInterval = setInterval(() => this.updateNowLine(grid), 60000);
    },

    createEntry(s) {
        const el = document.createElement('div');
        el.className = `timetable-entry category-${s.category || 'その他'}`;

        // Calculate position
        let top = 0;
        let height = 60;

        if (s.startTime) {
            const [h, m] = s.startTime.split(':').map(Number);
            top = (h * 60) + m;

            if (s.endTime) {
                const [eh, em] = s.endTime.split(':').map(Number);
                height = (eh * 60 + em) - top;
            }
        } else {
            // Full day or no time? Default to top and small height?
            // For timetable, let's put them at the top or a specific area?
            // Following current logic:
            top = 0;
            height = 40;
            el.classList.add('is-all-day');
        }

        el.style.top = `${top}px`;
        el.style.height = `${Math.max(20, height)}px`;

        el.innerHTML = `
            <div class="entry-title">${escapeHtml(s.title)}</div>
            ${s.startTime ? `<div class="entry-time">${s.startTime}${s.endTime ? ' - ' + s.endTime : ''}</div>` : ''}
        `;

        el.onclick = () => window.openEditModal(s.id);

        return el;
    },

    updateNowLine(grid) {
        if (!grid) return;
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
