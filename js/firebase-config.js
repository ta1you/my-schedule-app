// TODO: Replace with your actual Firebase project configuration
// 1. Go to Firebase Console (https://console.firebase.google.com/)
// 2. Create a project
// 3. Register a web app
// 4. Copy the config object below
const firebaseConfig = {
    apiKey: "AIzaSyCS44D8DOKZE1PmC9qfiaRny6_U3kB3CCs",
    authDomain: "my-schedule-app-c2633.firebaseapp.com",
    projectId: "my-schedule-app-c2633",
    storageBucket: "my-schedule-app-c2633.firebasestorage.app",
    messagingSenderId: "775640119214",
    appId: "1:775640119214:web:ee8e53bbbcb2c67a97fa3f",
    measurementId: "G-WEEJBHD2ME"
};

// Initialize Firebase
// Note: We use the CDN scripts in index.html, so 'firebase' global is available
let app;
let db;

try {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        
        // オフラインデータの永続化を有効にする
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('複数タブが開かれているため、オフライン永続化が有効になりません。');
                } else if (err.code == 'unimplemented') {
                    console.warn('このブラウザはオフライン永続化をサポートしていません。');
                }
            });
            
        console.log('Firebase initialized');
    } else {
        console.warn('Firebase SDK not loaded');
    }
} catch (e) {
    console.error('Firebase initialization error:', e);
}

export { app, db };
