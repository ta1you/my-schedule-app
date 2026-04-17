import { Storage } from './storage.js';
import { generateId, getTodayString } from './utils.js';

export const ScheduleImportManager = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        const btnShowImport = document.getElementById('btn-show-import');
        const methodModal = document.getElementById('import-method-modal');
        const textModal = document.getElementById('import-text-modal');
        
        const btnImportText = document.getElementById('btn-import-text');
        const btnExecute = document.getElementById('btn-import-execute');
        const btnClear = document.getElementById('btn-import-clear-list');
        
        const form = document.getElementById('import-builder-form');
        const previewList = document.getElementById('import-preview-list');
        const emptyMessage = document.getElementById('import-empty-message');

        let pendingItems = []; // buffer

        // Bulk Delete variables
        const btnShowBulkDelete = document.getElementById('btn-show-bulk-delete');
        const bulkDeleteModal = document.getElementById('bulk-delete-modal');
        const bulkDeleteForm = document.getElementById('bulk-delete-form');
        const bulkDeletePreviewList = document.getElementById('bulk-delete-preview-list');
        const bulkDeleteResultMsg = document.getElementById('bulk-delete-result-msg');
        const btnBulkDeleteExecute = document.getElementById('btn-bulk-delete-execute');
        
        let pendingDeleteItems = [];

        if (btnShowImport) {
            btnShowImport.addEventListener('click', () => {
                if (methodModal) methodModal.showModal();
            });
        }

        if (previewList) {
            previewList.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-delete-batch');
                if (btn) {
                    const batchId = btn.getAttribute('data-batch-id');
                    pendingItems = pendingItems.filter(item => item._batchId !== batchId);
                    this.renderPreview(previewList, emptyMessage, pendingItems, btnExecute);
                }
            });
        }

        if (btnImportText) {
            btnImportText.addEventListener('click', () => {
                if (methodModal) methodModal.close();
                // Reset form and buffer
                if (form) form.reset();
                pendingItems = [];
                this.renderPreview(previewList, emptyMessage, pendingItems, btnExecute, btnClear);
                if (textModal) textModal.showModal();
            });
        }
        
        // Import modal specific color presets
        document.querySelectorAll('.import-color-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                const colorInput = document.getElementById('import-custom-color');
                if (colorInput) {
                    colorInput.value = color;
                }
            });
        });
        
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const confirmClear = confirm('リストに追加されたすべての予定をクリアしますか？');
                if (confirmClear) {
                    pendingItems = [];
                    this.renderPreview(previewList, emptyMessage, pendingItems, btnExecute, btnClear);
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const repeatCount = parseInt(document.getElementById('import-repeat-count').value);
                const dayIndex = parseInt(document.getElementById('import-day-of-week').value);
                const rawTitle = document.getElementById('import-title').value.trim();
                const comment = document.getElementById('import-comment').value.trim();
                const startTimeStr = document.getElementById('import-start-time').value;
                let endTimeStr = document.getElementById('import-end-time').value;

                if (!endTimeStr) {
                    const [h, m] = startTimeStr.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m + 90, 0, 0); // Default to 90 mins for these classes
                    endTimeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }

                const category = '学校'; 
                const colorInput = document.getElementById('import-custom-color');
                const customColor = colorInput ? colorInput.value : '#3b82f6';
                const skipHolidays = document.getElementById('import-skip-holidays') ? document.getElementById('import-skip-holidays').checked : false;
                
                const today = new Date();
                const baseDate = new Date(today);
                let distance = dayIndex - baseDate.getDay();
                if (distance < 0) distance += 7; // Next occurrence of the day
                baseDate.setDate(baseDate.getDate() + distance);

                const groupItems = [];
                const batchId = generateId(); // Unique ID for this generation batch
                
                const titles = rawTitle.split(/[\s　]+/).filter(t => t.length > 0);
                if (titles.length === 0) titles.push('');
                
                let createdWeeks = 0;
                let weeksToOffset = 0;
                let maxTries = 100; // 安全のための無限ループ防止
                
                while (createdWeeks < repeatCount && maxTries > 0) {
                    maxTries--;
                    const d = new Date(baseDate);
                    d.setDate(d.getDate() + (weeksToOffset * 7));
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${day}`;

                    // 祝日スキップ判定
                    if (skipHolidays && window.Calendar && window.Calendar.holidays && window.Calendar.holidays[dateStr]) {
                        weeksToOffset++;
                        continue;
                    }

                    titles.forEach(t => {
                        groupItems.push({
                            id: generateId(),
                            title: t,
                            date: dateStr,
                            startTime: startTimeStr,
                            endTime: endTimeStr,
                            description: comment,
                            category: category,
                            customColor: customColor,
                            createdAt: new Date().toISOString(),
                            _isSeries: createdWeeks === 0, // only true for the first item to group in preview
                            _seriesCount: repeatCount,
                            _batchId: batchId
                        });
                    });
                    
                    createdWeeks++;
                    weeksToOffset++;
                }
                
                pendingItems.push(...groupItems);
                
                // Clear some fields for next entry, but keep common ones like repeat count
                document.getElementById('import-title').value = '';
                document.getElementById('import-comment').value = '';
                document.getElementById('import-day-of-week').value = '';
                
                this.renderPreview(previewList, emptyMessage, pendingItems, btnExecute, btnClear);
            });
        }

        if (btnExecute) {
            btnExecute.addEventListener('click', () => {
                if (pendingItems.length === 0) return;

                pendingItems.forEach(item => {
                    const dataToSave = { ...item };
                    delete dataToSave._isSeries;
                    delete dataToSave._seriesCount;
                    delete dataToSave._batchId;
                    Storage.save(dataToSave);
                });

                if (window.UI) window.UI.render();
                if (window.Calendar && window.Calendar.refresh) window.Calendar.refresh();

                alert(`${pendingItems.length}件の予定を登録しました。`);
                pendingItems = [];
                if (textModal) textModal.close();
            });
        }

        // --- Bulk Delete Logic ---
        if (btnShowBulkDelete) {
            btnShowBulkDelete.addEventListener('click', () => {
                if (bulkDeleteForm) bulkDeleteForm.reset();
                pendingDeleteItems = [];
                if (bulkDeletePreviewList) {
                    bulkDeletePreviewList.style.display = 'none';
                    bulkDeletePreviewList.innerHTML = '';
                }
                if (bulkDeleteResultMsg) bulkDeleteResultMsg.style.display = 'none';
                if (btnBulkDeleteExecute) btnBulkDeleteExecute.disabled = true;
                if (bulkDeleteModal) bulkDeleteModal.showModal();
            });
        }

        if (bulkDeleteForm) {
            bulkDeleteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const dayVal = document.getElementById('bulk-delete-day').value;
                const keywordVal = document.getElementById('bulk-delete-keyword').value.trim().toLowerCase();
                
                const allData = Storage.getAll();
                
                pendingDeleteItems = allData.filter(item => {
                    const itemDay = new Date(item.date).getDay().toString();
                    const dayMatch = (dayVal === 'all') || (itemDay === dayVal);
                    
                    let keywordMatch = true;
                    if (keywordVal !== '') {
                        const targetText = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
                        keywordMatch = targetText.includes(keywordVal);
                    }
                    
                    return dayMatch && keywordMatch;
                });
                
                if (bulkDeleteResultMsg) {
                    bulkDeleteResultMsg.style.display = 'block';
                    if (pendingDeleteItems.length === 0) {
                        bulkDeleteResultMsg.textContent = '❌ 該当する予定は見つかりませんでした。';
                        bulkDeleteResultMsg.style.color = 'var(--text-secondary)';
                        if (btnBulkDeleteExecute) btnBulkDeleteExecute.disabled = true;
                        if (bulkDeletePreviewList) bulkDeletePreviewList.style.display = 'none';
                    } else {
                        bulkDeleteResultMsg.textContent = `⚠️ 以下の ${pendingDeleteItems.length}件 の予定が削除対象です。`;
                        bulkDeleteResultMsg.style.color = '#ef4444';
                        if (btnBulkDeleteExecute) btnBulkDeleteExecute.disabled = false;
                        
                        if (bulkDeletePreviewList) {
                            bulkDeletePreviewList.style.display = 'flex';
                            const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
                            bulkDeletePreviewList.innerHTML = pendingDeleteItems.map(item => {
                                const itemDayStr = daysOfWeek[new Date(item.date).getDay()];
                                return `<div style="font-size:0.85rem; background:white; padding:5px 8px; border-radius:4px; border:1px solid #fca5a5;">
                                    ${item.date}(${itemDayStr}) ${item.startTime || ''} - <b>${this.escapeHTML(item.title)}</b> <span style="color:#64748b; font-size:0.75rem;">[${item.category}]</span>
                                </div>`;
                            }).join('');
                        }
                    }
                }
            });
        }

        if (btnBulkDeleteExecute) {
            btnBulkDeleteExecute.addEventListener('click', () => {
                if (pendingDeleteItems.length === 0) return;
                
                const confirmed = confirm(`本当に ${pendingDeleteItems.length}件 の予定を一括削除しますか？\n（この操作は取り消せません）`);
                if (confirmed) {
                    pendingDeleteItems.forEach(item => {
                        Storage.delete(item.id);
                    });
                    
                    if (window.UI) window.UI.render();
                    if (window.Calendar && window.Calendar.refresh) window.Calendar.refresh();
                    
                    alert(`${pendingDeleteItems.length}件の予定を削除しました。`);
                    if (bulkDeleteModal) bulkDeleteModal.close();
                }
            });
        }
    },

    renderPreview(listEl, emptyMsg, items, btnExecute, btnClear) {
        if (!listEl) return;
        
        if (items.length === 0) {
            listEl.innerHTML = '';
            if (emptyMsg) {
                emptyMsg.style.display = 'block';
                listEl.appendChild(emptyMsg);
            }
            if (btnExecute) btnExecute.disabled = true;
            if (btnClear) btnClear.style.display = 'none';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (btnExecute) btnExecute.disabled = false;
        if (btnClear) btnClear.style.display = 'block';

        const previewItems = items.filter(i => i._isSeries);
        const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
        
        listEl.innerHTML = previewItems.map(item => {
            const timeText = item.startTime ? ` ${item.startTime}` + (item.endTime ? `〜${item.endTime}` : '') : '';
            const dObj = new Date(item.date);
            const dateText = item.date + ` (${daysOfWeek[dObj.getDay()]})`;
            const countText = item._seriesCount > 1 ? `<span style="margin-left:auto; background:#e0e7ff; color:#4f46e5; padding:2px 6px; border-radius:12px; font-size:0.75rem; white-space:nowrap;">全${item._seriesCount}回</span>` : '';
            const descPreview = item.description ? ` <span style="color:#64748b; font-size:0.8rem;">(${this.escapeHTML(item.description)})</span>` : '';
            
            return `<div style="padding: 10px; background: white; border-radius: 6px; border: 1px solid var(--border-light); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn-delete-batch" data-batch-id="${item._batchId}" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0 4px; flex-shrink:0;" title="削除">✕</button>
                        <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                            <span style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">✨ ${this.escapeHTML(item.title)}${descPreview}</span>
                            <span style="color:var(--text-secondary); font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dateText}${timeText}</span>
                        </div>
                        ${countText}
                    </div>`;
        }).join('');
    },

    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
};
