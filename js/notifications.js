import { Storage } from './storage.js';
import { getTodayString } from './utils.js';
import { Settings } from './settings.js';

class NotificationsManager {
    constructor() {
        this.timer = null;
        this.notifiedEvents = new Set();
    }

    init() {
        // Load notified events from session or localStorage to avoid spamming if app reloads
        try {
            const saved = sessionStorage.getItem('pwa_notified_events');
            if (saved) {
                this.notifiedEvents = new Set(JSON.parse(saved));
            }
        } catch (e) {}

        // Bind settings changes
        const toggle = document.getElementById('toggle-push-notifications');
        const minutesSelect = document.getElementById('setting-push-minutes');
        const testBtn = document.getElementById('btn-test-notification');
        const container = document.getElementById('setting-push-minutes-container');

        if (toggle && minutesSelect) {
            // Restore from settings
            toggle.checked = Settings.prefs.pushNotificationsEnabled || false;
            if (Settings.prefs.pushMinutes !== undefined) {
                minutesSelect.value = Settings.prefs.pushMinutes;
            }

            this.updateUI(toggle.checked, container, testBtn);

            toggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                if (enabled) {
                    const granted = await this.requestPermission();
                    if (!granted) {
                        e.target.checked = false;
                        alert('通知の許可がブロックされています。ブラウザの設定から通知を許可してください。');
                        return;
                    }
                }
                Settings.updatePref('pushNotificationsEnabled', e.target.checked);
                this.updateUI(e.target.checked, container, testBtn);
                
                if (e.target.checked) {
                    this.startDaemon();
                } else {
                    this.stopDaemon();
                }
            });

            minutesSelect.addEventListener('change', (e) => {
                Settings.updatePref('pushMinutes', parseInt(e.target.value));
            });

            if (testBtn) {
                testBtn.addEventListener('click', () => {
                    alert('10秒後にテスト通知を送信します。アプリをバックグラウンドに移動して確認してみてください。（※完全にアプリを終了させないでください）');
                    setTimeout(() => {
                        this.sendNotification('テスト通知', {
                            body: 'これはスケジュールアプリのテスト通知です！',
                        });
                    }, 10000);
                });
            }

            if (toggle.checked) {
                this.startDaemon();
            }
        }
    }

    updateUI(enabled, container, testBtn) {
        if (enabled) {
            container.style.display = 'flex';
            testBtn.style.display = 'flex';
        } else {
            container.style.display = 'none';
            testBtn.style.display = 'none';
        }
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            alert('このブラウザはプッシュ通知をサポートしていません。');
            return false;
        }
        let permission = Notification.permission;
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }
        return permission === 'granted';
    }

    startDaemon() {
        if (this.timer) clearInterval(this.timer);
        // Check every 30 seconds
        this.timer = setInterval(() => this.checkSchedules(), 30000);
        this.checkSchedules(); // Check immediately
    }

    stopDaemon() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    checkSchedules() {
        if (Notification.permission !== 'granted') return;

        const now = new Date();
        const minutesAhead = Settings.prefs.pushMinutes !== undefined ? parseInt(Settings.prefs.pushMinutes) : 10;
        
        const todayStr = getTodayString();
        const schedules = Storage.getAll().filter(s => s.date === todayStr && s.startTime);

        schedules.forEach(s => {
            const [h, m] = s.startTime.split(':').map(Number);
            const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
            
            const diffMs = eventTime.getTime() - now.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            // If the event starts exactly within `minutesAhead` (e.g. 10 mins)
            // allow a 1 minute window (diffMins === minutesAhead)
            // also make sure we haven't already notified for this particular event today
            if (diffMins === minutesAhead && !this.notifiedEvents.has(s.id)) {
                this.notifiedEvents.add(s.id);
                this.saveNotified();
                
                const timeStr = minutesAhead === 0 ? '時間です' : `${minutesAhead}分前です`;
                this.sendNotification(`もうすぐ予定の${timeStr}`, {
                    body: `${s.startTime} から「${s.title}」の予定があります。`
                });
            }
        });
    }

    saveNotified() {
        try {
            sessionStorage.setItem('pwa_notified_events', JSON.stringify(Array.from(this.notifiedEvents)));
        } catch(e) {}
    }

    sendNotification(title, options) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    ...options,
                    // Use a generic icon or path if it doesn't exist
                    icon: './icons/icon-192x192.png',
                    badge: './icons/icon-192x192.png',
                    vibrate: [200, 100, 200]
                });
            });
        } else {
            // Fallback to standard Notification API if no SW
            new Notification(title, options);
        }
    }
}

export const Notifications = new NotificationsManager();
