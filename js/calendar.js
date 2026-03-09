import { Storage } from './storage.js';
import { formatDateForInput } from './utils.js';

export class CalendarInstance {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.currentDate = new Date(); // Support for specific day in week view
        this.viewMode = 'month'; // 'month' or 'week'
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.render();
    }

    refresh() {
        if (!this.container) this.container = document.getElementById(this.containerId);
        if (this.container) this.render();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        // When switching, sync currentDate to first day of month if in week view
        if (mode === 'week') {
            // If the month of currentDate doesn't match currentMonth/Year, reset it to first of month
            if (this.currentDate.getFullYear() !== this.currentYear || this.currentDate.getMonth() !== this.currentMonth) {
                this.currentDate = new Date(this.currentYear, this.currentMonth, 1);
            }
        }

        const slider = this.container.querySelector('.calendar-slider');
        if (slider) {
            slider.style.transform = mode === 'month' ? 'translateX(0)' : 'translateX(-50%)';
        }
        // Update active class on buttons
        const btns = this.container.querySelectorAll('.view-mode-btn');
        btns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    prev() {
        if (this.viewMode === 'month') {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
            this.syncFromCurrentDate();
        }
        this.render();
    }

    next() {
        if (this.viewMode === 'month') {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
            this.syncFromCurrentDate();
        }
        this.render();
    }

    syncFromCurrentDate() {
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        // --- Header Controls ---
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'calendar-controls';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<';
        prevBtn.className = 'btn btn-secondary';
        prevBtn.onclick = () => this.prev();

        const label = document.createElement('h2');
        if (this.viewMode === 'month') {
            label.textContent = `${this.currentYear}年 ${this.currentMonth + 1}月`;
        } else {
            const startOfWeek = new Date(this.currentDate);
            startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            label.textContent = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;
        }
        label.style.margin = '0';
        label.style.fontSize = '1.1rem';

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>';
        nextBtn.className = 'btn btn-secondary';
        nextBtn.onclick = () => this.next();

        // View Mode Selector
        const selector = document.createElement('div');
        selector.className = 'view-mode-selector';
        ['month', 'week'].forEach(m => {
            const btn = document.createElement('button');
            btn.className = `view-mode-btn ${this.viewMode === m ? 'active' : ''}`;
            btn.textContent = m === 'month' ? '月' : '週';
            btn.dataset.mode = m;
            btn.onclick = () => this.setViewMode(m);
            selector.appendChild(btn);
        });

        controlsDiv.appendChild(prevBtn);
        controlsDiv.appendChild(label);
        controlsDiv.appendChild(selector);
        controlsDiv.appendChild(nextBtn);
        this.container.appendChild(controlsDiv);

        // --- Slider Wrapper ---
        const slider = document.createElement('div');
        slider.className = 'calendar-slider';
        slider.style.transform = this.viewMode === 'month' ? 'translateX(0)' : 'translateX(-50%)';

        // Month Pane
        const monthPane = document.createElement('div');
        monthPane.className = 'calendar-view-pane';
        this.renderMonth(monthPane);
        slider.appendChild(monthPane);

        // Week Pane
        const weekPane = document.createElement('div');
        weekPane.className = 'calendar-view-pane';
        this.renderWeek(weekPane);
        slider.appendChild(weekPane);

        this.container.appendChild(slider);

        this.setupTouchEvents();
    }

    setupTouchEvents() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        this.container.ontouchstart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        };

        this.container.ontouchend = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            const dt = Date.now() - touchStartTime;

            // Thresholds
            const minDistance = 50;
            const maxTime = 500;

            if (dt < maxTime) {
                // Horizontal swipe (Left/Right)
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minDistance) {
                    if (dx < 0) {
                        // Swipe left -> Next view (Month to Week)
                        if (this.viewMode === 'month') this.setViewMode('week');
                    } else {
                        // Swipe right -> Prev view (Week to Month)
                        if (this.viewMode === 'week') this.setViewMode('month');
                    }
                }
                // Vertical swipe (Down) - User request: "slide down to week tab"
                else if (dy > Math.abs(dx) && dy > minDistance) {
                    if (this.viewMode === 'month') {
                        this.setViewMode('week');
                    }
                }
            }
        };
    }

    renderMonth(target) {
        const schedules = Storage.getAll();
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';

        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        weekdays.forEach(day => {
            const h = document.createElement('div');
            h.className = 'weekday-header';
            if (day === '日') h.classList.add('sunday');
            if (day === '土') h.classList.add('saturday');
            h.textContent = day;
            daysGrid.appendChild(h);
        });

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startDay = firstDay.getDay();

        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'day-cell empty';
            daysGrid.appendChild(empty);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const dateStr = formatDateForInput(new Date(this.currentYear, this.currentMonth, day));

            const num = document.createElement('div');
            num.className = 'day-number';
            num.textContent = day;
            cell.appendChild(num);

            const daySchedules = schedules.filter(s => s.date === dateStr);
            if (daySchedules.length > 0) {
                const envs = document.createElement('div');
                envs.className = 'day-events';
                daySchedules.slice(0, 3).forEach(s => {
                    const dot = document.createElement('div');
                    dot.className = `event-dot type-${s.category || 'その他'}`;
                    dot.textContent = s.title;
                    dot.onclick = (e) => { e.stopPropagation(); window.openEditModal(s.id); };
                    envs.appendChild(dot);
                });
                cell.appendChild(envs);
            }

            cell.onclick = () => {
                const modal = document.getElementById('schedule-modal');
                const form = document.getElementById('schedule-form');
                form.reset();
                form.id.value = '';
                document.getElementById('date').value = dateStr;
                modal.showModal();
            };
            daysGrid.appendChild(cell);
        }
        target.appendChild(daysGrid);
    }

    renderWeek(target) {
        const schedules = Storage.getAll();
        const container = document.createElement('div');
        container.className = 'weekly-vertical-container';

        const grid = document.createElement('div');
        grid.className = 'weekly-grid';

        // Time column
        const timeCol = document.createElement('div');
        timeCol.className = 'weekly-time-col';
        for (let h = 5; h <= 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'weekly-hour-cell';
            cell.textContent = `${h}:00`;
            timeCol.appendChild(cell);
        }
        grid.appendChild(timeCol);

        // Day columns
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = formatDateForInput(date);

            const col = document.createElement('div');
            col.className = 'weekly-day-col';

            const header = document.createElement('div');
            header.className = 'weekly-day-header';
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            header.innerHTML = `<span class="day-name">${dayNames[i]}</span><span class="day-num">${date.getDate()}</span>`;
            col.appendChild(header);

            const body = document.createElement('div');
            body.className = 'weekly-grid-body';

            // Grid lines
            const lines = document.createElement('div');
            lines.className = 'weekly-grid-lines';
            for (let h = 0; h <= 19; h++) {
                const line = document.createElement('div');
                line.className = 'weekly-grid-line';
                line.style.top = `${h * 60}px`;
                lines.appendChild(line);
            }
            body.appendChild(lines);

            // Events
            const daySchedules = schedules.filter(s => s.date === dateStr && s.startTime);
            daySchedules.forEach(s => {
                const [h, m] = s.startTime.split(':').map(Number);
                if (h >= 5 && h < 24) {
                    const top = (h - 5) * 60 + (m / 60) * 60;
                    const block = document.createElement('div');
                    block.className = `weekly-event-block type-${s.category || 'その他'}`;
                    block.style.top = `${top}px`;
                    block.dataset.id = s.id;

                    let height = 60;
                    if (s.endTime) {
                        const [eh, em] = s.endTime.split(':').map(Number);
                        height = Math.max(30, (eh - h) * 60 + (em - m));
                    }
                    block.style.height = `${height}px`;
                    block.innerHTML = `<span class="event-time">${s.startTime}</span>${s.title}`;

                    // Click to edit, but distinguish from drag
                    let isDragging = false;
                    block.onclick = () => { if (!isDragging) window.openEditModal(s.id); };

                    this.setupDragEvents(block, s, top);

                    body.appendChild(block);
                }
            });

            col.appendChild(body);
            grid.appendChild(col);
        }

        container.appendChild(grid);
        target.appendChild(container);
    }

    setupDragEvents(block, schedule, initialTop) {
        let startY = 0;
        let startTop = initialTop;

        const onPointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            block.setPointerCapture(e.pointerId);
            startY = e.clientY;
            startTop = parseFloat(block.style.top);
            block.classList.add('dragging');
        };

        const onPointerMove = (e) => {
            if (!block.classList.contains('dragging')) return;
            const dy = e.clientY - startY;
            let newTop = startTop + dy;

            // Constrain 5:00 - 24:00
            newTop = Math.max(0, Math.min(newTop, 19 * 60)); // Max 24:00

            // Snap to 15 mins (15px)
            newTop = Math.round(newTop / 15) * 15;

            block.style.top = `${newTop}px`;

            // Update temporary time display
            let hours = Math.floor(newTop / 60) + 5;
            const mins = (newTop % 60);
            const timeStr = `${hours}:${mins.toString().padStart(2, '0')}`;
            const timeLabel = block.querySelector('.event-time');
            if (timeLabel) timeLabel.textContent = timeStr;
        };

        const onPointerUp = (e) => {
            if (!block.classList.contains('dragging')) return;
            block.classList.remove('dragging');
            block.releasePointerCapture(e.pointerId);

            const finalTop = parseFloat(block.style.top);
            if (finalTop === startTop) return; // No change

            // Calculate new times
            let hours = Math.floor(finalTop / 60) + 5;
            const mins = (finalTop % 60);
            const newStartTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

            // Shift end time by same duration
            let newEndTime = schedule.endTime;
            if (schedule.startTime && schedule.endTime) {
                const [sh, sm] = schedule.startTime.split(':').map(Number);
                const [eh, em] = schedule.endTime.split(':').map(Number);
                const duration = (eh * 60 + em) - (sh * 60 + sm);

                const endTotal = (hours * 60 + mins) + duration;
                const eh_new = Math.floor(endTotal / 60);
                const em_new = endTotal % 60;
                newEndTime = `${eh_new}:${em_new.toString().padStart(2, '0')}`;
            }

            // Save
            const updated = { ...schedule, startTime: newStartTime, endTime: newEndTime };
            Storage.save(updated);

            // Refresh to ensure everything is consistent
            this.render();
        };

        block.onpointerdown = onPointerDown;
        block.onpointermove = onPointerMove;
        block.onpointerup = onPointerUp;
        block.onpointercancel = onPointerUp;
    }
}

export const Calendar = new CalendarInstance('calendar-view');
