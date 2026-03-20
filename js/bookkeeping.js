import { db } from './firebase-config.js';
import { Auth } from './auth.js';
import { generateId, getTodayString, SafeStorage } from './utils.js';

const BOOKKEEPING_KEY = 'my_bookkeeping_pwa_data';
let journalEntries = [];
let changeListeners = [];

const accounts = [
    // 資産 (Assets)
    { name: "現金", type: "asset" },
    { name: "普通預金", type: "asset" },
    { name: "売掛金", type: "asset" },
    { name: "未収金", type: "asset" },
    { name: "仮払金", type: "asset" },

    // 負債 (Liabilities)
    { name: "買掛金", type: "liability" },
    { name: "未払金", type: "liability" },
    { name: "借入金", type: "liability" },
    { name: "前受金", type: "liability" },

    // 費用 (Expenses)
    { name: "食費", type: "expense" },
    { name: "交通費", type: "expense" },
    { name: "通信費", type: "expense" },
    { name: "水道光熱費", type: "expense" },
    { name: "娯楽費", type: "expense" },
    { name: "日用品費", type: "expense" },
    { name: "消耗品費", type: "expense" },
    { name: "雑費", type: "expense" },

    // 収益 (Revenue)
    { name: "給料", type: "revenue" },
    { name: "営業外収益", type: "revenue" },
    { name: "雑収入", type: "revenue" }
];

export const Bookkeeping = {
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
        const collectionRef = db.collection('users').doc(userId).collection('bookkeeping');

        collectionRef.onSnapshot((snapshot) => {
            const remoteItems = [];
            snapshot.forEach(doc => {
                remoteItems.push(doc.data());
            });

            if (remoteItems.length === 0 && journalEntries.length > 0) {
                console.log('Migrating local bookkeeping data to cloud...');
                journalEntries.forEach(it => {
                    collectionRef.doc(it.id).set(it);
                });
            } else {
                journalEntries = remoteItems;
                journalEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
                SafeStorage.setItem(BOOKKEEPING_KEY, JSON.stringify(journalEntries));
                this._notifyChange();
            }
        });
    },

    loadFromLocal() {
        try {
            const data = SafeStorage.getItem(BOOKKEEPING_KEY);
            journalEntries = data ? JSON.parse(data) : [];
        } catch (e) {
            journalEntries = [];
        }
    },

    saveEntry(entry) {
        if (!entry.id) entry.id = generateId();

        const existing = journalEntries.findIndex(i => i.id === entry.id);
        if (existing >= 0) journalEntries[existing] = entry; else journalEntries.push(entry);

        journalEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        SafeStorage.setItem(BOOKKEEPING_KEY, JSON.stringify(journalEntries));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('bookkeeping').doc(entry.id).set(entry)
                .catch(err => console.error('Bookkeeping save error', err));
        }
    },

    deleteEntry(id) {
        journalEntries = journalEntries.filter(i => i.id !== id);
        SafeStorage.setItem(BOOKKEEPING_KEY, JSON.stringify(journalEntries));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('bookkeeping').doc(id).delete();
        }
    },

    _notifyChange() {
        changeListeners.forEach(cb => cb());
    },

    getAccounts() {
        return accounts;
    },

    getJournal(year, month) {
        return journalEntries.filter(e => {
            const [y, m] = e.date.split('-').map(Number);
            return y === year && (m - 1) === month;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getLedger(accountName) {
        return journalEntries.filter(e => e.debit === accountName || e.credit === accountName)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    calculateBalance(accountName) {
        const account = accounts.find(a => a.name === accountName);
        if (!account) return 0;

        let balance = 0;
        journalEntries.forEach(e => {
            if (e.debit === accountName) {
                if (account.type === 'asset' || account.type === 'expense') {
                    balance += e.amount;
                } else {
                    balance -= e.amount;
                }
            } else if (e.credit === accountName) {
                if (account.type === 'asset' || account.type === 'expense') {
                    balance -= e.amount;
                } else {
                    balance += e.amount;
                }
            }
        });
        return balance;
    },

    render(year, month) {
        this.renderInputForm();
        this.renderJournal(year, month);
        this.renderLedger();
    },

    renderInputForm() {
        const debitSelect = document.getElementById('book-debit');
        const creditSelect = document.getElementById('book-credit');
        if (!debitSelect || !creditSelect) return;

        if (debitSelect.options.length <= 1) {
            accounts.forEach(acc => {
                const opt1 = new Option(acc.name, acc.name);
                const opt2 = new Option(acc.name, acc.name);
                debitSelect.add(opt1);
                creditSelect.add(opt2);
            });
        }
    },

    renderJournal(year, month) {
        const container = document.getElementById('journal-list');
        const label = document.getElementById('book-month-label');
        if (!container) return;

        // If no year/month provided, use current date
        const now = new Date();
        const y = year !== undefined ? year : now.getFullYear();
        const m = month !== undefined ? month : now.getMonth();

        if (label) {
            label.textContent = `${y}年${m + 1}月`;
        }

        const entries = this.getJournal(y, m);
        if (entries.length === 0) {
            container.innerHTML = '<div class="empty-msg">仕訳データがありません</div>';
            return;
        }

        container.innerHTML = entries.map(e => {
            const [y, m, d] = e.date.split('-').map(Number);
            const dateStr = `${y}年${m}月${d}日`;
            return `
                <div class="journal-item">
                    <div class="journal-header">${dateStr}</div>
                    <div class="journal-body">
                        <div class="journal-debit">
                            <span class="acc-name">${e.debit}</span>
                            <span class="acc-amount">${Number(e.amount).toLocaleString()}</span>
                        </div>
                        <div class="journal-sep">/</div>
                        <div class="journal-credit">
                            <span class="acc-name">${e.credit}</span>
                            <span class="acc-amount">${Number(e.amount).toLocaleString()}</span>
                        </div>
                        <button class="btn-del-book" onclick="window.deleteBookEntry('${e.id}')">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderLedger() {
        const select = document.getElementById('ledger-account-select');
        const container = document.getElementById('ledger-list');
        const balanceDisplay = document.getElementById('ledger-balance');
        if (!select || !container || !balanceDisplay) return;

        // Populate select if empty
        if (select.options.length <= 1) {
            accounts.forEach(acc => {
                select.add(new Option(acc.name, acc.name));
            });
        }

        const accountName = select.value;
        if (!accountName) {
            container.innerHTML = '<div class="empty-msg">科目を選択してください</div>';
            balanceDisplay.innerHTML = '';
            return;
        }

        const entries = this.getLedger(accountName);
        const account = accounts.find(a => a.name === accountName);

        container.innerHTML = entries.map(e => {
            const isDebit = e.debit === accountName;
            const otherAccount = isDebit ? e.credit : e.debit;
            return `
                <div class="ledger-item">
                    <div class="ledger-date">${e.date.split('-').slice(1).join('/')}</div>
                    <div class="ledger-opp">${otherAccount}</div>
                    <div class="ledger-debit-val">${isDebit ? Number(e.amount).toLocaleString() : ''}</div>
                    <div class="ledger-credit-val">${!isDebit ? Number(e.amount).toLocaleString() : ''}</div>
                </div>
            `;
        }).join('');

        const balance = this.calculateBalance(accountName);
        balanceDisplay.innerHTML = `残高: ￥${balance.toLocaleString()}`;
    }
};
