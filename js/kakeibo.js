import { db } from './firebase-config.js';
import { Auth } from './auth.js';
import { SafeStorage } from './utils.js';

const KAKEIBO_KEY = 'my_kakeibo_pwa_data';
let items = []; // In-memory cache
let chartInstance = null;
let changeListeners = [];

export const Kakeibo = {
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) changeListeners.push(onDataChangedCallback);

        // 1. Load Local
        try {
            const data = SafeStorage.getItem(KAKEIBO_KEY);
            items = data ? JSON.parse(data) : [];
        } catch (e) { items = []; }
        this._notifyChange();

        // 2. Auth & Sync
        const user = await Auth.init();
        if (!user) return;

        const collectionRef = db.collection('users').doc(user.uid).collection('kakeibo');

        collectionRef.onSnapshot((snapshot) => {
            const remoteItems = [];
            snapshot.forEach(doc => remoteItems.push(doc.data()));

            // Prevent overwriting local data with empty remote data if local has content
            if (remoteItems.length === 0 && items.length > 0) {
                console.log('Migrating local kakeibo data to cloud...');
                items.forEach(it => {
                    collectionRef.doc(it.id).set(it);
                });
            } else {
                items = remoteItems;
                items.sort((a, b) => this._parseDate(b.date) - this._parseDate(a.date)); // Descending for list
                SafeStorage.setItem(KAKEIBO_KEY, JSON.stringify(items));
                this._notifyChange();
            }
        });
    },

    save(item) {
        item.amount = Number(item.amount) || 0;
        item.type = item.type || 'expense';
        item.category = item.category || 'その他';

        // Local update
        const existing = items.findIndex(i => i.id === item.id);
        if (existing >= 0) items[existing] = item; else items.push(item);
        items.sort((a, b) => this._parseDate(b.date) - this._parseDate(a.date));
        SafeStorage.setItem(KAKEIBO_KEY, JSON.stringify(items));
        this._notifyChange();

        // Cloud update
        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('kakeibo').doc(item.id).set(item)
                .catch(err => console.error('Kakeibo save error', err));
        }
    },

    delete(id) {
        items = items.filter(i => i.id !== id);
        SafeStorage.setItem(KAKEIBO_KEY, JSON.stringify(items));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('kakeibo').doc(id).delete();
        }
    },

    _notifyChange() {
        changeListeners.forEach(cb => cb());
    },

    getMonthlyEntries(year, month) {
        return items.filter(it => {
            const d = this._parseDate(it.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    },

    getMonthlyAggregates(year, month) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const byDay = new Array(daysInMonth).fill(0);
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryTotals = {};

        items.forEach(it => {
            const d = this._parseDate(it.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dayIndex = d.getDate() - 1;
                const amt = Number(it.amount);

                if (it.type === 'income') {
                    totalIncome += amt;
                    byDay[dayIndex] += amt;
                } else {
                    totalExpense += amt;
                    byDay[dayIndex] -= amt; // Net change
                    if (!categoryTotals[it.category]) categoryTotals[it.category] = 0;
                    categoryTotals[it.category] += amt;
                }
            }
        });
        return { byDay, totalIncome, totalExpense, categoryTotals };
    },

    getWeeklyExpense() {
        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 6); // Last 7 days inclusive
        oneWeekAgo.setHours(0, 0, 0, 0);

        let weeklyTotal = 0;
        items.forEach(it => {
            const d = this._parseDate(it.date);
            if (d >= oneWeekAgo && d <= now && it.type === 'expense') {
                weeklyTotal += Number(it.amount);
            }
        });
        return weeklyTotal;
    },

    getCategoryRanking(year, month) {
        const { categoryTotals } = this.getMonthlyAggregates(year, month);
        return Object.entries(categoryTotals)
            .map(([cat, amount]) => ({ category: cat, amount }))
            .sort((a, b) => b.amount - a.amount);
    },

    renderChart(canvas, mode = 'pie', year, month) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Default to current month if not provided
        const now = new Date();
        if (year === undefined) year = now.getFullYear();
        if (month === undefined) month = now.getMonth();

        const { byDay, totalIncome, totalExpense, categoryTotals } = this.getMonthlyAggregates(year, month);

        if (chartInstance) chartInstance.destroy();

        let type, data, options;

        if (mode === 'pie') {
            type = 'doughnut';
            const catLabels = Object.keys(categoryTotals);
            const catData = Object.values(categoryTotals);
            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#76A346'];

            data = {
                labels: catLabels.length ? catLabels : ['データなし'],
                datasets: [{
                    data: catData.length ? catData : [1],
                    backgroundColor: catData.length ? colors.slice(0, catLabels.length) : ['#E2E8F0'],
                    borderWidth: 1
                }]
            };
            options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            };
        } else if (mode === 'daily') {
            const labels = Array.from({ length: byDay.length }, (_, i) => i + 1);
            type = 'bar';
            data = {
                labels: labels,
                datasets: [{
                    label: '日別収支',
                    data: byDay,
                    backgroundColor: byDay.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderRadius: 4
                }]
            };
            options = { responsive: true, maintainAspectRatio: false };
        } else {
            const labels = Array.from({ length: byDay.length }, (_, i) => i + 1);
            let current = 0;
            const cumulativeData = byDay.map(v => { current += v; return current; });
            type = 'line';
            data = {
                labels: labels,
                datasets: [{
                    label: '累積収支',
                    data: cumulativeData,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    fill: true,
                    tension: 0.4
                }]
            };
            options = { responsive: true, maintainAspectRatio: false };
        }

        chartInstance = new Chart(ctx, { type, data, options });

        // Also update the dashboard and list whenever we render the chart
        this._updateDashboard(totalIncome, totalExpense, year, month);
        this._updateCategoryList(year, month);
    },

    _updateDashboard(totalIncome, totalExpense, year, month) {
        const legend = document.getElementById('kakeibo-legend');
        if (!legend) return;

        const balance = totalIncome - totalExpense;

        const now = new Date();
        const isCurrentMonth = (year === now.getFullYear() && month === now.getMonth());

        let subPanelHtml = '';
        if (isCurrentMonth) {
            const weeklyTotal = this.getWeeklyExpense();
            subPanelHtml = `
                <div style="text-align: center; padding: 0.5rem; background: #fff0f0; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: var(--danger-color);">直近7日間の支出</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--danger-color);">￥${weeklyTotal.toLocaleString()}</div>
                    <div style="font-size: 0.7rem; color: var(--text-tertiary);">リアルタイム集計</div>
                </div>
            `;
        } else {
            subPanelHtml = `
                <div style="text-align: center; padding: 0.5rem; background: #f0f9ff; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">収支バランス</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: ${balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)'}">${balance >= 0 ? '+' : ''}￥${balance.toLocaleString()}</div>
                    <div style="font-size: 0.7rem; color: var(--text-tertiary);">${year}年${month + 1}月</div>
                </div>
            `;
        }

        // Progress bar for balance (simple visual)
        const percentage = totalIncome > 0 ? Math.min(100, (totalExpense / totalIncome) * 100) : 0;
        let progressColor = 'var(--success-color)';
        if (percentage > 80) progressColor = 'var(--warning-color)';
        if (percentage > 100) progressColor = 'var(--danger-color)';

        legend.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="text-align: center; padding: 0.5rem; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${isCurrentMonth ? '今月の残り' : '月間残高'}</div>
                    <div style="font-size: 1.4rem; font-weight: 800; color: ${balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)'}">￥${balance.toLocaleString()}</div>
                    <div style="margin-top: 4px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: ${progressColor};"></div>
                    </div>
                </div>
                ${subPanelHtml}
            </div>
            <div style="display: flex; justify-content: space-around; font-size: 0.9rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">収入</div>
                    <div style="color: var(--success-color); font-weight: 600;">￥${totalIncome.toLocaleString()}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">支出</div>
                    <div style="color: var(--danger-color); font-weight: 600;">￥${totalExpense.toLocaleString()}</div>
                </div>
            </div>
        `;
    },

    _updateCategoryList(year, month) {
        const listContainer = document.getElementById('kakeibo-category-list');
        if (!listContainer) return;

        const ranking = this.getCategoryRanking(year, month);
        if (ranking.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">データなし</div>';
            return;
        }

        const maxVal = ranking[0].amount;

        listContainer.innerHTML = ranking.map(item => {
            const percent = Math.round((item.amount / maxVal) * 100);
            return `
                <div class="category-list-item" data-category="${item.category}" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                        <span style="font-weight: 600; min-width: 60px;">${item.category}</span>
                        <div style="flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${percent}%; height: 100%; background: var(--primary-light); border-radius: 4px;"></div>
                        </div>
                    </div>
                    <span style="font-weight: 700; color: var(--text-primary); margin-left: 12px;">￥${item.amount.toLocaleString()}</span>
                </div>
            `;
        }).join('');
    },

    _notifyChange() {
        // Trigger chart render if visible, which in turn updates dashboard
        const canvas = document.getElementById('kakeibo-chart');
        if (canvas) {
            // Let the UI logic handle it or force generic update
        }
        // Force refresh all listeners
        changeListeners.forEach(cb => cb());
    },

    _updateLegend(totalIncome, totalExpense) {
        // Deprecated in favor of _updateDashboard but kept for compatibility
        this._updateDashboard(totalIncome, totalExpense);
    },

    // Robust date parsing helper to treat YYYY-MM-DD as local time
    _parseDate(dateStr) {
        if (!dateStr) return new Date();
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
};
