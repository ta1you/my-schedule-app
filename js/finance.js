const FINANCE_KEY = 'my_finance_pwa_data';
let chartInstance = null;

export const Finance = {
    getAll() {
        const data = localStorage.getItem(FINANCE_KEY);
        return data ? JSON.parse(data) : [];
    },

    save(item) {
        item.investment = Number(item.investment) || 0;
        item.payout = Number(item.payout) || 0;
        item.amount = Number(item.amount) || (item.payout - item.investment);
        const items = this.getAll();
        const existing = items.findIndex(i => i.id === item.id);
        if (existing >= 0) items[existing] = item; else items.push(item);
        items.sort((a, b) => new Date(a.date) - new Date(b.date));
        localStorage.setItem(FINANCE_KEY, JSON.stringify(items));
    },

    delete(id) {
        const items = this.getAll().filter(i => i.id !== id);
        localStorage.setItem(FINANCE_KEY, JSON.stringify(items));
    },

    getMonthlyEntries(year, month) {
        const items = this.getAll();
        return items.filter(it => {
            const d = new Date(it.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    },

    getMonthlyAggregates(year, month) {
        const items = this.getAll();
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

        // Destroy existing chart if any
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Configuration based on mode
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
            // Default: Cumulative Line Chart
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

        options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
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
            }
        };

        chartInstance = new Chart(ctx, { type, data, options });

        // Update Legend Text
        this._updateLegend(totalIncome, totalExpense, totalsByType);
    },

    _updateLegend(totalIncome, totalExpense, totalsByType) {
        const legend = document.getElementById('finance-legend');
        if (!legend) return;

        const total = totalIncome + totalExpense; // expense is negative
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