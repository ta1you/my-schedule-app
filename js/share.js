import { Storage } from './storage.js';
import { CustomTabs } from './customTabs.js';
import { getTodayString } from './utils.js';

export const ShareFeature = {
    init() {
        // Expose method to re-render settings when opening the tab
        window.loadShareSettings = () => this.renderSettings();
        
        this.addEventListeners();
    },

    renderSettings() {
        const customTabsList = document.getElementById('share-custom-tabs');
        if (!customTabsList) return;
        
        if (CustomTabs.tabs.length === 0) {
            customTabsList.innerHTML = '<span style="color:var(--text-tertiary); font-size:0.8rem;">カスタムタブはありません</span>';
        } else {
            const html = CustomTabs.tabs.map(tab => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 8px; cursor: pointer; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
                    <input type="checkbox" class="share-tab-cb" value="${tab.id}" style="width: 20px !important; height: 20px !important; margin: 0 !important; padding: 0 !important; appearance: auto !important; -webkit-appearance: auto !important; flex-shrink: 0;">
                    <span style="font-weight: bold; color: var(--text-primary);">${tab.icon} ${tab.title}</span>
                </label>
            `).join('');
            customTabsList.innerHTML = html;
        }

        // Re-attach listeners to new checkboxes
        document.querySelectorAll('.share-tab-cb').forEach(cb => {
            cb.addEventListener('change', () => this.generatePreview());
        });
        
        this.generatePreview(); // Initial preview
    },

    addEventListeners() {
        const rangeSelect = document.getElementById('share-range');
        if (rangeSelect) rangeSelect.addEventListener('change', () => this.generatePreview());

        const copyBtn = document.getElementById('btn-share-copy');
        const shareBtn = document.getElementById('btn-share-api');

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const text = document.getElementById('share-preview').value;
                try {
                    await navigator.clipboard.writeText(text);
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = 'コピーしました！';
                    setTimeout(() => copyBtn.innerText = originalText, 2000);
                } catch (e) {
                    alert('コピーに失敗しました。テキストを選択して手動でコピーしてください。');
                }
            });
        }

        if (shareBtn) {
            if (navigator.share) {
                shareBtn.addEventListener('click', async () => {
                    const text = document.getElementById('share-preview').value;
                    try {
                        await navigator.share({ title: 'スケジュール共有', text: text });
                    } catch (e) {
                        console.log('Share failed', e);
                    }
                });
            } else {
                shareBtn.style.display = 'none'; // Not supported
            }
        }
    },

    generatePreview() {
        const range = document.getElementById('share-range') ? document.getElementById('share-range').value : 'this_week';
        let output = '';

        // 1. Schedule
        output += this.getScheduleText(range) + '\n';

        // 2. Custom Tabs
        document.querySelectorAll('.share-tab-cb:checked').forEach(cb => {
            const tabId = cb.value;
            const tab = CustomTabs.getTab(tabId);
            if (tab) {
                output += '\n' + this.getCustomTabText(tab) + '\n';
            }
        });

        const previewEl = document.getElementById('share-preview');
        if (previewEl) {
            previewEl.value = output.trim();
        }
    },

    getScheduleText(range) {
        // Range: today, tomorrow, this_week, next_week
        const todayStr = getTodayString();
        const todayDate = new Date(todayStr);
        let startDate, endDate;
        let title = '';

        if (range === 'today') {
            startDate = new Date(todayStr);
            endDate = new Date(todayStr);
            title = '【今日の予定】';
        } else if (range === 'tomorrow') {
            startDate = new Date(todayDate);
            startDate.setDate(startDate.getDate() + 1);
            endDate = new Date(startDate);
            title = '【明日の予定】';
        } else if (range === 'this_week') {
            const day = todayDate.getDay(); // 0(Sun) to 6(Sat)
            const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
            startDate = new Date(todayDate.setDate(diff));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            title = '【今週の予定】';
        } else if (range === 'next_week') {
            const day = todayDate.getDay();
            const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1) + 7;
            startDate = new Date(todayDate.setDate(diff));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            title = '【来週の予定】';
        }

        // Format dates as YYYY-MM-DD for comparison
        const getFormat = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const startStr = getFormat(startDate);
        const endStr = getFormat(endDate);

        const schedules = Storage.getAll();
        const filtered = schedules.filter(s => s.date >= startStr && s.date <= endStr);
        filtered.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
        });

        if (filtered.length === 0) {
            return `${title}\n予定はありません\n`;
        }

        let txt = `${title}\n`;
        let lastDate = '';
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        filtered.forEach(s => {
            if (s.date !== lastDate) {
                const d = new Date(s.date);
                txt += `\n■ ${d.getMonth()+1}/${d.getDate()} (${dayNames[d.getDay()]})\n`;
                lastDate = s.date;
            }
            const timeSpan = s.startTime ? `${s.startTime}〜${s.endTime || ''}` : '終日';
            let memoStr = s.description ? ` (${s.description.replace(/\n/g, ' ')})` : '';
            if (memoStr.length > 30) memoStr = memoStr.substring(0, 30) + '...';
            txt += `・${timeSpan} ${s.title}${memoStr}\n`;
        });

        return txt;
    },

    getCustomTabText(tab) {
        let txt = `【${tab.icon} ${tab.title}】\n`;
        const d = tab.data;
        if (tab.template === 'memo') {
            txt += d.text ? d.text : 'メモなし';
        } else if (tab.template === 'checklist') {
            if (!d.items || d.items.length === 0) txt += 'アイテムなし';
            else d.items.forEach(i => txt += (i.checked ? '☑ ' : '☐ ') + i.text + '\n');
        } else if (tab.template === 'datelog') {
            if (!d.logs || d.logs.length === 0) txt += 'ログなし';
            else d.logs.forEach(l => txt += `[${l.date}] ${l.text}\n`);
        } else if (tab.template === 'table') {
            if (!d.rows || d.rows.length === 0) txt += 'データなし';
            else {
                txt += (d.columns || []).join(' | ') + '\n';
                d.rows.forEach(r => txt += r.join(' | ') + '\n');
            }
        } else if (tab.template === 'chart') {
            if (!d.logs || d.logs.length === 0) txt += 'データなし';
            else d.logs.forEach(l => txt += `${l.date}: ${l.value}${d.unit||''}\n`);
        } else if (tab.template === 'link') {
            if (!d.links || d.links.length === 0) txt += 'リンクなし';
            else d.links.forEach(l => txt += `・${l.title}\n  ${l.url}\n`);
        } else if (tab.template === 'counter') {
            if (!d.counters || d.counters.length === 0) txt += 'カウンターなし';
            else d.counters.forEach(c => txt += `・${c.title}: ${c.count}\n`);
        } else if (tab.template === 'gallery') {
            if (!d.images || d.images.length === 0) txt += '画像なし';
            else d.images.forEach(img => txt += `[画像] ${img.caption || '無題'}\n`);
        } else if (tab.template === 'review') {
            if (!d.reviews || d.reviews.length === 0) txt += 'レビューなし';
            else d.reviews.forEach(r => {
                const starsFill = '★'.repeat(r.rating);
                txt += `[${starsFill}] ${r.title}\n${r.text}\n`;
            });
        }
        return txt.trim() + '\n';
    }
};
