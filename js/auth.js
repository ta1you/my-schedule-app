import { auth } from './firebase-config.js';

export const Auth = {
    user: null,

    // Initialize authentication
    init() {
        return new Promise((resolve) => {
            if (!auth) {
                console.warn('Auth not initialized (Firebase not loaded)');
                resolve(null);
                return;
            }

            // Listen for auth state changes
            auth.onAuthStateChanged(user => {
                if (user) {
                    console.log('User signed in:', user.uid);
                    this.user = user;
                } else {
                    console.log('User signed out');
                    this.user = null;
                    // Auto sign-in anonymously if not signed in
                    this.signInAnonymously();
                }
                resolve(user);
            });
        });
    },

    // Sign in anonymously
    async signInAnonymously() {
        if (!auth) return;
        try {
            await auth.signInAnonymously();
        } catch (error) {
            console.error('Error signing in anonymously:', error);
        }
    },

    // Get current user ID
    getUserId() {
        return this.user ? this.user.uid : null;
    }
};
