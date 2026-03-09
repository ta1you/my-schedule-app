import { db } from './firebase-config.js';
import { Auth } from './auth.js';

const FINANCE_KEY = 'my_finance_pwa_data';
let items = []; // In-memory cache
let chartInstance = null;
let changeListeners = [];

export const Finance = {
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) {
            changeListeners.push(onDataChangedCallback);
        }

        // 1. Load Local
        this.loadFromLocal();
        this._notifyChange();

        // 2. Auth & Sync
        const user = await Auth.init();
        if (!user) return;

        const userId = user.uid;
        const collectionRef = db.collection('users').doc(userId).collection('finance');

        collectionRef.onSnapshot((snapshot) => {
            const remoteItems = [];
            snapshot.forEach(doc => {
                remoteItems.push(doc.data());
            });

            if (remoteItems.length === 0 && items.length > 0) {
                console.log('Migrating local finance data to cloud...');
                items.forEach(it => {
                    collectionRef.doc(it.id).set(it);
                });
            } else {
                items = remoteItems;
                items.sort((a, b) => new Date(a.date) - new Date(b.date));
                localStorage.setItem(FINANCE_KEY, JSON.stringify(items));
                this._notifyChange();
            }
        });
    },

    loadFromLocal() {
        try {
            const data = localStorage.getItem(FINANCE_KEY);
            items = data ? JSON.parse(data) : [];
        } catch (e) {
            items = [];
        }
    },

    getAll() {
        return items;
    },

    save(item) {
        item.investment = Number(item.investment) || 0;
        item.payout = Number(item.payout) || 0;
        item.amount = Number(item.amount) || (item.payout - item.investment);

        // Local update
        const existing = items.findIndex(i => i.id === item.id);
        if (existing >= 0) items[existing] = item; else items.push(item);
        items.sort((a, b) => new Date(a.date) - new Date(b.date));
        localStorage.setItem(FINANCE_KEY, JSON.stringify(items));
        this._notifyChange();

        // Cloud update
        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('finance').doc(item.id).set(item)
                .catch(err => console.error('Finance save error', err));
        }
    },

    delete(id) {
        items = items.filter(i => i.id !== id);
        localStorage.setItem(FINANCE_KEY, JSON.stringify(items));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('finance').doc(id).delete();
        }
    },

    _notifyChange() {
        // Re-render chart if canvas exists in DOM
        const canvas = document.getElementById('finance-chart');
        if (canvas) {
            // We let the app.js listener handle re-rendering through the callback
        }
        changeListeners.forEach(cb => cb());
    },

    // ... Calculation methods (unchanged logic, just using 'items' variable) ...
    getMonthlyEntries(year, month) {
        return items.filter(it => {
            const d = new Date(it.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    },

    getMonthlyAggregates(year, month) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const byDay = new Array(daysInMonth).fill(0);
        let totalIncome = 0, totalExpense = 0;
        const totalsByType = { slot: 0, pachinko: 0, other: 0 };

        items.forEach(it => {
            const d = new Date(it.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dayIndex = d.getDate() - 1;
                const amt = Number(it.amount) || (Number(it.payout) - Number(it.investment)) || 0;
                byDay[dayIndex] += amt;
                if (amt >= 0) totalIncome += amt; else totalExpense += amt;
                const t = it.type || 'other';
                if (!totalsByType[t]) totalsByType[t] = 0;
                totalsByType[t] += amt;
            }
        });

        return { byDay, totalIncome, totalExpense, totalsByType };
    },

    // Helper for tooltip to find closest point (need to store last points)
    _lastPoints: [],
    getLastPoints() { return this._lastPoints; },

    renderChart(canvas, mode = 'cumulative') {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const { byDay, totalIncome, totalExpense, totalsByType } = this.getMonthlyAggregates(year, month);
        const daysInMonth = byDay.length;
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Calculate Cumulative Data
        let currentTotal = 0;
        const cumulativeData = byDay.map(val => {
            currentTotal += val;
            return currentTotal;
        });

        if (chartInstance) {
            chartInstance.destroy();
        }

        let type, data, options;

        if (mode === 'daily') {
            type = 'bar';
            data = {
                labels: labels,
                datasets: [{
                    label: '日別収支',
                    data: byDay,
                    backgroundColor: byDay.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderColor: byDay.map(v => v >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            };
        } else {
            type = 'line';
            data = {
                labels: labels,
                datasets: [{
                    label: '累積収支',
                    data: cumulativeData,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: 'white',
                    pointBorderColor: 'rgba(99, 102, 241, 1)',
                    pointRadius: 3,
                    fill: true,
                    tension: 0.4
                }]
            };
        }

        // Store points for tooltip
        this._lastPoints = labels.map((day, i) => ({
            day: day,
            val: mode === 'daily' ? byDay[i] : cumulativeData[i],
        }));

        options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function (context) { }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { callback: (v) => '￥' + v.toLocaleString() }
                },
                x: {
                    grid: { display: false }
                }
            },
            animation: {
                onComplete: () => { }
            }
        };

        chartInstance = new Chart(ctx, { type, data, options });
        this._updateLegend(totalIncome, totalExpense, totalsByType);
    },

    _updateLegend(totalIncome, totalExpense, totalsByType) {
        const legend = document.getElementById('finance-legend');
        if (!legend) return;
        const total = totalIncome + totalExpense;
        const net = totalIncome + totalExpense;
        let html = `
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; font-size: 0.9rem;">
                <span style="color: var(--text-primary)">合計: <strong>￥${net.toLocaleString()}</strong></span>
                <span style="color: var(--success-color)">収入: <strong>￥${totalIncome.toLocaleString()}</strong></span>
                <span style="color: var(--danger-color)">支出: <strong>￥${Math.abs(totalExpense).toLocaleString()}</strong></span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; text-align: center;">
                (スロット: ￥${(totalsByType.slot || 0).toLocaleString()} / パチンコ: ￥${(totalsByType.pachinko || 0).toLocaleString()} / その他: ￥${(totalsByType.other || 0).toLocaleString()})
            </div>
        `;
        legend.innerHTML = html;
    }
};