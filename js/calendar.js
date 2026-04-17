import { Storage } from './storage.js';
import { formatDateForInput, getContrastYIQ, getTodayString } from './utils.js';
import { Settings } from './settings.js';

export class CalendarInstance {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.currentDate = new Date(); // Support for specific day in week view
        this.viewMode = 'month'; // 'month' or 'week'
        this.holidays = JSON.parse(localStorage.getItem('pwa_holidays_cache')) || {};

        // Internal preferences (dynamic based on Settings)
        this.getStartHour = () => Settings.prefs.calendarStart !== undefined ? Settings.prefs.calendarStart : 5;
        this.getEndHour = () => Settings.prefs.calendarEnd !== undefined ? Settings.prefs.calendarEnd : 24;
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.setupTouchEvents(); // Attach events once
        this.render();
        this.fetchHolidays();
    }

    async fetchHolidays() {
        try {
            const cachedKeys = Object.keys(this.holidays).length;
            const res = await fetch('https://holidays-jp.github.io/api/v1/date.json');
            if (res.ok) {
                const data = await res.json();
                this.holidays = data;
                localStorage.setItem('pwa_holidays_cache', JSON.stringify(data));
                
                // If we didn't have data before, re-render to show it
                if (cachedKeys === 0 && this.container) {
                    this.render();
                }
            }
        } catch(e) {
            console.error("Failed to fetch holidays", e);
        }
    }

    refresh() {
        if (!this.container) this.container = document.getElementById(this.containerId);
        if (this.container) this.render();
    }

    setViewMode(mode) {
        const oldMode = this.viewMode;
        if (oldMode === mode) return;
        this.viewMode = mode;

        if (mode === 'week') {
            if (this.currentDate.getFullYear() !== this.currentYear || this.currentDate.getMonth() !== this.currentMonth) {
                this.currentDate = new Date(this.currentYear, this.currentMonth, 1);
            }
        }

        const slider = this.container.querySelector('.calendar-slider');
        if (!slider) {
            this.render();
            return;
        }

        // Horizontal shift only
        slider.style.transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)';
        slider.style.transform = mode === 'month' ? 'translateX(0)' : 'translateX(-50%)';

        // Update active view data attribute for CSS height control
        this.container.dataset.view = mode;

        // Update buttons
        this.container.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update header label only (don't re-render entire grid during slide)
        this.updateHeaderLabel();
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
        this.container.dataset.view = this.viewMode;

        // --- Header Controls ---
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'calendar-controls';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<';
        prevBtn.className = 'btn btn-secondary';
        prevBtn.onclick = () => this.prev();

        const label = document.createElement('h2');
        label.id = 'calendar-header-label';
        label.style.margin = '0';
        label.style.fontSize = '1.1rem';
        this.container.appendChild(controlsDiv); // Need to append early for updateHeaderLabel

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

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>';
        nextBtn.className = 'btn btn-secondary';
        nextBtn.onclick = () => this.next();
        controlsDiv.appendChild(nextBtn);

        this.updateHeaderLabel();

        // --- Slider Wrapper ---
        const slider = document.createElement('div');
        slider.className = 'calendar-slider';

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

        // Set initial transform
        slider.style.transform = this.viewMode === 'month' ? 'translateX(0)' : 'translateX(-50%)';

        if (Settings.prefs.showShiftSalary) {
            this.renderShiftSalarySummary();
        }

        if (Settings.prefs.showTodaySchedule !== false) {
            this.renderTodaySchedule();
        }
    }

    updateHeaderLabel() {
        const label = document.getElementById('calendar-header-label');
        if (!label) return;

        if (this.viewMode === 'month') {
            label.textContent = `${this.currentYear}年 ${this.currentMonth + 1}月`;
        } else {
            const startOfWeek = new Date(this.currentDate);
            startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            label.textContent = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;
        }
    }

    setupTouchEvents() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        const handleStart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        };

        const handleEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            const dt = Date.now() - touchStartTime;

            // Thresholds
            const minDistance = 30; // More sensitive
            const maxTime = 400;

            if (dt < maxTime) {
                // Horizontal swipe
                if (Math.abs(dx) > minDistance && Math.abs(dx) > Math.abs(dy)) {
                    if (dx < -minDistance) {
                        if (this.viewMode === 'month') {
                            this.setViewMode('week', 'horizontal');
                        }
                    } else if (dx > minDistance) {
                        if (this.viewMode === 'week') {
                            this.setViewMode('month', 'horizontal');
                        }
                    }
                }
            }
        };

        // Add to the container once in init
        this.container.addEventListener('touchstart', handleStart, { passive: true });
        this.container.addEventListener('touchend', handleEnd, { passive: false });
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

            if (this.holidays[dateStr]) {
                cell.classList.add('holiday');
            }

            const headerRow = document.createElement('div');
            headerRow.className = 'day-cell-header';

            const num = document.createElement('div');
            num.className = 'day-number';
            num.textContent = day;
            headerRow.appendChild(num);

            if (this.holidays[dateStr]) {
                const hname = document.createElement('div');
                hname.className = 'holiday-name';
                hname.textContent = this.holidays[dateStr];
                headerRow.appendChild(hname);
            }
            
            cell.appendChild(headerRow);

            const daySchedules = schedules.filter(s => s.date === dateStr);
            if (daySchedules.length > 0) {
                const envs = document.createElement('div');
                envs.className = 'day-events';
                daySchedules.forEach(s => {
                    const dot = document.createElement('div');
                    dot.className = `event-dot type-${s.category || 'その他'}`;
                    dot.textContent = s.title;
                    if (s.customColor) {
                        dot.style.backgroundColor = s.customColor;
                        dot.style.color = getContrastYIQ(s.customColor);
                    }
                    dot.onclick = (e) => { e.stopPropagation(); window.openEditModal(s.id); };
                    envs.appendChild(dot);
                });
                
                cell.appendChild(envs);
            }

            cell.onclick = () => {
                if (window.openEditModal) {
                    // We don't have an ID for new items, so we might need a generic open modal
                    // In app.js, fab.click() handles new. Let's just trigger fab for now or use window.openAddModal if defined.
                    const fab = document.getElementById('fab-add');
                    if (fab) {
                        fab.click();
                        document.getElementById('date').value = dateStr;
                    }
                }
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

        const startH = this.getStartHour();
        const endH = this.getEndHour();

        // Time column
        const timeCol = document.createElement('div');
        timeCol.className = 'weekly-time-col';
        for (let h = startH; h <= endH; h++) {
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
            if (this.holidays[dateStr]) {
                header.classList.add('holiday');
            }
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            header.innerHTML = `<span class="day-name">${dayNames[i]}</span><span class="day-num">${date.getDate()}</span>`;
            if (this.holidays[dateStr]) {
                header.innerHTML += `<div class="holiday-name">${this.holidays[dateStr]}</div>`;
            }
            col.appendChild(header);

            const body = document.createElement('div');
            body.className = 'weekly-grid-body';

            // Grid lines
            const lines = document.createElement('div');
            lines.className = 'weekly-grid-lines';
            const numHours = endH - startH;
            for (let h = 0; h <= numHours; h++) {
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
                if (h >= startH && h < endH) {
                    const top = (h - startH) * 60 + (m / 60) * 60;
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
                    
                    if (s.customColor) {
                        block.style.backgroundColor = s.customColor;
                        block.style.color = getContrastYIQ(s.customColor);
                    }

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

            const startH = this.getStartHour();
            const endH = this.getEndHour();
            const numHours = endH - startH;

            // Constrain
            newTop = Math.max(0, Math.min(newTop, numHours * 60)); 

            // Snap to 15 mins (15px)
            newTop = Math.round(newTop / 15) * 15;

            block.style.top = `${newTop}px`;

            // Update temporary time display
            let hours = Math.floor(newTop / 60) + startH;
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

            const startH = this.getStartHour();
            // Calculate new times
            let hours = Math.floor(finalTop / 60) + startH;
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

    renderShiftSalarySummary() {
        if (!this.container) return;
        
        const schedules = Storage.getAll();
        let totalMinutes = 0;
        
        const year = this.currentYear;
        const monthFilterStr = `${year}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        
        const shiftEvents = schedules.filter(s => {
            // Category can be 'バイト'
            // Ensure date matches and has both startTime and endTime
            return s.category === 'バイト' && s.date && s.date.startsWith(monthFilterStr) && s.startTime && s.endTime;
        });
        
        shiftEvents.forEach(s => {
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            let duration = (eh * 60 + em) - (sh * 60 + sm);
            if (duration < 0) duration += 24 * 60; // Handle over-midnight
            totalMinutes += duration;
        });
        
        const totalHours = totalMinutes / 60;
        const hwage = Settings.prefs.hourlyWage || 1000;
        const totalSalary = Math.floor(totalHours * hwage);
        
        const summaryCard = document.createElement('div');
        summaryCard.className = 'shift-salary-card';
        summaryCard.style.cssText = `
            margin: 1rem;
            padding: 1rem;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.45);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255, 255, 255, 0.4);
        `;
        
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 2px;">${this.currentMonth + 1}月のバイト合計</div>
                              <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-primary);">${totalHours.toFixed(1)} <span style="font-size: 0.9rem; font-weight: normal;">時間</span></div>`;
                              
        const salaryDiv = document.createElement('div');
        salaryDiv.style.textAlign = 'right';
        salaryDiv.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 2px;">予想給料</div>
                               <div style="font-size: 1.3rem; font-weight: 800; color: #10b981;">¥${totalSalary.toLocaleString()}</div>`;
                               
        summaryCard.appendChild(titleDiv);
        summaryCard.appendChild(salaryDiv);
        
        this.container.appendChild(summaryCard);
    }
    
    renderTodaySchedule() {
        if (!this.container) return;
        
        if (!this.bottomScheduleDate) {
            this.bottomScheduleDate = new Date();
        }
        
        const card = document.createElement('div');
        card.className = 'today-schedule-container';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.marginBottom = '10px';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '〈';
        prevBtn.style.background = 'none';
        prevBtn.style.border = 'none';
        prevBtn.style.color = 'var(--text-secondary)';
        prevBtn.style.fontSize = '1.2rem';
        prevBtn.style.cursor = 'pointer';
        prevBtn.style.padding = '0 10px';
        
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '〉';
        nextBtn.style.background = 'none';
        nextBtn.style.border = 'none';
        nextBtn.style.color = 'var(--text-secondary)';
        nextBtn.style.fontSize = '1.2rem';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.padding = '0 10px';

        const header = document.createElement('h3');
        header.className = 'today-schedule-header';
        header.style.margin = '0';
        header.style.textAlign = 'center';
        header.style.flex = '1';

        headerContainer.appendChild(prevBtn);
        headerContainer.appendChild(header);
        headerContainer.appendChild(nextBtn);
        
        card.appendChild(headerContainer);

        const listContainer = document.createElement('div');
        listContainer.className = 'today-schedule-list-wrapper';
        card.appendChild(listContainer);

        let startX = 0;
        let startY = 0;
        let isDragging = false;

        card.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (!isDragging) return;
            const endX = e.changedTouches[0].clientX;
            const dx = endX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            isDragging = false;

            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                this.navigateBottomSchedule(header, listContainer, dx < 0 ? 1 : -1);
            }
        });

        prevBtn.addEventListener('click', () => {
            this.navigateBottomSchedule(header, listContainer, -1);
        });

        nextBtn.addEventListener('click', () => {
            this.navigateBottomSchedule(header, listContainer, 1);
        });

        this.updateBottomScheduleContent(header, listContainer);
        this.container.appendChild(card);
    }

    navigateBottomSchedule(header, listContainer, direction) {
        listContainer.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        listContainer.style.transform = direction > 0 ? 'translateX(-20px)' : 'translateX(20px)';
        listContainer.style.opacity = '0';
        
        setTimeout(() => {
            this.bottomScheduleDate.setDate(this.bottomScheduleDate.getDate() + direction);
            this.updateBottomScheduleContent(header, listContainer);
            
            listContainer.style.transition = 'none';
            listContainer.style.transform = direction > 0 ? 'translateX(20px)' : 'translateX(-20px)';
            
            void listContainer.offsetWidth; // reflow
            
            listContainer.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
            listContainer.style.transform = 'translateX(0)';
            listContainer.style.opacity = '1';
        }, 200);
    }

    updateBottomScheduleContent(header, listContainer) {
        const today = new Date();
        const y = this.bottomScheduleDate.getFullYear();
        const m = this.bottomScheduleDate.getMonth();
        const d = this.bottomScheduleDate.getDate();
        
        const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
        
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayStr = days[this.bottomScheduleDate.getDay()];

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        if (isToday) {
            header.innerHTML = `今日の予定 <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary); margin-left:8px;">${m + 1}/${d} (${dayStr})</span>`;
        } else if (y === tomorrow.getFullYear() && m === tomorrow.getMonth() && d === tomorrow.getDate()) {
            header.innerHTML = `明日の予定 <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary); margin-left:8px;">${m + 1}/${d} (${dayStr})</span>`;
        } else if (y === yesterday.getFullYear() && m === yesterday.getMonth() && d === yesterday.getDate()) {
            header.innerHTML = `昨日の予定 <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary); margin-left:8px;">${m + 1}/${d} (${dayStr})</span>`;
        } else {
            header.innerHTML = `${m + 1}月${d}日(${dayStr}) の予定`;
        }

        listContainer.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'today-schedule-list';

        const yStr = y;
        const mStr = String(m + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const searchDateStr = `${yStr}-${mStr}-${dStr}`;

        const schedules = Storage.getAll().filter(s => s.date === searchDateStr);
        schedules.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        if (schedules.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem 0;">予定なし</div>`;
        } else {
            schedules.forEach(s => {
                const item = document.createElement('div');
                item.className = 'today-schedule-item';
                
                let timeStr = s.startTime || '終日';
                if (s.startTime && s.endTime) timeStr = `${s.startTime}〜${s.endTime}`;
                
                const timeEl = document.createElement('div');
                timeEl.className = 'time';
                timeEl.textContent = timeStr;
                
                const titleEl = document.createElement('div');
                titleEl.className = 'title';
                titleEl.textContent = s.title;

                item.appendChild(timeEl);
                item.appendChild(titleEl);
                
                const CATEGORY_COLORS = {
                    '勉強': '#3b82f6',
                    'バイト': '#8b5cf6',
                    '学校': '#10b981',
                    '予定': '#10b981',
                    '遊び': '#f59e0b',
                    'その他': '#64748b'
                };
                
                if (s.customColor) {
                    item.style.borderLeftColor = s.customColor;
                } else {
                    item.style.borderLeftColor = CATEGORY_COLORS[s.category] || CATEGORY_COLORS['その他'];
                }

                item.onclick = () => window.openEditModal(s.id);
                list.appendChild(item);
            });
        }
        
        listContainer.appendChild(list);
    }
}

export const Calendar = new CalendarInstance('calendar-view');
