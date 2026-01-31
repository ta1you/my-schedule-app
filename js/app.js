import { Storage } from './storage.js';
import { UI } from './ui.js';
import { generateId, getTodayString } from './utils.js';
import { Calendar } from './calendar.js';
import { Finance } from './finance.js';

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// Auto-unregister service workers on mobile once to force fresh assets
(function forceUnregisterSWOnMobile() {
    if (!('serviceWorker' in navigator)) return;
    if (sessionStorage.getItem('sw_update_forced')) return; // avoid reload loop

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || window.innerWidth <= 800;
    if (!isMobile) return;

    window.addEventListener('load', async () => {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (!regs || regs.length === 0) return;
            await Promise.all(regs.map(r => r.unregister()));
            sessionStorage.setItem('sw_update_forced', '1');
            console.log('Service workers unregistered to force update. Reloading...');
            location.reload();
        } catch (e) {
            console.warn('SW unregister failed', e);
        }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Calendar.init();
    setupEventListeners();
});

function setupEventListeners() {
    const modal = document.getElementById('schedule-modal');
    const form = document.getElementById('schedule-form');
    const fab = document.getElementById('fab-add');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('btn-cancel');
    const deleteBtn = document.getElementById('btn-delete');

    // Scroll to Today
    document.getElementById('btn-today').addEventListener('click', () => {
        // Switch to list view if in calendar view (optional, but makes sense)
        if (document.getElementById('schedule-list').hidden) {
            document.getElementById('btn-view-list').click();
        }

        UI.render(); // Re-render to ensure fresh state
        const todayHeaders = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.includes('今日'));
        if (todayHeaders.length > 0) {
            todayHeaders[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            document.getElementById('main-content').scrollTop = 0;
        }
    });

    // View Switching
    const btnList = document.getElementById('btn-view-list');
    const btnCalendar = document.getElementById('btn-view-calendar');
    const btnFinance = document.getElementById('btn-finance');
    const listView = document.getElementById('schedule-list');
    const calendarView = document.getElementById('calendar-view');
    const financeView = document.getElementById('finance-view');

    // Helper to set view state; uses both attribute and fallback class for robustness
    function setView(showList) {
        const categoryTabs = document.querySelector('.category-tabs');
        // always hide finance view when switching to list/calendar
        if (financeView) financeView.hidden = true;
        if (btnFinance) btnFinance.classList.remove('active');
        if (showList) {
            listView.hidden = false;
            calendarView.hidden = true;
            listView.classList.remove('is-hidden');
            calendarView.classList.add('is-hidden');
            // Inline style fallback
            listView.style.display = '';
            calendarView.style.display = 'none';
            btnList.classList.add('active');
            btnCalendar.classList.remove('active');
            fab.hidden = false;
            fab.classList.remove('is-hidden');
            // Show category tabs
            if (categoryTabs) {
                categoryTabs.hidden = false;
                categoryTabs.style.display = '';
            }
        } else {
            listView.hidden = true;
            calendarView.hidden = false;
            listView.classList.add('is-hidden');
            calendarView.classList.remove('is-hidden');
            // Inline style fallback
            listView.style.display = 'none';
            calendarView.style.display = '';
            btnList.classList.remove('active');
            btnCalendar.classList.add('active');
            fab.hidden = true;
            fab.classList.add('is-hidden');
            // Hide category tabs
            if (categoryTabs) {
                categoryTabs.hidden = true;
                categoryTabs.style.display = 'none';
            }
        }
    }

    // initial state: show list
    setView(true);

    btnList.addEventListener('click', () => setView(true));
    btnCalendar.addEventListener('click', () => setView(false));
    if (btnFinance) {
        btnFinance.addEventListener('click', () => {
            // hide list and calendar, show finance
            listView.hidden = true;
            calendarView.hidden = true;
            financeView.hidden = false;
            btnList.classList.remove('active');
            btnCalendar.classList.remove('active');
            btnFinance.classList.add('active');
            // hide fab and category tabs
            const fab = document.getElementById('fab-add');
            if (fab) fab.hidden = true;
            const categoryTabs = document.querySelector('.category-tabs');
            if (categoryTabs) categoryTabs.hidden = true;
            // set default date to today in the mini-form
            const fdate = document.getElementById('finance-date');
            if (fdate) fdate.value = getTodayString();
            // render chart (use exposed renderer if available)
            const canvas = document.getElementById('finance-chart');
            if (window.renderFinanceView) window.renderFinanceView(); else Finance.renderChart(canvas);
        });
    }

    // Handle finance form submission
    const financeForm = document.getElementById('finance-form');
    if (financeForm) {
        financeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const date = document.getElementById('finance-date').value;
            const type = document.getElementById('finance-type').value;
            const investment = Number(document.getElementById('finance-investment').value) || 0;
            const payout = Number(document.getElementById('finance-payout').value) || 0;
            const note = document.getElementById('finance-note').value || '';
            const amount = payout - investment;
            const item = {
                id: generateId(),
                date,
                type,
                investment,
                payout,
                amount,
                note
            };
            Finance.save(item);
            const canvas = document.getElementById('finance-chart');
            Finance.renderChart(canvas);
            // clear amount and note
            document.getElementById('finance-investment').value = '';
            document.getElementById('finance-payout').value = '';
            document.getElementById('finance-note').value = '';
        });
    }

    // Modal category select
    let selectedCategory = 'その他';
    const modalCategorySelect = document.getElementById('modal-category-select');
    const titleInput = document.getElementById('title');
    
    modalCategorySelect.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
    });

    // Click title input to open category dropdown
    titleInput.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        modalCategorySelect.focus();
        // Use showPicker() if available, otherwise click
        if (modalCategorySelect.showPicker) {
            modalCategorySelect.showPicker();
        } else {
            modalCategorySelect.click();
        }
    });

    // Open Modal (Add)
    fab.addEventListener('click', () => {
        form.reset();
        document.getElementById('date').value = getTodayString();
        form.id.value = '';
        document.getElementById('modal-title').textContent = '予定を追加';
        deleteBtn.hidden = true;
        // Reset category select to default
        selectedCategory = 'その他';
        modalCategorySelect.value = 'その他';
        modal.showModal();
    });

    // Close Modal
    const closeModal = () => modal.close();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Save
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const schedule = {
            id: formData.get('id') || generateId(),
            title: formData.get('title'),
            date: formData.get('date'),
            startTime: formData.get('start-time'),
            endTime: formData.get('end-time'),
            description: formData.get('description'),
            category: selectedCategory,
            createdAt: new Date().toISOString()
        };

        Storage.save(schedule);
        UI.render();
        Calendar.refresh();
        closeModal();
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        const id = form.id.value;
        if (id && confirm('この予定を削除しますか？')) {
            Storage.delete(id);
            UI.render();
            Calendar.refresh();
            closeModal();
        }
    });

    // Global expose for UI onclick
    window.openEditModal = (id) => {
        const schedule = Storage.getById(id);
        if (!schedule) return;

        form.id.value = schedule.id;
        document.getElementById('title').value = schedule.title;
        document.getElementById('date').value = schedule.date;
        document.getElementById('start-time').value = schedule.startTime;
        document.getElementById('end-time').value = schedule.endTime;
        document.getElementById('description').value = schedule.description;
        
        // Set category select
        selectedCategory = schedule.category || 'その他';
        modalCategorySelect.value = selectedCategory;

        document.getElementById('modal-title').textContent = '予定を編集';
        deleteBtn.hidden = false;
        modal.showModal();
    };

    // Finance interactions: tooltip, mode toggle, entries list
    function setupFinanceInteractions() {
        const canvas = document.getElementById('finance-chart');
        const modeSelect = document.getElementById('finance-mode');
        const tooltip = document.getElementById('finance-tooltip');
        const entriesDiv = document.getElementById('finance-entries');

        if (!canvas) {
            console.warn('finance-chart canvas not found');
            return;
        }

        function pad(n){ return n < 10 ? '0'+n : ''+n; }

        function renderAndPopulate() {
            try {
                const mode = (modeSelect && modeSelect.value) || 'cumulative';
                Finance.renderChart(canvas, mode);
                populateEntries();
            } catch (e) {
                console.error('renderChart error:', e);
            }
        }

        function populateEntries() {
            if (!entriesDiv) return;
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const items = Finance.getMonthlyEntries(year, month);
            if (!items || items.length === 0) {
                entriesDiv.innerHTML = `<div style="color:var(--text-secondary)">該当月の収支がありません</div>`;
                return;
            }

            entriesDiv.innerHTML = items.map(it => {
                const day = new Date(it.date).getDate();
                const amt = Number(it.amount) || (Number(it.payout)||0) - (Number(it.investment)||0);
                return `
                    <div class="finance-entry">
                        <div class="meta">${day}日 · ${it.type || 'その他'} · ${it.note || ''}</div>
                        <div class="meta">投:${(it.investment||0).toLocaleString()} 回:${(it.payout||0).toLocaleString()}</div>
                        <div class="amount">￥${amt.toLocaleString()}</div>
                        <button class="btn-del" data-id="${it.id}" aria-label="削除">✕</button>
                    </div>`;
            }).join('');
        }

        // delegate delete
        if (entriesDiv) entriesDiv.addEventListener('click', (e) => {
            const b = e.target.closest('.btn-del');
            if (!b) return;
            const id = b.dataset.id;
            if (!id) return;
            if (!confirm('この収支を削除しますか？')) return;
            Finance.delete(id);
            renderAndPopulate();
        });

        // tooltip interactions
        if (canvas) {
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const points = Finance.getLastPoints() || [];
                let closest = null;
                let minDist = 12; // px
                for (let p of points) {
                    const dx = x - p.x;
                    const dy = y - p.y;
                    const d = Math.hypot(dx, dy);
                    if (d < minDist) { closest = p; minDist = d; }
                }
                if (closest) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const day = closest.day || Math.ceil((closest.x - 36) / ((canvas.clientWidth - 72) / new Date(year, month + 1, 0).getDate()));
                    const dateStr = `${year}-${pad(month+1)}-${pad(day)}`;
                    const items = Finance.getMonthlyEntries(year, month).filter(it => it.date === dateStr);
                    let totalInvest = 0, totalPayout = 0;
                    const rows = items.map(it => {
                        totalInvest += Number(it.investment)||0;
                        totalPayout += Number(it.payout)||0;
                        const amt = Number(it.amount) || (Number(it.payout)||0) - (Number(it.investment)||0);
                        return `<div style="margin-top:4px;">${it.type || 'その他'} ${it.note ? '・'+it.note : ''}<br>投:${(it.investment||0).toLocaleString()} 回:${(it.payout||0).toLocaleString()} 差額:￥${amt.toLocaleString()}</div>`;
                    }).join('');
                    const net = totalPayout - totalInvest;
                    if (tooltip) {
                        tooltip.innerHTML = `<div style="font-weight:700;">${day}日</div><div>投:${totalInvest.toLocaleString()} 回:${totalPayout.toLocaleString()} 差額:￥${net.toLocaleString()}</div>${rows}`;
                        tooltip.hidden = false;
                        tooltip.style.left = `${e.clientX - rect.left}px`;
                        tooltip.style.top = `${e.clientY - rect.top - 12}px`;
                    }
                } else if (tooltip) {
                    tooltip.hidden = true;
                }
            });

            canvas.addEventListener('mouseleave', () => {
                const tooltip = document.getElementById('finance-tooltip');
                if (tooltip) tooltip.hidden = true;
            });
        }

        // mode change
        if (modeSelect) modeSelect.addEventListener('change', renderAndPopulate);

        // expose a renderer so other handlers can call it
        window.renderFinanceView = renderAndPopulate;

        // initial populate
        renderAndPopulate();
    }

    setupFinanceInteractions();
}

