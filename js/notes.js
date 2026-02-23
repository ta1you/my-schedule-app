import { db } from './firebase-config.js';
import { Auth } from './auth.js';
import { generateId, getTodayString } from './utils.js';

const NOTES_KEY = 'my_notes_pwa_data';
let notes = [];
let changeListeners = [];

export const Notes = {
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) {
            changeListeners.push(onDataChangedCallback);
        }

        this.loadFromLocal();
        this._notifyChange();

        const user = await Auth.init();
        if (!user) return;

        const userId = user.uid;
        const collectionRef = db.collection('users').doc(userId).collection('notes');

        collectionRef.onSnapshot((snapshot) => {
            const remoteItems = [];
            snapshot.forEach(doc => {
                remoteItems.push(doc.data());
            });

            if (remoteItems.length === 0 && notes.length > 0) {
                notes.forEach(it => collectionRef.doc(it.id).set(it));
            } else {
                notes = remoteItems;
                notes.sort((a, b) => new Date(b.date) - new Date(a.date));
                localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
                this._notifyChange();
            }
        });
    },

    loadFromLocal() {
        try {
            const data = localStorage.getItem(NOTES_KEY);
            notes = data ? JSON.parse(data) : [];
            notes.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            notes = [];
        }
    },

    save(note) {
        if (!note.id) note.id = generateId();
        if (!note.date) note.date = getTodayString();

        const existing = notes.findIndex(i => i.id === note.id);
        if (existing >= 0) notes[existing] = note; else notes.push(note);

        notes.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('notes').doc(note.id).set(note)
                .catch(err => console.error('Notes save error', err));
        }
    },

    delete(id) {
        notes = notes.filter(i => i.id !== id);
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
        this._notifyChange();

        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('notes').doc(id).delete();
        }
    },

    _notifyChange() {
        changeListeners.forEach(cb => cb());
    },

    render() {
        const container = document.getElementById('notes-container');
        if (!container) return;

        if (notes.length === 0) {
            container.innerHTML = '<div class="empty-msg">付箋がありません</div>';
            return;
        }

        // Group by month
        const groups = {};
        notes.forEach(note => {
            const date = new Date(note.date);
            const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(note);
        });

        container.innerHTML = Object.keys(groups).map(month => `
            <div class="note-month-group">
                <h3 class="note-month-header">${month}</h3>
                <div class="notes-grid">
                    ${groups[month].map(note => `
                        <div class="note-card" data-id="${note.id}">
                            ${note.image ? `<div class="note-image-container"><img src="${note.image}" class="note-image" onclick="window.openImageModal('${note.image}')"></div>` : ''}
                            <div class="note-content-wrapper">
                                <div class="note-date">${note.date.split('-').slice(1).join('/')}</div>
                                <h4 class="note-title">${note.title || '無題'}</h4>
                                <div class="note-body">${note.content.replace(/\n/g, '<br>')}</div>
                                <div class="note-actions">
                                    <button class="btn-icon-del" onclick="window.deleteNote('${note.id}')">削除</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
};
