import { SafeStorage } from './utils.js';
import { generateId, getTodayString } from './utils.js';

const CUSTOM_TABS_KEY = 'my_schedule_custom_tabs';

export const CustomTabs = {
    tabs: [],
    
    // Templates
    // { id, title, template, icon, color, data }
    // template: 'memo', 'checklist', 'datelog', 'table', 'chart'
    
    init(onRenderTabButton) {
        this.load();
        this.onRenderTabButton = onRenderTabButton; // Callback to add nav buttons
        this.refreshNavButtons();
        
        // Expose to window for app.js to call easily
        window.renderCustomTabView = (tabId) => this.renderView(tabId);
        window.deleteCustomTab = (id) => this.deleteTab(id);
    },
    
    load() {
        try {
            const saved = SafeStorage.getItem(CUSTOM_TABS_KEY);
            this.tabs = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to load custom tabs', e);
            this.tabs = [];
        }
    },
    
    save() {
        SafeStorage.setItem(CUSTOM_TABS_KEY, JSON.stringify(this.tabs));
    },
    
    addTab(title, template, icon, color) {
        const newTab = {
            id: 'custom-' + generateId(),
            title,
            template,
            icon,
            color,
            data: this.getDefaultData(template)
        };
        this.tabs.push(newTab);
        this.save();
        this.refreshNavButtons();
        return newTab.id;
    },
    
    deleteTab(id) {
        if (!confirm('このタブを完全に削除しますか？')) return;
        this.tabs = this.tabs.filter(t => t.id !== id);
        this.save();
        this.refreshNavButtons();
        // Go back to list view
        document.getElementById('btn-view-list').click();
    },
    
    getTab(id) {
        return this.tabs.find(t => t.id === id);
    },
    
    getDefaultData(template) {
        if (template === 'memo') return { text: '' };
        if (template === 'checklist') return { items: [] }; // {id, text, checked}
        if (template === 'datelog') return { logs: [] }; // {date, text}
        if (template === 'table') return { columns: ['項目', '値'], rows: [] };
        if (template === 'chart') return { unit: '回', logs: [] }; // {date, value}
        if (template === 'link') return { links: [] };
        if (template === 'counter') return { counters: [] };
        if (template === 'gallery') return { images: [] };
        if (template === 'review') return { reviews: [] };
        return {};
    },
    
    refreshNavButtons() {
        if (this.onRenderTabButton) {
            this.onRenderTabButton(this.tabs);
        }
        this.renderSettingsList();
    },
    
    // Renders the settings UI for managing custom tabs
    renderSettingsList() {
        const container = document.getElementById('custom-tabs-settings-list');
        if (!container) return;
        
        if (this.tabs.length === 0) {
            container.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.85rem; padding: 0.5rem 0;">カスタムタブはありません</div>';
            return;
        }
        
        container.innerHTML = this.tabs.map(tab => `
            <div class="settings-list-item" style="justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="settings-icon-box" style="background: ${tab.color}20; color: ${tab.color};">${tab.icon}</div>
                    <div class="settings-item-content">
                        <span class="settings-item-title">${tab.title}</span>
                        <span class="settings-item-subtitle">${this.getTemplateName(tab.template)}</span>
                    </div>
                </div>
                <button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.deleteCustomTab('${tab.id}')">削除</button>
            </div>
        `).join('');
    },
    
    getTemplateName(template) {
        const map = {
            'memo': 'メモ',
            'checklist': 'チェックリスト',
            'datelog': '日付ログ',
            'table': 'カスタム表',
            'chart': '数値グラフ',
            'link': 'リンク集',
            'counter': 'カウンター・習慣',
            'gallery': '画像ギャラリー',
            'review': '星評価記録'
        };
        return map[template] || 'カスタム';
    },
    
    // --- Render View --- //
    renderView(tabId) {
        const container = document.getElementById('custom-tab-view');
        if (!container) return;
        
        const tab = this.getTab(tabId);
        if (!tab) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center;">タブが見つかりません</div>';
            return;
        }
        
        // Header
        let html = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem;">
                <div style="width: 40px; height: 40px; border-radius: 12px; background: ${tab.color}20; color: ${tab.color}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">${tab.icon}</div>
                <h2 style="margin: 0; font-size: 1.5rem;">${tab.title}</h2>
            </div>
        `;
        
        // Body based on template
        html += `<div id="custom-tab-content-${tab.id}">`;
        html += this[`renderTemplate_${tab.template}`](tab);
        html += `</div>`;
        
        container.innerHTML = html;
        this[`attachEvents_${tab.template}`](tab);
    },
    
    // --- Memo Template --- //
    renderTemplate_memo(tab) {
        return `
            <textarea id="ct-memo-${tab.id}" style="width: 100%; height: 60vh; padding: 1rem; border-radius: 12px; border: 1px solid var(--border-light); resize: none; font-size: 1rem;" placeholder="自由にメモを入力...">${tab.data.text || ''}</textarea>
        `;
    },
    attachEvents_memo(tab) {
        const ta = document.getElementById(`ct-memo-${tab.id}`);
        if (!ta) return;
        ta.addEventListener('input', (e) => {
            tab.data.text = e.target.value;
            this.save();
        });
    },
    
    // --- Checklist Template --- //
    renderTemplate_checklist(tab) {
        const items = tab.data.items || [];
        
        let html = `
            <form id="ct-checklist-form-${tab.id}" style="display: flex; gap: 8px; margin-bottom: 1rem;">
                <input type="text" id="ct-checklist-input-${tab.id}" placeholder="新しいアイテム..." required style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light);">
                <button type="submit" class="btn btn-primary" style="border-radius: 8px;">追加</button>
            </form>
            <div id="ct-checklist-list-${tab.id}" style="display: flex; flex-direction: column; gap: 8px;">
        `;
        
        if (items.length === 0) {
            html += `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem;">アイテムはありません</div>`;
        } else {
            items.forEach((item, index) => {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1;">
                            <input type="checkbox" data-index="${index}" class="ct-checklist-cb" style="width: 20px; height: 20px;" ${item.checked ? 'checked' : ''}>
                            <span style="font-size: 1rem; ${item.checked ? 'text-decoration: line-through; color: var(--text-tertiary);' : ''}">${item.text}</span>
                        </label>
                        <button type="button" class="btn-danger ct-checklist-del" data-index="${index}" style="background: none; border: none; font-size: 1.2rem; padding: 0 8px;">×</button>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        return html;
    },
    attachEvents_checklist(tab) {
        const form = document.getElementById(`ct-checklist-form-${tab.id}`);
        const input = document.getElementById(`ct-checklist-input-${tab.id}`);
        const list = document.getElementById(`ct-checklist-list-${tab.id}`);
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.items = tab.data.items || [];
                tab.data.items.push({ id: generateId(), text: input.value, checked: false });
                this.save();
                this.renderView(tab.id); // Re-render
            });
        }
        
        if (list) {
            list.addEventListener('change', (e) => {
                if (e.target.classList.contains('ct-checklist-cb')) {
                    const idx = parseInt(e.target.dataset.index);
                    tab.data.items[idx].checked = e.target.checked;
                    this.save();
                    this.renderView(tab.id); // Re-render to strike-through
                }
            });
            list.addEventListener('click', (e) => {
                if (e.target.classList.contains('ct-checklist-del')) {
                    const idx = parseInt(e.target.dataset.index);
                    tab.data.items.splice(idx, 1);
                    this.save();
                    this.renderView(tab.id);
                }
            });
        }
    },
    
    // --- Date Log Template --- //
    renderTemplate_datelog(tab) {
        const logs = tab.data.logs || [];
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let html = `
            <form id="ct-datelog-form-${tab.id}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px;">
                <input type="date" id="ct-datelog-date-${tab.id}" value="${getTodayString()}" required style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light);">
                <textarea id="ct-datelog-text-${tab.id}" placeholder="記録内容..." required rows="2" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); resize: none;"></textarea>
                <button type="submit" class="btn btn-primary" style="padding: 10px; border-radius: 8px;">記録する</button>
            </form>
            <div id="ct-datelog-list-${tab.id}" style="display: flex; flex-direction: column; gap: 12px;">
        `;
        
        if (logs.length === 0) {
            html += `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem;">記録はありません</div>`;
        } else {
            logs.forEach((log, index) => {
                html += `
                    <div style="background: white; padding: 12px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative;">
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 6px; font-weight: bold;">${log.date}</div>
                        <div style="font-size: 1rem; white-space: pre-wrap;">${log.text}</div>
                        <button type="button" class="ct-datelog-del" data-index="${index}" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--text-tertiary); font-size: 1.2rem; cursor: pointer;">×</button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        return html;
    },
    attachEvents_datelog(tab) {
        const form = document.getElementById(`ct-datelog-form-${tab.id}`);
        const dateInput = document.getElementById(`ct-datelog-date-${tab.id}`);
        const textInput = document.getElementById(`ct-datelog-text-${tab.id}`);
        const list = document.getElementById(`ct-datelog-list-${tab.id}`);
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.logs = tab.data.logs || [];
                tab.data.logs.push({ id: generateId(), date: dateInput.value, text: textInput.value });
                this.save();
                this.renderView(tab.id);
            });
        }
        
        if (list) {
            list.addEventListener('click', (e) => {
                if (e.target.classList.contains('ct-datelog-del')) {
                    if (confirm('この記録を削除しますか？')) {
                        const idx = parseInt(e.target.dataset.index);
                        tab.data.logs.splice(idx, 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
        }
    },
    
    // --- Table Template --- //
    renderTemplate_table(tab) {
        const columns = tab.data.columns || ['A', 'B'];
        const rows = tab.data.rows || [];
        
        let html = `
            <div style="margin-bottom: 1rem; display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary" id="ct-table-addrow-${tab.id}" style="font-size: 0.8rem; padding: 6px 12px;">+ 行追加</button>
            </div>
            <div style="overflow-x: auto; padding-bottom: 1rem;">
                <table style="width: 100%; min-width: 400px; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <thead style="background: #f1f5f9; text-align: left;">
                        <tr>
                            ${columns.map((col, idx) => `<th style="padding: 10px; border-bottom: 1px solid var(--border-light); font-weight: 600;"><input type="text" class="ct-table-col" data-col="${idx}" value="${col}" style="background: transparent; border: none; font-weight: 600; width: 100%; padding: 4px; border-radius: 4px;"></th>`).join('')}
                            <th style="padding: 10px; border-bottom: 1px solid var(--border-light); width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((row, rIdx) => `
                            <tr>
                                ${columns.map((_, cIdx) => `
                                    <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-light);"><input type="text" class="ct-table-cell" data-row="${rIdx}" data-col="${cIdx}" value="${row[cIdx] || ''}" style="width: 100%; border: 1px solid transparent; padding: 6px; border-radius: 4px; background: transparent;"></td>
                                `).join('')}
                                <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-light); text-align: center;"><button type="button" class="ct-table-delrow" data-row="${rIdx}" style="background: none; border: none; color: var(--text-tertiary); cursor: pointer;">×</button></td>
                            </tr>
                        `).join('')}
                        ${rows.length === 0 ? `<tr><td colspan="${columns.length + 1}" style="text-align: center; padding: 1rem; color: var(--text-tertiary);">データなし</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
        return html;
    },
    attachEvents_table(tab) {
        const btnAddRow = document.getElementById(`ct-table-addrow-${tab.id}`);
        // delegate event to container
        const container = document.getElementById(`custom-tab-content-${tab.id}`);
        
        if (btnAddRow) {
            btnAddRow.addEventListener('click', () => {
                tab.data.rows = tab.data.rows || [];
                // Create empty row based on cols
                const newRow = new Array(tab.data.columns.length).fill('');
                tab.data.rows.push(newRow);
                this.save();
                this.renderView(tab.id);
            });
        }
        
        if (container) {
            container.addEventListener('input', (e) => {
                if (e.target.classList.contains('ct-table-cell')) {
                    const rList = parseInt(e.target.dataset.row);
                    const cList = parseInt(e.target.dataset.col);
                    tab.data.rows[rList][cList] = e.target.value;
                    this.save();
                } else if (e.target.classList.contains('ct-table-col')) {
                    const cList = parseInt(e.target.dataset.col);
                    tab.data.columns[cList] = e.target.value;
                    this.save();
                }
            });
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('ct-table-delrow')) {
                    if(confirm('行を削除しますか？')){
                        const rList = parseInt(e.target.dataset.row);
                        tab.data.rows.splice(rList, 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
            // highlight input on focus
            container.addEventListener('focusin', (e) => {
                if (e.target.tagName === 'INPUT') {
                    e.target.style.background = '#f8fafc';
                    e.target.style.borderColor = 'var(--border-light)';
                }
            });
            container.addEventListener('focusout', (e) => {
                if (e.target.tagName === 'INPUT') {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'transparent';
                }
            });
        }
    },
    
    // --- Chart Template --- //
    renderTemplate_chart(tab) {
        const logs = tab.data.logs || [];
        // sort asc for chart
        const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let html = `
            <form id="ct-chart-form-${tab.id}" style="display: flex; gap: 8px; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; flex-wrap: wrap;">
                <input type="date" id="ct-chart-date-${tab.id}" value="${getTodayString()}" required style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); flex: 1; min-width: 120px;">
                <input type="number" id="ct-chart-val-${tab.id}" placeholder="数値" step="any" required style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); flex: 1; min-width: 100px;">
                <button type="submit" class="btn btn-primary" style="padding: 10px; border-radius: 8px;">記録</button>
            </form>
            <div style="position: relative; height: 300px; margin-bottom: 1.5rem; background: white; padding: 10px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <canvas id="ct-chart-canvas-${tab.id}"></canvas>
            </div>
            
            <h4 style="margin: 0 0 10px 0; font-size: 0.9rem;">履歴</h4>
            <div id="ct-chart-list-${tab.id}" style="display: flex; flex-direction: column; gap: 8px;">
        `;
        
        let reversedLogs = [...sortedLogs].reverse();
        if (reversedLogs.length === 0) {
            html += `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem;">データはありません</div>`;
        } else {
            reversedLogs.forEach((log) => {
                // Find original index to delete
                const origIndex = logs.findIndex(l => l.id === log.id);
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <div><span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 12px;">${log.date}</span><span style="font-weight: bold;">${log.value} ${tab.data.unit || ''}</span></div>
                        <button type="button" class="ct-chart-del" data-index="${origIndex}" style="background: none; border: none; color: var(--text-tertiary); font-size: 1.2rem; cursor: pointer;">×</button>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        return html;
    },
    attachEvents_chart(tab) {
        const form = document.getElementById(`ct-chart-form-${tab.id}`);
        const dateInput = document.getElementById(`ct-chart-date-${tab.id}`);
        const valInput = document.getElementById(`ct-chart-val-${tab.id}`);
        const list = document.getElementById(`ct-chart-list-${tab.id}`);
        const canvas = document.getElementById(`ct-chart-canvas-${tab.id}`);
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.logs = tab.data.logs || [];
                // if same date exists, ask to overwrite or add? let's just overwrite for chart simplicity
                const existingIdx = tab.data.logs.findIndex(l => l.date === dateInput.value);
                if (existingIdx >= 0) {
                    tab.data.logs[existingIdx].value = Number(valInput.value);
                } else {
                    tab.data.logs.push({ id: generateId(), date: dateInput.value, value: Number(valInput.value) });
                }
                this.save();
                this.renderView(tab.id);
            });
        }
        
        if (list) {
            list.addEventListener('click', (e) => {
                if (e.target.classList.contains('ct-chart-del')) {
                    if (confirm('削除しますか？')) {
                        const idx = parseInt(e.target.dataset.index);
                        tab.data.logs.splice(idx, 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
        }
        
        // Draw Chart
        if (canvas && window.Chart) {
            const logs = tab.data.logs || [];
            if (logs.length > 0) {
                const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
                const labels = sortedLogs.map(l => {
                    const [, m, d] = l.date.split('-');
                    return `${parseInt(m)}/${parseInt(d)}`;
                });
                const data = sortedLogs.map(l => l.value);
                
                new window.Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: tab.title,
                            data: data,
                            borderColor: tab.color,
                            backgroundColor: tab.color + '20',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.2,
                            pointRadius: 4,
                            pointBackgroundColor: tab.color
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: false, ticks: { maxTicksLimit: 6 } }
                        }
                    }
                });
            }
        }
    },
    
    // --- Link Template --- //
    renderTemplate_link(tab) {
        const links = tab.data.links || [];
        let html = `
            <form id="ct-link-form-${tab.id}" style="display: flex; gap: 8px; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; flex-wrap: wrap;">
                <input type="text" id="ct-link-title-${tab.id}" placeholder="タイトル (例: ポータルサイト)" required style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); flex: 1; min-width: 150px;">
                <input type="url" id="ct-link-url-${tab.id}" placeholder="https://..." required style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); flex: 2; min-width: 200px;">
                <button type="submit" class="btn btn-primary" style="padding: 10px 16px; border-radius: 8px;">追加</button>
            </form>
            <div id="ct-link-list-${tab.id}" style="display: flex; flex-direction: column; gap: 10px;">
        `;
        
        if (links.length === 0) {
            html += `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem;">リンクはありません</div>`;
        } else {
            links.forEach((link, index) => {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); gap: 10px;">
                        <a href="${link.url}" target="_blank" style="display: flex; flex-direction: column; flex: 1; text-decoration: none; overflow: hidden;">
                            <span style="font-weight: bold; color: var(--text-primary); font-size: 1.05rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${link.title}</span>
                            <span style="font-size: 0.8rem; color: #2563eb; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${link.url}</span>
                        </a>
                        <button type="button" class="ct-link-del" data-index="${index}" style="background: #fee2e2; color: #ef4444; border: none; border-radius: 8px; padding: 8px 12px; font-weight: bold; cursor: pointer; flex-shrink: 0;">削除</button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        return html;
    },
    attachEvents_link(tab) {
        const form = document.getElementById(`ct-link-form-${tab.id}`);
        const list = document.getElementById(`ct-link-list-${tab.id}`);
        if(form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.links = tab.data.links || [];
                const title = document.getElementById(`ct-link-title-${tab.id}`).value;
                const url = document.getElementById(`ct-link-url-${tab.id}`).value;
                tab.data.links.push({ id: generateId(), title, url });
                this.save();
                this.renderView(tab.id);
            });
        }
        if(list) {
            list.addEventListener('click', (e) => {
                if (e.target.classList.contains('ct-link-del')) {
                    if(confirm('削除しますか？')){
                        tab.data.links.splice(parseInt(e.target.dataset.index), 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
        }
    },
    
    // --- Counter Template --- //
    renderTemplate_counter(tab) {
        const counters = tab.data.counters || [];
        let html = `
            <form id="ct-counter-form-${tab.id}" style="display: flex; gap: 8px; margin-bottom: 1.5rem;">
                <input type="text" id="ct-counter-title-${tab.id}" placeholder="新しいカウンター (例: 水を飲んだ杯数)" required style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light);">
                <button type="submit" class="btn btn-primary" style="padding: 10px 16px; border-radius: 8px;">追加</button>
            </form>
            <div id="ct-counter-list-${tab.id}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
        `;
        if (counters.length === 0) {
            html += `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 1rem;">カウンターはありません</div>`;
        } else {
            counters.forEach((cnt, index) => {
                html += `
                    <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center; position: relative;">
                        <button type="button" class="ct-counter-del" data-index="${index}" style="position: absolute; top: 8px; left: 8px; background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer;">×</button>
                        <div style="font-weight: bold; color: var(--text-secondary); margin-bottom: 12px; font-size: 1rem; width: 100%; text-align: center; padding: 0 20px;">${cnt.title}</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; width: 100%;">
                            <button type="button" class="ct-counter-minus" data-index="${index}" style="width: 44px; height: 44px; border-radius: 22px; border: none; background: #f1f5f9; font-size: 1.5rem; font-weight: bold; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                            <div style="font-size: 2.5rem; font-weight: 800; color: ${tab.color}; min-width: 60px; text-align: center;">${cnt.count}</div>
                            <button type="button" class="ct-counter-plus" data-index="${index}" style="width: 44px; height: 44px; border-radius: 22px; border: none; background: ${tab.color}20; color: ${tab.color}; font-size: 1.5rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                        </div>
                        <button type="button" class="ct-counter-reset" data-index="${index}" style="margin-top: 12px; background: none; border: none; color: #94a3b8; font-size: 0.8rem; text-decoration: underline; cursor: pointer;">0にリセット</button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        return html;
    },
    attachEvents_counter(tab) {
        const form = document.getElementById(`ct-counter-form-${tab.id}`);
        const list = document.getElementById(`ct-counter-list-${tab.id}`);
        if(form){
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.counters = tab.data.counters || [];
                const title = document.getElementById(`ct-counter-title-${tab.id}`).value;
                tab.data.counters.push({ id: generateId(), title, count: 0 });
                this.save();
                this.renderView(tab.id);
            });
        }
        if(list){
            list.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (isNaN(idx)) return;
                let reRender = false;
                if(e.target.classList.contains('ct-counter-plus')){
                    tab.data.counters[idx].count++;
                    reRender = true;
                } else if(e.target.classList.contains('ct-counter-minus')){
                    if(tab.data.counters[idx].count > 0) tab.data.counters[idx].count--;
                    reRender = true;
                } else if(e.target.classList.contains('ct-counter-reset')){
                    tab.data.counters[idx].count = 0;
                    reRender = true;
                } else if(e.target.classList.contains('ct-counter-del')){
                    if(confirm('このカウンターを削除しますか？')){
                        tab.data.counters.splice(idx, 1);
                        reRender = true;
                    }
                }
                if(reRender){
                    this.save();
                    this.renderView(tab.id);
                }
            });
        }
    },
    
    // --- Gallery Template --- //
    renderTemplate_gallery(tab) {
        const images = tab.data.images || [];
        let html = `
            <div style="display: flex; gap: 8px; margin-bottom: 1.5rem; align-items: center; background: #f8fafc; padding: 1rem; border-radius: 12px;">
                <label class="btn btn-primary" style="padding: 10px 16px; border-radius: 8px; cursor: pointer; margin:0; display: inline-block; flex-shrink: 0;">
                    + 画像を追加
                    <input type="file" id="ct-gallery-file-${tab.id}" accept="image/*" style="display: none;">
                </label>
                <div style="flex:1;"><input type="text" id="ct-gallery-caption-${tab.id}" placeholder="簡単なメモ (任意)" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light);"></div>
            </div>
            <div id="ct-gallery-list-${tab.id}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;">
        `;
        if (images.length === 0) {
            html += `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 1rem;">画像はありません</div>`;
        } else {
            images.forEach((img, index) => {
                html += `
                    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; display: flex; flex-direction: column; position: relative;">
                        <button type="button" class="ct-gallery-del" data-index="${index}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.5); border: none; color: white; border-radius: 50%; width: 24px; height: 24px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">✕</button>
                        <div style="aspect-ratio: 1; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            <img src="${img.dataUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${img.dataUrl}', '_blank')">
                        </div>
                        <div style="padding: 8px; font-size: 0.8rem; color: var(--text-secondary); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${img.caption || '無題'}
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        return html;
    },
    attachEvents_gallery(tab) {
        const fileInput = document.getElementById(`ct-gallery-file-${tab.id}`);
        const list = document.getElementById(`ct-gallery-list-${tab.id}`);
        
        if(fileInput) {
            fileInput.addEventListener('change', (e) => {
                if(e.target.files && e.target.files[0]){
                    const file = e.target.files[0];
                    const caption = document.getElementById(`ct-gallery-caption-${tab.id}`).value;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > height) {
                              if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              }
                            } else {
                              if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            
                            tab.data.images = tab.data.images || [];
                            tab.data.images.push({ id: generateId(), dataUrl, caption, date: getTodayString() });
                            try {
                                this.save();
                                this.renderView(tab.id);
                            } catch (err) {
                                alert('保存容量が上限に達しました。不要な画像を削除してください。');
                                tab.data.images.pop();
                            }
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        if(list) {
            list.addEventListener('click', (e) => {
                if(e.target.classList.contains('ct-gallery-del')){
                    if(confirm('画像を削除しますか？')){
                        tab.data.images.splice(parseInt(e.target.dataset.index), 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
        }
    },
    
    // --- Review Template --- //
    renderTemplate_review(tab) {
        const reviews = tab.data.reviews || [];
        // clone and sort by newest
        const sortedReviews = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let html = `
            <form id="ct-review-form-${tab.id}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <input type="text" id="ct-review-title-${tab.id}" placeholder="作品名・店名など" required style="flex: 2; min-width: 150px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light);">
                    <select id="ct-review-rating-${tab.id}" style="flex: 1; min-width: 140px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); font-size: 1rem; color: #fbbf24; font-weight: bold;">
                        <option value="5">★★★★★ 5</option>
                        <option value="4">★★★★☆ 4</option>
                        <option value="3" selected>★★★☆☆ 3</option>
                        <option value="2">★★☆☆☆ 2</option>
                        <option value="1">★☆☆☆☆ 1</option>
                    </select>
                </div>
                <textarea id="ct-review-text-${tab.id}" placeholder="感想やレビュー..." rows="3" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); resize: vertical; margin-top: 4px;"></textarea>
                <button type="submit" class="btn btn-primary" style="padding: 10px; border-radius: 8px; margin-top: 4px;">記録する</button>
            </form>
            <div id="ct-review-list-${tab.id}" style="display: flex; flex-direction: column; gap: 12px;">
        `;
        if (sortedReviews.length === 0) {
            html += `<div style="text-align: center; color: var(--text-tertiary); padding: 1rem;">レビューはありません</div>`;
        } else {
            sortedReviews.forEach(rev => {
                const origIndex = reviews.findIndex(r => r.id === rev.id);
                const starsFill = '★'.repeat(rev.rating);
                const starsEmpty = '☆'.repeat(5 - rev.rating);
                html += `
                    <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;">
                        <button type="button" class="ct-review-del" data-index="${origIndex}" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--text-tertiary); font-size: 1.2rem; cursor: pointer;">×</button>
                        <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-primary); margin-bottom: 4px; padding-right: 24px;">${rev.title}</div>
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <span style="color: #fbbf24; font-size: 1.1rem; letter-spacing: 2px;">${starsFill}<span style="color: #e2e8f0;">${starsEmpty}</span></span>
                            <span style="font-size: 0.8rem; color: var(--text-tertiary);">${rev.date}</span>
                        </div>
                        <div style="font-size: 0.95rem; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.5;">${rev.text}</div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        return html;
    },
    attachEvents_review(tab) {
        const form = document.getElementById(`ct-review-form-${tab.id}`);
        const list = document.getElementById(`ct-review-list-${tab.id}`);
        if(form){
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                tab.data.reviews = tab.data.reviews || [];
                const title = document.getElementById(`ct-review-title-${tab.id}`).value;
                const rating = parseInt(document.getElementById(`ct-review-rating-${tab.id}`).value);
                const text = document.getElementById(`ct-review-text-${tab.id}`).value;
                tab.data.reviews.push({ id: generateId(), title, rating, text, date: getTodayString() });
                this.save();
                this.renderView(tab.id);
            });
        }
        if(list){
            list.addEventListener('click', (e) => {
                if(e.target.classList.contains('ct-review-del')){
                    if(confirm('削除しますか？')){
                        tab.data.reviews.splice(parseInt(e.target.dataset.index), 1);
                        this.save();
                        this.renderView(tab.id);
                    }
                }
            });
        }
    }
};
