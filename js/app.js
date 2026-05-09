import { Storage } from './storage.js';
import { UI } from './ui.js';
import { generateId, getTodayString } from './utils.js';
import { Calendar, CalendarInstance } from './calendar.js';

import { Settings } from './settings.js';
import { CustomTabs } from './customTabs.js';
import { ShareFeature } from './share.js';
import { ScheduleImportManager } from './import.js?v=2';
import { Notifications } from './notifications.js';
import { setupQRSyncInteractions } from './qrSync.js';

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
    window.Calendar = Calendar;
    Settings.init();
    window.Settings = Settings;
    Notifications.init();


    ShareFeature.init();
    ScheduleImportManager.init();
    setupQRSyncInteractions();

    // CustomTabs setup happens in setupEventListeners where setView is accessible
    
    Storage.init(() => {
        UI.render();
        Calendar.refresh();
    });

    setupEventListeners();

    // 起動時のデータチェック: データが空の場合、バックアップ復元を促す
    setTimeout(() => {
        const hasAnyData = Object.keys(localStorage).some(key => {
            const val = localStorage.getItem(key);
            return key.includes('_pwa_data') && val && val.length > 2;
        });
        if (!hasAnyData) {
            if (confirm("データが空のようです。以前のバックアップ(JSONファイル)をお持ちの場合は、設定から復元できます。設定画面を開きますか？")) {
                document.getElementById('btn-settings').click();
            }
        }
    }, 1500);
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

        if (window.Calendar) {
            window.Calendar.bottomScheduleDate = new Date();
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
    const btnShare = document.getElementById('btn-share');
    const btnSettings = document.getElementById('btn-settings');
    const listView = document.getElementById('schedule-list');
    const calendarView = document.getElementById('calendar-view');
    const shareView = document.getElementById('share-view');
    const settingsView = document.getElementById('settings-view');

    // Helper to set view state; uses both attribute and fallback class for robustness
    function setView(viewName) {
        document.getElementById('main-content').scrollTop = 0; // Reset scroll position
        const categoryTabs = document.querySelector('.category-tabs');

        // Hide all views first
        listView.hidden = true;
        calendarView.hidden = true;
        if (shareView) shareView.hidden = true;
        const settingsView = document.getElementById('settings-view');
        const customTabView = document.getElementById('custom-tab-view');
        const importContainer = document.getElementById('schedule-import-container');
        
        if (importContainer) {
            importContainer.style.display = 'none';
        }

        listView.style.display = 'none';
        calendarView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';
        if (shareView) shareView.style.display = 'none';
        
        if (customTabView) {
            customTabView.hidden = true;
            customTabView.style.display = 'none';
        }

        // Deactivate all buttons
        btnList.classList.remove('active');
        btnCalendar.classList.remove('active');
        if (btnShare) btnShare.classList.remove('active');
        if (btnSettings) btnSettings.classList.remove('active');
        document.querySelectorAll('.ct-nav-btn').forEach(b => b.classList.remove('active'));

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
            if (categoryTabs) {
                categoryTabs.hidden = true;
                categoryTabs.style.display = 'none';
            }
            
            if (importContainer && Settings.prefs && Settings.prefs.showScheduleImport) {
                importContainer.style.display = 'block';
            }
        } else if (viewName === 'share') {
            if (shareView) {
                shareView.hidden = false;
                shareView.style.display = 'flex';
            }
            if (btnShare) btnShare.classList.add('active');
            if (categoryTabs) categoryTabs.hidden = true;

            if (window.loadShareSettings) window.loadShareSettings();

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
        } else if (viewName.startsWith('custom-')) {
            if (customTabView) {
                customTabView.hidden = false;
                customTabView.style.display = '';
                if (window.renderCustomTabView) window.renderCustomTabView(viewName);
            }
            const activeBtn = document.getElementById(`btn-${viewName}`);
            if (activeBtn) activeBtn.classList.add('active');
            
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
    if (btnShare) btnShare.addEventListener('click', () => setView('share'));
    if (btnSettings) btnSettings.addEventListener('click', () => setView('settings'));

    // Initialize custom tabs now that setView is defined
    CustomTabs.init((tabs) => {
        document.querySelectorAll('.ct-nav-btn').forEach(b => b.remove());
        const nav = document.getElementById('main-bottom-nav');
        if (!nav) return;
        
        tabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nav-item ct-nav-btn';
            btn.id = `btn-${tab.id}`;
            btn.innerHTML = `<span class="nav-icon" style="color: ${tab.color}">${tab.icon}</span><span class="nav-label">${tab.title}</span>`;
            
            btn.addEventListener('click', () => setView(tab.id));
            
            // Insert before the Settings button to keep Settings at the edge
            // Or just append. Settings is fixed in index.html, let's just insert before btnSettings
            if (btnSettings) {
                nav.insertBefore(btn, btnSettings);
            } else {
                nav.appendChild(btn);
            }
        });
    });

    const ctModalForm = document.getElementById('custom-tab-form');
    if (ctModalForm) {
        ctModalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('ct-modal-title').value;
            const template = document.getElementById('ct-modal-template').value;
            const icon = document.getElementById('ct-modal-icon').value;
            const color = document.getElementById('ct-modal-color').value;
            
            const newId = CustomTabs.addTab(title, template, icon, color);
            document.getElementById('custom-tab-modal').close();
            ctModalForm.reset();
            
            // After adding, auto navigate to it
            setView(newId);
        });
    }

    // Handle Kakeibo submit 
    // removed

    // Modal category management (derived from title)
    let selectedCategory = 'その他';
    const titleInput = document.getElementById('title');

    const dynamicColorContainer = document.getElementById('dynamic-color-container');
    
    function renderColorPickers(titles) {
        if (!dynamicColorContainer) return;
        const existingInputs = Array.from(dynamicColorContainer.querySelectorAll('.custom-color-input')).map(inp => inp.value);
        const defaultColor = existingInputs[0] || '#6366f1';

        let html = '<label>カラー</label>';
        titles.forEach((t, i) => {
            const val = existingInputs[i] || defaultColor;
            const labelHtml = titles.length > 1 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; margin-top: 4px; font-weight: bold;">「${t || '未定'}」のカラー:</div>` : '';
            html += `
            <div class="color-picker-group" data-index="${i}" style="margin-top: ${titles.length > 1 ? '4px' : '4px'}; padding-bottom: ${titles.length > 1 ? '8px' : '0'}; ${titles.length > 1 && i < titles.length - 1 ? 'border-bottom: 1px dashed #e2e8f0;' : ''}">
                ${labelHtml}
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="color" name="custom-color-${i}" class="custom-color-input" value="${val}" style="width: 32px; height: 32px; border: none; padding: 0; cursor: pointer; border-radius: 4px;">
                    <div class="color-presets" style="display: flex; gap: 6px;">
                        <button type="button" class="color-preset-btn" style="background: #ef4444;" data-color="#ef4444"></button>
                        <button type="button" class="color-preset-btn" style="background: #f59e0b;" data-color="#f59e0b"></button>
                        <button type="button" class="color-preset-btn" style="background: #22c55e;" data-color="#22c55e"></button>
                        <button type="button" class="color-preset-btn" style="background: #3b82f6;" data-color="#3b82f6"></button>
                        <button type="button" class="color-preset-btn" style="background: #8b5cf6;" data-color="#8b5cf6"></button>
                    </div>
                </div>
            </div>`;
        });
        dynamicColorContainer.innerHTML = html;
    }

    // Auto-select category when title matches options from datalist
    titleInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const parts = val.split(/[\s　]+/).filter(t => t.length > 0);
        if (parts.length === 0) {
            renderColorPickers(['']);
        } else {
            renderColorPickers(parts);
        }
        
        if (['バイト', '学校', 'その他'].includes(val)) {
            selectedCategory = val;
        }
    });

    // Open Modal (Add)
    fab.addEventListener('click', () => {
        form.reset();
        document.getElementById('date').value = getTodayString();
        renderColorPickers(['']);
        
        // ユーザー要望：00分から始まるとダイヤル操作が楽
        const now = new Date();
        const hourStr = String(now.getHours()).padStart(2, '0');
        document.getElementById('start-time').value = `${hourStr}:00`;
        
        form.querySelector('input[name="id"]').value = '';
        document.getElementById('modal-title').textContent = '予定を追加';
        deleteBtn.hidden = true;
        const copyBtn = document.getElementById('btn-copy');
        if (copyBtn) copyBtn.hidden = true;
        selectedCategory = 'その他';
        
        // The new template manager is explicitly opened via the button in the modal.
        // It will call window.openTemplateManager()

        
        if (modal.showModal) {
            modal.showModal();
        } else {
            modal.setAttribute('open', '');
        }
    });

    if (dynamicColorContainer) {
        dynamicColorContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-preset-btn')) {
                const color = e.target.dataset.color;
                const group = e.target.closest('.color-picker-group');
                const colorInput = group.querySelector('.custom-color-input');
                if (colorInput) {
                    colorInput.value = color;
                }
            }
        });
    }

    // Close Modal
    const closeModal = () => modal.close();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Save
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const scheduleIdFromForm = formData.get('id');
        
        const rawTitle = formData.get('title') || '';
        
        // Custom color
        const customColor = formData.get('custom-color') || '#6366f1';

        const titles = rawTitle.split(/[\s　]+/).filter(t => t.length > 0);
        if (titles.length === 0) titles.push('');

        titles.forEach((titleSegment, index) => {
            const colorInput = form.querySelector(`input[name="custom-color-${index}"]`);
            const targetColor = colorInput ? colorInput.value : customColor;
            
            const schedule = {
                id: (index === 0 && scheduleIdFromForm) ? scheduleIdFromForm : generateId(),
                title: titleSegment,
                date: formData.get('date'),
                startTime: formData.get('start-time'),
                endTime: formData.get('end-time'),
                description: formData.get('description'),
                category: selectedCategory,
                customColor: targetColor,
                createdAt: new Date().toISOString()
            };
            Storage.save(schedule);
        });

        UI.render();
        Calendar.refresh();
        closeModal();
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        const idInput = form.querySelector('input[name="id"]');
        const id = idInput ? idInput.value : null;
        if (id && confirm('この予定を削除しますか？')) {
            Storage.delete(id);
            UI.render();
            Calendar.refresh();
            closeModal();
        }
    });

    // Copy
    const copyBtn = document.getElementById('btn-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = ''; // 必須: IDをクリアして新規保存扱いに
            document.getElementById('modal-title').textContent = '予定を複製 (新規保存)';
            deleteBtn.hidden = true;
            copyBtn.hidden = true;
        });
    }

    // Global expose for UI onclick
    window.openEditModal = (id) => {
        const schedule = Storage.getById(id);
        if (!schedule) return;

        form.querySelector('input[name="id"]').value = schedule.id;
        document.getElementById('title').value = schedule.title || '';
        document.getElementById('date').value = schedule.date || getTodayString();
        document.getElementById('start-time').value = schedule.startTime || '';
        document.getElementById('end-time').value = schedule.endTime || '';
        document.getElementById('description').value = schedule.description || '';
        
        renderColorPickers([schedule.title || '']);
        const inputs = dynamicColorContainer.querySelectorAll('.custom-color-input');
        if (inputs.length > 0) {
            inputs[0].value = schedule.customColor || '#6366f1';
        }

        // Set category
        selectedCategory = schedule.category || 'その他';

        document.getElementById('modal-title').textContent = '予定を編集';
        deleteBtn.hidden = false;
        const copyBtn = document.getElementById('btn-copy');
        if (copyBtn) copyBtn.hidden = false;
        
        // Hide templates when editing
        const templateContainer = document.getElementById('schedule-templates');
        if (templateContainer) templateContainer.style.display = 'none';

        if (modal.showModal) {
            modal.showModal();
        } else {
            modal.setAttribute('open', ''); // Fallback for some environments
        }
    };

    // Removed finance and bookkeeping

    setupTemplateManagerInteractions();
}

