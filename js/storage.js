import { db } from './firebase-config.js';
import { Auth } from './auth.js';

const STORAGE_KEY = 'my_schedule_pwa_data';
let schedules = []; // In-memory cache
let listeners = []; // UI references to update on data change

export const Storage = {
    // Initialize: setup listeners and initial load
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) {
            listeners.push(onDataChangedCallback);
        }

        // 1. Load from LocalStorage first (instant render)
        this.loadFromLocal();
        this._notifyListeners();

        // 2. Wait for Auth
        const user = await Auth.init();
        if (!user) return; // Auth failed or offline

        // 3. Setup Firestore Realtime Sync
        const userId = user.uid;
        const collectionRef = db.collection('users').doc(userId).collection('schedules');

        collectionRef.onSnapshot((snapshot) => {
            const remoteSchedules = [];
            snapshot.forEach(doc => {
                remoteSchedules.push(doc.data());
            });

            // If remote is empty but local has data, MIGRATE to cloud
            if (remoteSchedules.length === 0 && schedules.length > 0) {
                console.log('Migrating local schedules to cloud...');
                schedules.forEach(item => {
                    collectionRef.doc(item.id).set(item);
                });
            } else {
                // Update local cache with remote data
                schedules = remoteSchedules;
                this._updateState();
            }
        });
    },

    _updateState() {
        // Sort
        schedules.sort((a, b) => new Date(a.date + 'T' + (a.startTime || '00:00')) - new Date(b.date + 'T' + (b.startTime || '00:00')));
        // Update LocalStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
        // Notify listeners
        this._notifyListeners();
    },

    loadFromLocal() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            schedules = data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Local load failed', e);
            schedules = [];
        }
    },

    getAll() {
        return schedules;
    },

    save(schedule) {
        // Optimistic update
        const existingIndex = schedules.findIndex(s => s.id === schedule.id);
        if (existingIndex >= 0) {
            schedules[existingIndex] = schedule;
        } else {
            schedules.push(schedule);
        }
        
        // Immediate local persistence
        this._updateState();

        // Sync to Cloud
        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('schedules').doc(schedule.id).set(schedule)
                .catch(err => console.error('Save to cloud failed', err));
        }
    },

    delete(id) {
        // Optimistic update
        schedules = schedules.filter(s => s.id !== id);
        
        // Immediate local persistence
        this._updateState();

        // Sync to Cloud
        const uid = Auth.getUserId();
        if (uid) {
            db.collection('users').doc(uid).collection('schedules').doc(id).delete()
                .catch(err => console.error('Delete from cloud failed', err));
        }
    },

    getById(id) {
        return schedules.find(s => s.id === id);
    },

    _notifyListeners() {
        listeners.forEach(cb => cb());
    }
};
