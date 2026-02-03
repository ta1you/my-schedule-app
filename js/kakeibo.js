import { db } from './firebase-config.js';
import { Auth } from './auth.js';

const KAKEIBO_KEY = 'my_kakeibo_pwa_data';
let items = []; // In-memory cache
let chartInstance = null;
let changeListeners = [];

export const Kakeibo = {
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) changeListeners.push(onDataChangedCallback);

        // 1. Load Local
        try {
            const data = localStorage.getItem(KAKEIBO_KEY);
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
            items = remoteItems;
            items.sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending for list
            localStorage.setItem(KAKEIBO_KEY, JSON.stringify(items));
            this._notifyChange();
        });
    },

    save(item) {
        item.amount = Number(item.amount) || 0;
        item.type = item.type || 'expense';
        item.category = item.category || 'その他';

        // Local update
        const existing = items.findIndex(i => i.id === item.id);
        if (existing >= 0) items[existing] = item; else items.push(item);
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
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
            const d = new Date(it.date);
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
            const d = new Date(it.date);
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

    renderChart(canvas, mode = 'pie') {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const now = new Date();
        const { byDay, totalIncome, totalExpense, categoryTotals } = this.getMonthlyAggregates(now.getFullYear(), now.getMonth());

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
        this._updateLegend(totalIncome, totalExpense);
    },

    _updateLegend(totalIncome, totalExpense) {
        const legend = document.getElementById('kakeibo-legend');
        if (!legend) return;
        const balance = totalIncome - totalExpense;
        legend.innerHTML = `
            <div style="display: flex; gap: 1rem; justify-content: center; font-size: 0.9rem;">
                <div style="text-align: center;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">残り</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: ${balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)'}">￥${balance.toLocaleString()}</div>
                </div>
                <div style="border-left: 1px solid var(--border-light); padding-left: 1rem;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">収入</div>
                    <div style="color: var(--success-color); font-weight: 600;">￥${totalIncome.toLocaleString()}</div>
                </div>
                <div style="border-left: 1px solid var(--border-light); padding-left: 1rem;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">支出</div>
                    <div style="color: var(--danger-color); font-weight: 600;">￥${totalExpense.toLocaleString()}</div>
                </div>
            </div>
        `;
    }
};
