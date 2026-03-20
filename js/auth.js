import { SafeStorage } from './utils.js';

export const Auth = {
    deviceId: null,

    // Initialize authentication using device ID
    init() {
        return new Promise((resolve) => {
            let id = SafeStorage.getItem('deviceId');
            
            if (!id) {
                // Generate a random ID using crypto.randomUUID or fallback
                id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'dev_' + Date.now() + Math.random().toString(36).substring(2);
                SafeStorage.setItem('deviceId', id);
                console.log('新規Device IDを生成しました:', id);
            } else {
                console.log('Device IDを読み込みました:', id);
            }
            
            this.deviceId = id;
            // Return a mock user object with uid for compatibility with other modules
            resolve({ uid: id });
        });
    },

    // Get current user (device) ID
    getUserId() {
        return this.deviceId;
    }
};
