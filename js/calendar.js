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
        
        target.innerHTML = '';
        
        // Use a wrapper or class instead of inline styles if needed, 
        // but flex is needed for timeline layout. We must NOT set height inline.
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
        target.style.background = '#ffffff';

        // 1. Ribbon top part
        const ribbon = document.createElement('div');
        ribbon.className = 'ios-week-ribbon';

        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay()); // Sunday start

        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        for (let i = 0; i < 7; i++) {
            const iterDate = new Date(startOfWeek);
            iterDate.setDate(startOfWeek.getDate() + i);
            const isSelected = iterDate.getFullYear() === this.currentDate.getFullYear() &&
                               iterDate.getMonth() === this.currentDate.getMonth() &&
                               iterDate.getDate() === this.currentDate.getDate();
                               
            const dayEl = document.createElement('div');
            dayEl.className = `ios-ribbon-day ${isSelected ? 'selected' : ''}`;
            
            const dayNameEl = document.createElement('div');
            dayNameEl.className = 'day-name';
            if(i===0) dayNameEl.style.color = isSelected ? 'white' : '#ef4444';
            if(i===6) dayNameEl.style.color = isSelected ? 'white' : '#3b82f6';
            dayNameEl.textContent = dayNames[i];
            
            const dayNumEl = document.createElement('div');
            dayNumEl.className = 'day-num';
            dayNumEl.textContent = iterDate.getDate();
            
            dayEl.appendChild(dayNameEl);
            dayEl.appendChild(dayNumEl);
            
            dayEl.onclick = () => {
                this.currentDate = new Date(iterDate);
                this.render(); // Re-render to update view
            };
            
            ribbon.appendChild(dayEl);
        }
        
        target.appendChild(ribbon);

        // 2. Date Header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'ios-date-header';
        dateHeader.textContent = `${this.currentDate.getFullYear()}年${this.currentDate.getMonth() + 1}月${this.currentDate.getDate()}日 ${dayNames[this.currentDate.getDay()]}曜日`;
        target.appendChild(dateHeader);

        // 3. Timeline Area
        const timelineArea = document.createElement('div');
        timelineArea.className = 'ios-timeline-area';

        // 24 Hour grid
        const gridBody = document.createElement('div');
        gridBody.className = 'ios-timeline-grid';
        
        for (let h = 0; h <= 24; h++) {
            const row = document.createElement('div');
            row.className = 'ios-timeline-row';
            row.style.top = `${h * 60}px`;
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'ios-timeline-time';
            if(h < 24) timeLabel.textContent = `${String(h).padStart(2,'0')}:00`;
            
            const line = document.createElement('div');
            line.className = 'ios-timeline-line';
            
            row.appendChild(timeLabel);
            row.appendChild(line);
            gridBody.appendChild(row);
        }

        // Current time line
        const now = new Date();
        if (now.getFullYear() === this.currentDate.getFullYear() &&
            now.getMonth() === this.currentDate.getMonth() &&
            now.getDate() === this.currentDate.getDate()) {
            
            const currentLine = document.createElement('div');
            currentLine.className = 'ios-current-time-line';
            
            const currentMins = now.getHours() * 60 + now.getMinutes();
            currentLine.style.top = `${currentMins}px`;
            
            const dot = document.createElement('div');
            dot.className = 'ios-current-time-dot';
            currentLine.appendChild(dot);
            
            const timeText = document.createElement('div');
            timeText.className = 'ios-current-time-text';
            timeText.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            currentLine.appendChild(timeText);
            
            gridBody.appendChild(currentLine);
        }

        // Events
        const targetDateStr = formatDateForInput(this.currentDate);
        const daySchedules = schedules.filter(s => s.date === targetDateStr && s.startTime);
        
        // Sort by start time for overlap logic
        daySchedules.sort((a,b) => {
            const aMins = parseInt(a.startTime.split(':')[0])*60 + parseInt(a.startTime.split(':')[1]);
            const bMins = parseInt(b.startTime.split(':')[0])*60 + parseInt(b.startTime.split(':')[1]);
            return aMins - bMins;
        });

        const CATEGORY_COLORS = { '勉強':'#3b82f6', 'バイト':'#8b5cf6', '学校':'#10b981', '予定':'#10b981', '遊び':'#f59e0b', 'その他':'#64748b' };
        let placedEvents = [];

        daySchedules.forEach(s => {
            const [h, m] = s.startTime.split(':').map(Number);
            const startMins = h * 60 + m;
            let durationMins = 60; // default 1 hour
            
            if (s.endTime) {
                const [eh, em] = s.endTime.split(':').map(Number);
                durationMins = (eh * 60 + em) - startMins;
                if(durationMins < 15) durationMins = 15; // min height
            }

            // Naive overlapping logic
            const overlapping = placedEvents.filter(p => Math.max(startMins, p.startMins) < Math.min(startMins + durationMins, p.endMins));
            const leftIndex = overlapping.length; 

            const block = document.createElement('div');
            block.className = 'ios-timeline-event';
            block.style.top = `${startMins}px`;
            block.style.height = `${durationMins}px`;
            
            if (leftIndex > 0) {
                block.style.left = `calc(55px + ${leftIndex * 24}px)`; 
                block.style.width = `calc(100% - ${55 + leftIndex * 24 + 10}px)`; 
                block.style.zIndex = 10 + leftIndex;
                block.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)';
            }
            
            const baseColor = s.customColor || CATEGORY_COLORS[s.category] || CATEGORY_COLORS['その他'];
            block.style.borderLeftColor = baseColor;
            
            // convert hex to rgba
            let r=241, g=245, b=249; 
            if(baseColor.startsWith('#') && baseColor.length === 7) {
                r = parseInt(baseColor.substring(1,3), 16);
                g = parseInt(baseColor.substring(3,5), 16);
                b = parseInt(baseColor.substring(5,7), 16);
            }
            block.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.18)`;

            block.innerHTML = `
                 <div class="event-title" style="color: ${baseColor}; font-weight: bold; font-size: 0.8rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; padding: 2px 4px;">${s.title}</div>
            `;
            
            let isDragging = false;
            block.onclick = () => { if(!isDragging) window.openEditModal(s.id); };
            
            gridBody.appendChild(block);
            placedEvents.push({ startMins, endMins: startMins + durationMins });
        });

        timelineArea.appendChild(gridBody);
        target.appendChild(timelineArea);

        // Auto scroll
        setTimeout(() => {
            let scrollMins = 0;
            if (now.getFullYear() === this.currentDate.getFullYear() &&
                now.getMonth() === this.currentDate.getMonth() &&
                now.getDate() === this.currentDate.getDate()) {
                scrollMins = (now.getHours() * 60) - 120; // 2 hrs before
            } else {
                scrollMins = 8 * 60; // 8:00 AM
            }
            if (scrollMins < 0) scrollMins = 0;
            timelineArea.scrollTop = scrollMins;
        }, 50);
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
        
        const dateStrForHeader = `${y}年${m + 1}月${d}日 (${dayStr})`;
        header.innerHTML = `
            <div style="color: var(--text-primary); padding: 10px 16px 5px 16px; font-size: 1.05rem; font-weight: bold; text-align: left; margin: 0; border-bottom: 2px solid #f1f5f9;">
                ${dateStrForHeader}
            </div>
        `;

        listContainer.innerHTML = '';
        listContainer.style.background = '#ffffff'; // explicitly white background for items
        const list = document.createElement('div');
        list.className = 'today-schedule-list-v2';

        const yStr = y;
        const mStr = String(m + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const searchDateStr = `${yStr}-${mStr}-${dStr}`;

        const schedules = Storage.getAll().filter(s => s.date === searchDateStr);
        schedules.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        if (schedules.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 1.5rem 0;">予定なし</div>`;
        } else {
            const CATEGORY_COLORS = {
                '勉強': '#3b82f6',
                'バイト': '#8b5cf6',
                '学校': '#10b981',
                '予定': '#10b981',
                '遊び': '#f59e0b',
                'その他': '#64748b'
            };

            schedules.forEach(s => {
                const item = document.createElement('div');
                item.className = 'today-schedule-item-v2';
                
                let timeStr = s.startTime || '終日';
                if (s.startTime && s.endTime) timeStr = `${s.startTime} - ${s.endTime}`;
                
                const bgColor = s.customColor || CATEGORY_COLORS[s.category] || CATEGORY_COLORS['その他'];

                // Remove text from icon, make it a solid colored circle or rounded square
                let iconHtml = `
                    <div style="width: 14px; height: 14px; border-radius: 4px; background: ${bgColor}; flex-shrink: 0; margin-top: 2px;"></div>
                `;

                item.innerHTML = `
                    <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                        ${iconHtml}
                        <div style="font-size: 0.95rem; font-weight: bold; color: #334155; width: 100px; flex-shrink: 0;">
                            ${timeStr}
                        </div>
                        <div style="font-size: 0.95rem; color: #0f172a; flex: 1; overflow: hidden; font-weight: bold; line-height: 1.3;">
                            ${s.title}
                        </div>
                    </div>
                `;

                item.onclick = () => window.openEditModal(s.id);
                list.appendChild(item);
            });
        }
        
        listContainer.appendChild(list);
    }
}

export const Calendar = new CalendarInstance('calendar-view');
