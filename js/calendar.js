import { Storage } from './storage.js';

export const Calendar = {
    init() {
        this.container = document.getElementById('calendar-view');
        const today = new Date();
        this.currentYear = 2026; // Default as per requirements, or we could use today.getFullYear()
        this.currentMonth = 0; // 0 = Jan
        this.render();
    },

    refresh() {
        this.render();
    },

    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.render();
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.render();
    },

    render() {
        this.container.innerHTML = '';
        const schedules = Storage.getAll();

        // --- Controls Container ---
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'calendar-controls';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.justifyContent = 'space-between';
        controlsDiv.style.alignItems = 'center';
        controlsDiv.style.padding = '0.5rem 1rem';
        controlsDiv.style.marginBottom = '1rem';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<';
        prevBtn.className = 'btn btn-secondary';
        prevBtn.onclick = () => this.prevMonth();

        const label = document.createElement('h2');
        label.textContent = `${this.currentYear}年 ${this.currentMonth + 1}月`;
        label.style.margin = '0';
        label.style.fontSize = '1.2rem';

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>';
        nextBtn.className = 'btn btn-secondary';
        nextBtn.onclick = () => this.nextMonth();

        controlsDiv.appendChild(prevBtn);
        controlsDiv.appendChild(label);
        controlsDiv.appendChild(nextBtn);
        this.container.appendChild(controlsDiv);

        // --- Calendar Grid ---
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';
        // Force single column for the month view if needed, or reuse class
        // Since we are showing only one month, the grid layout from CSS might expect multiple.
        // Let's modify style inline or assume '.calendar-month' handles full width nicely.

        const monthDiv = document.createElement('div');
        monthDiv.className = 'calendar-month';
        // We handle header in controls, but let's keep Month name hidden or removed inside?
        // Actually the previous implementation had h3 inside monthDiv. 
        // We already have the header in controls, so maybe we don't need it here or we render it just for consistency?
        // Let's NOT render the duplicate h3 for now.

        // Days Grid
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';

        // Weekday headers
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        weekdays.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'weekday-header';
            if (day === '日') dayHeader.classList.add('sunday');
            if (day === '土') dayHeader.classList.add('saturday');
            dayHeader.textContent = day;
            daysGrid.appendChild(dayHeader);
        });

        // Days calculation
        const year = this.currentYear;
        const monthIndex = this.currentMonth;

        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const totalDays = lastDay.getDate();
        const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)

        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell empty';
            daysGrid.appendChild(emptyCell);
        }

        // Day cells
        for (let day = 1; day <= totalDays; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';

            // Date container
            const dateNum = document.createElement('div');
            dateNum.className = 'day-number';
            dateNum.textContent = day;
            dayCell.appendChild(dateNum);

            const currentDayOfWeek = (startDay + day - 1) % 7;
            if (currentDayOfWeek === 0) dayCell.classList.add('sunday');
            if (currentDayOfWeek === 6) dayCell.classList.add('saturday');

            // Find schedules
            const monthStr = (monthIndex + 1).toString().padStart(2, '0');
            const dayStr = day.toString().padStart(2, '0');
            const dateKey = `${year}-${monthStr}-${dayStr}`;

            const daySchedules = schedules.filter(s => s.date === dateKey);

            if (daySchedules.length > 0) {
                const eventsContainer = document.createElement('div');
                eventsContainer.className = 'day-events';

                daySchedules.forEach(schedule => {
                    const eventDot = document.createElement('div');
                    eventDot.className = 'event-dot';
                    const eventTitle = document.createElement('span');
                    eventTitle.textContent = schedule.title;
                    eventDot.appendChild(eventTitle);
                    // Click to open edit modal for this schedule
                    eventDot.onclick = (e) => {
                        e.stopPropagation();
                        if (window.openEditModal) window.openEditModal(schedule.id);
                    };
                    eventsContainer.appendChild(eventDot);
                });
                dayCell.appendChild(eventsContainer);
            }

            // Click on empty part of day cell to add a new schedule for that date
            dayCell.onclick = () => {
                const modal = document.getElementById('schedule-modal');
                const form = document.getElementById('schedule-form');
                if (!modal || !form) return;
                form.reset();
                form.id.value = '';
                // set date input if present
                const dateInput = document.getElementById('date');
                if (dateInput) dateInput.value = dateKey;
                const titleEl = document.getElementById('modal-title');
                if (titleEl) titleEl.textContent = '予定を追加';
                const deleteBtn = document.getElementById('btn-delete');
                if (deleteBtn) deleteBtn.hidden = true;
                modal.showModal();
            };

            daysGrid.appendChild(dayCell);
        }

        monthDiv.appendChild(daysGrid);
        calendarGrid.appendChild(monthDiv);
        this.container.appendChild(calendarGrid);
    }
};

