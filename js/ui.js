import { Storage } from './storage.js';
import { getTodayString } from './utils.js';

export const UI = {
    currentCategory: 'all',
    swipeState: {
        activeElement: null,
        startX: 0,
        currentX: 0,
        startTime: 0,
        threshold: 50, // min swipe to show delete/edit
        maxSwipeLeft: -80, // width of delete button
        maxSwipeRight: 80  // width of edit button
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
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.render();
            });
        });
    },

    initSwipe(el) {
        const inner = el.querySelector('.schedule-item-inner');
        let isSwiping = false;

        el.addEventListener('touchstart', (e) => {
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

            // Limit swipe distance
            let moveX = diffX;
            if (diffX < 0) {
                moveX = Math.max(diffX, this.swipeState.maxSwipeLeft - 20);
            } else {
                moveX = Math.min(diffX, this.swipeState.maxSwipeRight + 20);
            }

            inner.style.transform = `translateX(${moveX}px)`;
            if (Math.abs(diffX) > 10) isSwiping = true;
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            el.classList.remove('swiping');
            const diffX = e.changedTouches[0].clientX - this.swipeState.startX;
            const duration = Date.now() - this.swipeState.startTime;

            if (diffX < -this.swipeState.threshold || (diffX < -20 && duration < 250)) {
                this.openSwipe(el, 'left');
            } else if (diffX > this.swipeState.threshold || (diffX > 20 && duration < 250)) {
                this.openSwipe(el, 'right');
            } else {
                this.closeSwipe(el);
            }

            if (isSwiping) {
                el.style.pointerEvents = 'none';
                setTimeout(() => el.style.pointerEvents = '', 150);
            }
        });
    },

    openSwipe(el, direction) {
        const inner = el.querySelector('.schedule-item-inner');
        const moveX = direction === 'left' ? this.swipeState.maxSwipeLeft : this.swipeState.maxSwipeRight;
        inner.style.transform = `translateX(${moveX}px)`;
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
        } else {
            this.closeAllSwipes();
        }
    },

    handleEdit(id) {
        if (!id) return;
        if (window.openEditModal) window.openEditModal(id);
        this.closeAllSwipes();
    },

    closeAllSwipes() {
        if (this.swipeState.activeElement) {
            this.closeSwipe(this.swipeState.activeElement);
        }
    },

    render() {
        let schedules = Storage.getAll();

        if (this.currentCategory !== 'all') {
            schedules = schedules.filter(s => (s.category || 'その他') === this.currentCategory);
        }

        const today = getTodayString();
        schedules = schedules.filter(s => s.date && s.date >= today);

        schedules.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

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
            el.dataset.id = schedule.id;

            let timeStr = schedule.startTime || '終日';
            if (schedule.startTime && schedule.endTime) timeStr = `${schedule.startTime}〜${schedule.endTime}`;

            const category = schedule.category || 'その他';
            const categoryClass = `category-badge category-${category}`;

            el.innerHTML = `
                <div class="schedule-item-actions left-actions">
                    <button type="button" class="btn-swipe-edit" aria-label="編集">
                        <span style="font-size: 1.2rem;">✏️</span>
                        <span style="font-size: 0.7rem;">編集</span>
                    </button>
                </div>
                <div class="schedule-item-actions">
                    <button type="button" class="btn-swipe-delete" aria-label="削除">
                        <span style="font-size: 1.2rem;">🗑️</span>
                        <span style="font-size: 0.7rem;">削除</span>
                    </button>
                </div>
                <div class="schedule-item-inner">
                    <div class="schedule-time">${timeStr}</div>
                    <div class="schedule-title">${escapeHtml(schedule.title)}</div>
                    <div class="${categoryClass}">${escapeHtml(category)}</div>
                    ${schedule.description ? `<div class="schedule-desc">${escapeHtml(schedule.description)}</div>` : ''}
                </div>
            `;

            // Setup events
            const inner = el.querySelector('.schedule-item-inner');
            inner.onclick = (e) => {
                if (this.swipeState.activeElement) {
                    this.closeSwipe(this.swipeState.activeElement);
                    e.stopPropagation();
                    return;
                }
                window.openEditModal(schedule.id);
            };

            const delBtn = el.querySelector('.btn-swipe-delete');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.handleDelete(schedule.id);
            };

            const editBtn = el.querySelector('.btn-swipe-edit');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.handleEdit(schedule.id);
            };

            this.initSwipe(el);
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
