import { db } from './firebase-config.js';
import { Auth } from './auth.js';
import { SafeStorage } from './utils.js';

const STORAGE_KEY = 'my_schedule_pwa_data';
let schedules = []; // In-memory cache
let listeners = []; // UI references to update on data change

export const Storage = {
    // Initialize: setup listeners and initial load
    async init(onDataChangedCallback) {
        if (onDataChangedCallback) {
            listeners.push(onDataChangedCallback);
        }

        // Automatic Backup Check
        this.checkAndCreateBackup();

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
        SafeStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
        // Notify listeners
        this._notifyListeners();
    },

    loadFromLocal() {
        try {
            const data = SafeStorage.getItem(STORAGE_KEY);
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
    },

    // --- Automatic Backup & Restore ---
    checkAndCreateBackup() {
        try {
            const lastBackupStr = SafeStorage.getItem('last_backup_date');
            const now = new Date();
            
            if (!lastBackupStr) {
                this.createBackup(now);
                return;
            }
            
            const lastBackup = new Date(lastBackupStr);
            const daysSince = (now - lastBackup) / (1000 * 60 * 60 * 24);
            // 7日以上経過でバックアップ作成
            if (daysSince >= 7) {
                this.createBackup(now);
            }
        } catch (e) {
            console.error('Backup check failed', e);
        }
    },

    createBackup(dateObj) {
        const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        const backupKey = `schedule_backup_${dateStr}`;
        const data = SafeStorage.getItem(STORAGE_KEY) || '[]';
        
        SafeStorage.setItem(backupKey, data);
        SafeStorage.setItem('last_backup_date', dateObj.toISOString());
        
        // 直近5件だけ残すループ
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('schedule_backup_')) {
                allKeys.push(k);
            }
        }
        
        if (allKeys.length > 5) {
            allKeys.sort(); // 古いものが先頭
            const keysToDelete = allKeys.slice(0, allKeys.length - 5);
            keysToDelete.forEach(k => SafeStorage.removeItem(k));
        }
    },

    getAvailableBackups() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('schedule_backup_')) {
                backups.push(k);
            }
        }
        return backups.sort((a, b) => b.localeCompare(a)); // 新しい順
    },

    async restoreBackup(backupKey) {
        try {
            const data = SafeStorage.getItem(backupKey);
            if (!data) return false;

            const restoredSchedules = JSON.parse(data);
            
            // Local Update
            SafeStorage.setItem(STORAGE_KEY, data);
            schedules = restoredSchedules;
            this._updateState();

            // Cloud Rewrite (If authenticated)
            const uid = Auth.getUserId();
            if (uid && db) {
                const collectionRef = db.collection('users').doc(uid).collection('schedules');
                const snapshot = await collectionRef.get();
                
                // Firestore batch operations (max 500 limit. Assumes mostly under 500)
                const batch = db.batch();
                
                // Delete all existing remote
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                // Save restored items
                restoredSchedules.forEach(item => {
                    const docRef = collectionRef.doc(item.id);
                    batch.set(docRef, item);
                });
                
                await batch.commit();
            }
            return true;
        } catch (e) {
            console.error('Restore failed', e);
            return false;
        }
    }
};