// Template Manager Implementation
function setupTemplateManagerInteractions() {
    let currentTab = 'templates'; // 'templates' or 'history'
    
    window.openTemplateManager = () => {
        const modal = document.getElementById('template-manager-modal');
        if (modal) {
            if (modal.showModal) modal.showModal();
            else modal.setAttribute('open', '');
            renderTemplateList();
        }
    };
    
    const tabTemplates = document.getElementById('tab-templates');
    const tabHistory = document.getElementById('tab-history');
    
    if (tabTemplates && tabHistory) {
        tabTemplates.addEventListener('click', () => {
            currentTab = 'templates';
            tabTemplates.style.background = '#3b82f6';
            tabTemplates.style.color = 'white';
            tabHistory.style.background = 'transparent';
            tabHistory.style.color = '#64748b';
            renderTemplateList();
        });
        
        tabHistory.addEventListener('click', () => {
            currentTab = 'history';
            tabHistory.style.background = '#3b82f6';
            tabHistory.style.color = 'white';
            tabTemplates.style.background = 'transparent';
            tabTemplates.style.color = '#64748b';
            renderTemplateList();
        });
    }

    const btnAdd = document.getElementById('btn-template-manager-add');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            alert('独自テンプレートの作成画面は準備中です。（現在は履歴からのみ自動生成されます）');
            // 将来的にカスタムテンプレート作成モーダルを開く
        });
    }
    
    function renderTemplateList() {
        const listDiv = document.getElementById('template-manager-list');
        if (!listDiv) return;
        
        listDiv.innerHTML = ''; // clear
        
        let displayItems = [];
        
        if (currentTab === 'history' || currentTab === 'templates') { // For now, both show history since custom templates aren't fully CRUDed yet
            const allItems = Storage.getAll();
            const seen = new Set();
            for (let i = allItems.length - 1; i >= 0; i--) {
                const item = allItems[i];
                if (!item.title || !item.startTime || item.title === 'その他') continue;
                const sig = `${item.title}|${item.startTime}|${item.endTime || ''}`;
                if (!seen.has(sig)) {
                    seen.add(sig);
                    displayItems.push(item);
                    if (displayItems.length >= 15) break; 
                }
            }
        }
        
        if (displayItems.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center; color: var(--text-tertiary); padding: 2rem;">データがありません</div>`;
            return;
        }
        
        const CATEGORY_COLORS = {
            '勉強': '#3b82f6',
            'バイト': '#8b5cf6',
            '学校': '#10b981',
            '予定': '#10b981',
            '遊び': '#f59e0b',
            'その他': '#64748b'
        };
        
        displayItems.forEach(u => {
            const timeRange = u.startTime + (u.endTime ? ' - ' + u.endTime : '');
            const bgColor = u.customColor || CATEGORY_COLORS[u.category] || CATEGORY_COLORS['その他'];
            
            const itemHtml = `
                <div class="template-card" style="display: flex; align-items: center; background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; border: 1px solid #f1f5f9; position: relative; overflow: hidden; transition: transform 0.1s;">
                    <div style="position: absolute; left: 0; top: 12px; bottom: 12px; width: 5px; background: ${bgColor}; border-radius: 0 4px 4px 0;"></div>
                    <div style="width: 80px; font-weight: bold; color: #64748b; font-size: 0.85rem; text-align: center; margin-left: 10px;">
                        ${timeRange === '終日' ? '<span style="color:#94a3b8">終日</span>' : timeRange.replace(' - ', '<br>')}
                    </div>
                    <div style="flex: 1; padding-left: 15px; border-left: 1px solid #f1f5f9; font-weight: bold; font-size: 1.05rem; color: #1e293b; line-height: 1.3;">
                        ${u.title}
                    </div>
                </div>
            `;
            
            const div = document.createElement('div');
            div.innerHTML = itemHtml;
            const el = div.firstElementChild;
            
            el.addEventListener('click', () => {
                document.getElementById('title').value = u.title;
                document.getElementById('start-time').value = u.startTime;
                document.getElementById('end-time').value = u.endTime || '';
                // Trigger input event for auto-category selection
                document.getElementById('title').dispatchEvent(new Event('input'));
                
                // Close template manager modal
                const modal = document.getElementById('template-manager-modal');
                if (modal) modal.close();
            });
            
            el.addEventListener('mousedown', () => el.style.background = '#f8fafc');
            el.addEventListener('mouseup', () => el.style.background = 'white');
            el.addEventListener('touchstart', () => el.style.background = '#f8fafc', {passive: true});
            el.addEventListener('touchend', () => el.style.background = 'white');
            
            listDiv.appendChild(el);
        });
    }
}


    // Removed kakeibo and notes


