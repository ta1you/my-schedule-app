const FINANCE_KEY = 'my_finance_pwa_data';

export const Finance = {
    _lastPoints: [],

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

    // Get daily data by type
    _getDailyByType(year, month) {
        const items = this.getMonthlyEntries(year, month);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const byType = {
            slot: new Array(daysInMonth).fill(0),
            pachinko: new Array(daysInMonth).fill(0),
            other: new Array(daysInMonth).fill(0)
        };
        items.forEach(it => {
            const d = new Date(it.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dayIdx = d.getDate() - 1;
                const amt = Number(it.amount) || (Number(it.payout) - Number(it.investment)) || 0;
                const t = it.type || 'other';
                if (byType[t]) byType[t][dayIdx] += amt;
            }
        });
        return byType;
    },

    _renderStackedLine(ctx, width, height, padding, chartW, chartH, year, month, typeColors) {
        const { byDay, totalIncome, totalExpense, totalsByType } = this.getMonthlyAggregates(year, month);
        const byType = this._getDailyByType(year, month);
        const days = Object.values(byType)[0].length;

        // prepare cumulative stacked points for each type
        const typePoints = {};
        const types = ['slot', 'pachinko', 'other'];
        for (let t of types) {
            typePoints[t] = [];
            let cum = 0;
            for (let i = 0; i < days; i++) {
                cum += Number(byType[t][i] || 0);
                typePoints[t].push(cum);
            }
        }

        const allVals = Object.values(typePoints).flat();
        const minVal = Math.min(0, ...allVals);
        const maxVal = Math.max(1, ...allVals);
        const range = (maxVal - minVal) || 1;

        // zero line
        const yZero = padding + chartH * (1 - (0 - minVal) / range);
        ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padding, yZero); ctx.lineTo(padding + chartW, yZero); ctx.stroke();

        // x labels
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        const stepX = chartW / Math.max(1, days);
        const labelEvery = days <= 15 ? 1 : Math.ceil(days / 10);
        for (let i = 0; i < days; i++) {
            if (i % labelEvery === 0 || i === days - 1) {
                const px = padding + (i + 0.5) * stepX;
                ctx.fillText(String(i + 1), px, padding + chartH + 6);
            }
        }

        // draw each type line
        const points = [];
        for (let t of types) {
            ctx.beginPath();
            for (let i = 0; i < days; i++) {
                const v = typePoints[t][i] || 0;
                const x = padding + (i + 0.5) * stepX;
                const y = padding + chartH * (1 - (v - minVal) / range);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                if (i === days - 1 && !points[i]) points[i] = [];
                if (!points[i]) points[i] = [];
                points[i].push({ x, y, v, type: t });
            }
            ctx.strokeStyle = typeColors[t]; ctx.lineWidth = 2; ctx.stroke();

            // draw points
            for (let i = 0; i < days; i++) {
                const v = typePoints[t][i] || 0;
                const x = padding + (i + 0.5) * stepX;
                const y = padding + chartH * (1 - (v - minVal) / range);
                ctx.beginPath(); ctx.fillStyle = typeColors[t]; ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
            }
        }

        this._lastPoints = points.flat() || [];
        this._renderLegend(totalIncome, totalExpense, 0, totalsByType);
    },

    _renderBars(ctx, width, height, padding, chartW, chartH, year, month, byDay, totalIncome, totalExpense, totalsByType) {
        const days = byDay.length;

        // scale for investment/payout/net
        const allVals = [...byDay];
        const maxVal = Math.max(1, Math.abs(totalIncome), Math.abs(totalExpense), ...byDay.map(v => Math.abs(v)));
        const range = maxVal || 1;

        // zero line
        const yZero = padding + chartH / 2;
        ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padding, yZero); ctx.lineTo(padding + chartW, yZero); ctx.stroke();

        // x labels
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        const stepX = chartW / Math.max(1, days);
        const labelEvery = days <= 15 ? 1 : Math.ceil(days / 10);
        for (let i = 0; i < days; i++) {
            if (i % labelEvery === 0 || i === days - 1) {
                const px = padding + (i + 0.5) * stepX;
                ctx.fillText(String(i + 1), px, padding + chartH + 6);
            }
        }

        // draw bars (差額のみ)
        const barW = Math.max(2, stepX * 0.5);
        const points = [];
        for (let i = 0; i < days; i++) {
            const v = Number(byDay[i] || 0);
            const x = padding + (i + 0.5) * stepX - barW / 2;
            const h = (Math.abs(v) / range) * (chartH / 2);
            const y = v >= 0 ? (yZero - h) : yZero;
            ctx.fillStyle = v >= 0 ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';
            ctx.fillRect(x, y, barW, h);

            // store point for tooltip
            const cy = yZero + (h / 2) * (v >= 0 ? -1 : 1);
            points.push({ x: x + barW/2, y: cy, v });
        }

        this._lastPoints = points;
        this._renderLegend(totalIncome, totalExpense, 0, totalsByType);
    },

    _renderLegend(totalIncome, totalExpense, totalOther, totalsByType) {
        const legend = document.getElementById('finance-legend');
        if (!legend) return;

        const total = totalIncome + totalExpense + totalOther;
        let html = `合計: <strong>￥${total.toLocaleString()}</strong>　収入: <strong>￥${totalIncome.toLocaleString()}</strong>　支出: <strong>￥${Math.abs(totalExpense).toLocaleString()}</strong>`;
        const parts = [];
        if (totalsByType.slot) parts.push(`スロット: ￥${totalsByType.slot.toLocaleString()}`);
        if (totalsByType.pachinko) parts.push(`パチンコ: ￥${totalsByType.pachinko.toLocaleString()}`);
        if (totalsByType.other) parts.push(`その他: ￥${totalsByType.other.toLocaleString()}`);
        if (parts.length) html += `　(${parts.join('　')})`;
        legend.innerHTML = html;
    },

    renderChart(canvas, mode = 'cumulative') {
        if (!canvas) return;
        
        // Ensure canvas has display size before setting resolution
        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
            console.warn('Canvas has no display size yet');
            return;
        }

        const ctx = canvas.getContext('2d');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const { byDay, totalIncome, totalExpense, totalsByType } = this.getMonthlyAggregates(year, month);
        const days = byDay.length;

        // Responsive sizing and clear
        const width = canvas.clientWidth;
        const height = canvas.clientHeight || canvas.height;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const padding = 36;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;

        // Color scheme for types
        const typeColors = {
            slot: 'rgba(139,92,246,0.9)',
            pachinko: 'rgba(59,130,246,0.9)',
            other: 'rgba(100,116,139,0.9)'
        };

        // Render by mode
        if (mode === 'stacked') {
            return this._renderStackedLine(ctx, width, height, padding, chartW, chartH, year, month, typeColors);
        } else if (mode === 'bars') {
            return this._renderBars(ctx, width, height, padding, chartW, chartH, year, month, byDay, totalIncome, totalExpense, totalsByType);
        }

        // Default: cumulative/daily line chart
        let vals = [];
        if (mode === 'daily') {
            vals = byDay.slice();
        } else {
            // cumulative
            vals = [];
            let s = 0;
            for (let i = 0; i < days; i++) { s += Number(byDay[i] || 0); vals.push(s); }
        }

        const minVal = Math.min(0, ...vals);
        const maxVal = Math.max(1, ...vals);
        const range = (maxVal - minVal) || 1;

        // draw zero line
        const yZero = padding + chartH * (1 - (0 - minVal) / range);
        ctx.strokeStyle = '#e6e6e6';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padding, yZero); ctx.lineTo(padding + chartW, yZero); ctx.stroke();

        // prepare points
        const stepX = chartW / Math.max(1, days);
        const points = [];
        for (let i = 0; i < days; i++) {
            const v = vals[i] || 0;
            const x = padding + (i + 0.5) * stepX;
            const y = padding + chartH * (1 - (v - minVal) / range);
            points.push({ x, y, v, day: i + 1 });
        }

        // store last points for interaction
        this._lastPoints = points;

        // x labels
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        const labelEvery = days <= 15 ? 1 : Math.ceil(days / 10);
        for (let i = 0; i < days; i++) {
            if (i % labelEvery === 0 || i === days - 1) {
                const px = padding + (i + 0.5) * stepX;
                ctx.fillText(String(i + 1), px, padding + chartH + 6);
            }
        }

        // draw line
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const p = points[i]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(34,139,230,0.95)'; ctx.lineWidth = 2; ctx.stroke();

        // draw points only where data exists
        const monthEntries = this.getMonthlyEntries(year, month);
        const daysWithData = new Set(monthEntries.map(it => new Date(it.date).getDate()));
        for (let i = 0; i < points.length; i++) {
            if (daysWithData.has(i + 1)) {
                const p = points[i]; ctx.beginPath(); ctx.fillStyle = p.v >= 0 ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)'; ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
            }
        }

        // legend update (including type breakdown)
        const legend = document.getElementById('finance-legend');
        if (legend) {
            legend.innerHTML = `合計: <strong>￥${(totalIncome + totalExpense).toLocaleString()}</strong>　収入: <strong>￥${totalIncome.toLocaleString()}</strong>　支出: <strong>￥${Math.abs(totalExpense).toLocaleString()}</strong>`;
            const parts = [];
            if (totalsByType.slot) parts.push(`スロット: ￥${totalsByType.slot.toLocaleString()}`);
            if (totalsByType.pachinko) parts.push(`パチンコ: ￥${totalsByType.pachinko.toLocaleString()}`);
            if (totalsByType.other) parts.push(`その他: ￥${totalsByType.other.toLocaleString()}`);
            if (parts.length) legend.innerHTML += `　(${parts.join('　')})`;
        }

        // return points for immediate use if needed
        return points;
    },

    getLastPoints() { return this._lastPoints || []; }
};