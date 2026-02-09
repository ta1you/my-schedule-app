import { Storage } from './storage.js';
import { UI } from './ui.js';
import { generateId, getTodayString } from './utils.js';
import { Calendar } from './calendar.js';
import { Finance } from './finance.js';
import { Kakeibo } from './kakeibo.js';
import { Settings } from './settings.js';

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
    Calendar.init(); // Init calendar first so it finds the element
    Settings.init(); // Init settings (creates listeners)

    // Init Storage with callback to refresh UI and Calendar
    Storage.init(() => {
        UI.render();
        Calendar.refresh();
    });

    // Actually, setupEventListeners defines 'window.renderFinanceView'. 

    setupEventListeners();

    Finance.init(() => {
        if (window.renderFinanceView) window.renderFinanceView();
    });

    Kakeibo.init(() => {
        if (window.renderKakeiboView) window.renderKakeiboView();
    });
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
    const btnKakeibo = document.getElementById('btn-kakeibo'); // New button
    const btnSettings = document.getElementById('btn-settings');
    const listView = document.getElementById('schedule-list');
    const calendarView = document.getElementById('calendar-view');
    const financeView = document.getElementById('finance-view');
    const kakeiboView = document.getElementById('kakeibo-view'); // New view
    const settingsView = document.getElementById('settings-view');

    // Helper to set view state; uses both attribute and fallback class for robustness
    function setView(viewName) {
        document.getElementById('main-content').scrollTop = 0; // Reset scroll position
        const categoryTabs = document.querySelector('.category-tabs');

        // Hide all views first
        listView.hidden = true;
        calendarView.hidden = true;
        if (financeView) financeView.hidden = true;
        if (kakeiboView) kakeiboView.hidden = true;
        if (settingsView) settingsView.hidden = true;

        listView.style.display = 'none';
        calendarView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';

        // Deactivate all buttons
        btnList.classList.remove('active');
        btnCalendar.classList.remove('active');
        if (btnFinance) btnFinance.classList.remove('active');
        if (btnKakeibo) btnKakeibo.classList.remove('active');
        if (btnSettings) btnSettings.classList.remove('active');

        // Default FAB visibility
        fab.hidden = true;

        // Handle specific view
        if (viewName === 'list') {
            listView.hidden = false;
            listView.classList.remove('is-hidden');
            listView.style.display = '';

            btnList.classList.add('active');
            fab.hidden = false;

            if (categoryTabs) {
                categoryTabs.hidden = false;
                categoryTabs.style.display = '';
            }
        } else if (viewName === 'calendar') {
            calendarView.hidden = false;
            calendarView.classList.remove('is-hidden');
            calendarView.style.display = '';

            btnCalendar.classList.add('active');

            if (categoryTabs) {
                categoryTabs.hidden = true;
                categoryTabs.style.display = 'none';
            }
        } else if (viewName === 'finance') {
            if (financeView) financeView.hidden = false;
            if (btnFinance) btnFinance.classList.add('active');
            if (categoryTabs) categoryTabs.hidden = true;

            // set default date
            const fdate = document.getElementById('finance-date');
            if (fdate) fdate.value = getTodayString();

            if (window.renderFinanceView) window.renderFinanceView();

        } else if (viewName === 'kakeibo') {
            if (kakeiboView) kakeiboView.hidden = false;
            if (btnKakeibo) btnKakeibo.classList.add('active');
            if (categoryTabs) categoryTabs.hidden = true;

            const kdate = document.getElementById('kakeibo-date');
            if (kdate) kdate.value = getTodayString();

            if (window.renderKakeiboView) window.renderKakeiboView();

        } else if (viewName === 'settings') {
            if (settingsView) {
                settingsView.hidden = false;
                settingsView.style.display = '';
            }
            if (btnSettings) btnSettings.classList.add('active');

            if (categoryTabs) {
                categoryTabs.hidden = true;
                categoryTabs.style.display = 'none';
            }
        }
    }

    // initial state: show list
    setView('list');

    btnList.addEventListener('click', () => setView('list'));
    btnCalendar.addEventListener('click', () => setView('calendar'));
    if (btnFinance) btnFinance.addEventListener('click', () => setView('finance'));
    if (btnKakeibo) btnKakeibo.addEventListener('click', () => setView('kakeibo'));
    if (btnSettings) btnSettings.addEventListener('click', () => setView('settings'));

    // Handle finance form submission
    const financeForm = document.getElementById('finance-form');
    if (financeForm) {
        financeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const date = document.getElementById('finance-date').value;
            const type = document.getElementById('finance-type').value; // slot/pachinko/other
            const investment = Number(document.getElementById('finance-investment').value) || 0;
            const payout = Number(document.getElementById('finance-payout').value) || 0;
            const note = document.getElementById('finance-note').value || '';
            const amount = payout - investment; // Calculate profit/loss

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

            document.getElementById('finance-investment').value = '';
            document.getElementById('finance-payout').value = '';
            document.getElementById('finance-note').value = '';
        });
    }

    // Handle Kakeibo submit
    const kakeiboForm = document.getElementById('kakeibo-form');
    if (kakeiboForm) {
        kakeiboForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const date = document.getElementById('kakeibo-date').value;
            const amount = Number(document.getElementById('kakeibo-amount').value) || 0;
            const category = document.getElementById('kakeibo-category').value;
            const note = document.getElementById('kakeibo-note').value || '';
            const typeRadio = document.querySelector('input[name="ktype"]:checked');
            const type = typeRadio ? typeRadio.value : 'expense';

            const item = {
                id: generateId(),
                date,
                type,
                category,
                amount,
                note
            };
            Kakeibo.save(item);

            document.getElementById('kakeibo-amount').value = '';
            document.getElementById('kakeibo-note').value = '';
        });
    }

    // Modal category management (derived from title)
    let selectedCategory = 'その他';
    const titleInput = document.getElementById('title');

    // Auto-select category when title matches options from datalist
    titleInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (['バイト', '学校', 'その他'].includes(val)) {
            selectedCategory = val;
        }
    });

    // Open Modal (Add)
    fab.addEventListener('click', () => {
        form.reset();
        document.getElementById('date').value = getTodayString();
        form.id.value = '';
        document.getElementById('modal-title').textContent = '予定を追加';
        deleteBtn.hidden = true;
        // Reset category to default
        selectedCategory = 'その他';
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

        // Set category
        selectedCategory = schedule.category || 'その他';

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

        function pad(n) { return n < 10 ? '0' + n : '' + n; }

        function renderAndPopulate() {
            try {
                const mode = (modeSelect && modeSelect.value) || 'pie';
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
                entriesDiv.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:1rem;">今月のデータはありません</div>`;
                return;
            }

            // Sort by date desc
            items.sort((a, b) => new Date(b.date) - new Date(a.date));

            entriesDiv.innerHTML = '<h4 style="font-size:0.9rem; margin-bottom:0.5rem; border-left:3px solid var(--primary-color); padding-left:8px;">履歴</h4>' + items.map(it => {
                const day = new Date(it.date).getDate();
                const isIncome = it.type === 'income';
                const color = isIncome ? 'var(--success-color)' : 'var(--text-primary)';
                const sign = isIncome ? '+' : '';
                return `
                    <div class="finance-entry" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:white; border-radius:8px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:0.8rem; color:var(--text-tertiary);">${day}日 · ${it.category}</span>
                            <span style="font-size:0.9rem; font-weight:500;">${it.note || '-'}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:700; color:${color}; font-size:1rem;">${sign}￥${Number(it.amount).toLocaleString()}</span>
                            <button class="btn-del" data-id="${it.id}" style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:1.2rem;">×</button>
                        </div>
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
                    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const items = Finance.getMonthlyEntries(year, month).filter(it => it.date === dateStr);
                    let totalInvest = 0, totalPayout = 0;
                    const rows = items.map(it => {
                        totalInvest += Number(it.investment) || 0;
                        totalPayout += Number(it.payout) || 0;
                        const amt = Number(it.amount) || (Number(it.payout) || 0) - (Number(it.investment) || 0);
                        return `<div style="margin-top:4px;">${it.type || 'その他'} ${it.note ? '・' + it.note : ''}<br>投:${(it.investment || 0).toLocaleString()} 回:${(it.payout || 0).toLocaleString()} 差額:￥${amt.toLocaleString()}</div>`;
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

    // Backup & Restore

    setupFinanceInteractions();
    setupKakeiboInteractions();
}

// Separate Kakeibo setup
function setupKakeiboInteractions() {
    const canvas = document.getElementById('kakeibo-chart');
    const modeSelect = document.getElementById('kakeibo-mode');
    const entriesDiv = document.getElementById('kakeibo-entries');

    if (!canvas) return;

    let activeCategoryFilter = null;
    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();

    function renderAndPopulate() {
        const mode = (modeSelect && modeSelect.value) || 'pie';
        // Pass year and month to methods
        Kakeibo.renderChart(canvas, mode, viewYear, viewMonth);
        updateCategorySelectionUI();

        // Update Title and Populate List
        const titleLabel = document.getElementById('kakeibo-month-label');
        if (titleLabel) {
            titleLabel.textContent = `${viewYear}年${viewMonth + 1}月`;
        }
        populateEntries();
    }

    // Navigation Listeners
    const prevBtn = document.getElementById('kakeibo-prev-month');
    const nextBtn = document.getElementById('kakeibo-next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            viewMonth--;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
            }
            activeCategoryFilter = null; // Clear filter on change
            renderAndPopulate();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            viewMonth++;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
            }
            activeCategoryFilter = null;
            renderAndPopulate();
        });
    }

    // Helper to highlight selected category in the list
    function updateCategorySelectionUI() {
        // Wait briefly for DOM update if coming from renderChart, or just run
        setTimeout(() => {
            const listContainer = document.getElementById('kakeibo-category-list');
            if (!listContainer) return;
            const items = listContainer.querySelectorAll('.category-list-item');
            items.forEach(el => {
                // Reset basic styles first
                el.style.background = 'transparent';
                el.style.borderLeft = 'none';

                if (activeCategoryFilter && el.dataset.category === activeCategoryFilter) {
                    el.style.background = '#f1f5f9'; // Slight grey/blue
                    el.style.borderLeft = '4px solid var(--primary-color)';
                    el.style.paddingLeft = '8px'; // Add some padding for the border
                } else {
                    el.style.paddingLeft = '4px';
                }
            });
        }, 0);
    }

    function populateEntries() {
        if (!entriesDiv) return;
        // Use viewYear/viewMonth instead of now
        let items = Kakeibo.getMonthlyEntries(viewYear, viewMonth);

        let headerHtml = '';

        // Filter by category if one is selected
        if (activeCategoryFilter) {
            items = items.filter(it => it.category === activeCategoryFilter);
            headerHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border-left: 4px solid var(--primary-color);">
                    <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">フィルタ: ${activeCategoryFilter}</span>
                    <button class="btn-clear-filter" style="background: none; border: none; font-size: 0.8rem; color: var(--text-tertiary); cursor: pointer; text-decoration: underline;">解除</button>
                </div>
            `;
        }

        if (!items || items.length === 0) {
            const msg = activeCategoryFilter
                ? `「${activeCategoryFilter}」の履歴はありません`
                : 'データなし';
            entriesDiv.innerHTML = headerHtml + `<div style="color:var(--text-secondary); text-align:center; padding:1rem;">${msg}</div>`;
        } else {
            items.sort((a, b) => new Date(b.date) - new Date(a.date));
            const entriesHtml = items.map(it => {
                const day = new Date(it.date).getDate();
                const isIncome = it.type === 'income';
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:white; border-radius:8px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:0.8rem; color:var(--text-tertiary);">${day}日 · ${it.category}</span>
                            <span style="font-size:0.9rem; font-weight:500;">${it.note || '-'}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:700; color:${isIncome ? 'var(--success-color)' : 'var(--text-primary)'}; font-size:1rem;">${isIncome ? '+' : ''}￥${Number(it.amount).toLocaleString()}</span>
                            <button class="btn-del-k" data-id="${it.id}" style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:1.2rem;">×</button>
                        </div>
                    </div>`;
            }).join('');
            entriesDiv.innerHTML = headerHtml + entriesHtml;
        }

        // Attach listener for clear button dynamically
        const clearBtn = entriesDiv.querySelector('.btn-clear-filter');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                activeCategoryFilter = null;
                updateCategorySelectionUI();
                populateEntries();
            });
        }
    }

    // Event delegation for category list clicks
    const listContainer = document.getElementById('kakeibo-category-list');
    if (listContainer) {
        // Remove previous listener if any (conceptually, though simple replacement works here)
        // using a flag or just adding it once? setupKakeiboInteractions is called once on init.
        listContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.category-list-item');
            if (item) {
                const cat = item.dataset.category;
                if (activeCategoryFilter === cat) {
                    activeCategoryFilter = null; // Toggle off
                } else {
                    activeCategoryFilter = cat;
                }
                updateCategorySelectionUI();
                populateEntries();
            }
        });
    }

    if (entriesDiv) entriesDiv.addEventListener('click', (e) => {
        const b = e.target.closest('.btn-del-k');
        if (b && confirm('削除しますか？')) {
            Kakeibo.delete(b.dataset.id);
            renderAndPopulate();
        }
    });

    if (modeSelect) modeSelect.addEventListener('change', renderAndPopulate);
    window.renderKakeiboView = renderAndPopulate;
    renderAndPopulate(); // Initial
}


