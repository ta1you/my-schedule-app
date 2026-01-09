import { Storage } from './storage.js';
import { UI } from './ui.js';
import { generateId, getTodayString } from './utils.js';

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    setupEventListeners();
});

function setupEventListeners() {
    const modal = document.getElementById('schedule-modal');
    const form = document.getElementById('schedule-form');
    const fab = document.getElementById('fab-add');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('btn-cancel');
    const deleteBtn = document.getElementById('btn-delete');


    // Scroll to Today
    document.getElementById('btn-today').addEventListener('click', () => {
        // Simple reload for now to reset view or scroll to top
        // Ideally we scroll to the "Today" header
        UI.render(); // Re-render to ensure fresh state
        const todayHeaders = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.includes('今日'));
        if (todayHeaders.length > 0) {
            todayHeaders[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // If no today, maybe scroll top
            document.getElementById('main-content').scrollTop = 0;
        }
    });

    // Open Modal (Add)
    fab.addEventListener('click', () => {
        form.reset();
        document.getElementById('date').value = getTodayString();
        form.id.value = '';
        document.getElementById('modal-title').textContent = '予定を追加';
        deleteBtn.hidden = true;
        modal.showModal();
    });

    // Close Modal
    const closeModal = () => modal.close();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Save
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const schedule = {
            id: formData.get('id') || generateId(),
            title: formData.get('title'),
            date: formData.get('date'),
            startTime: formData.get('start-time'),
            endTime: formData.get('end-time'),
            description: formData.get('description'),
            createdAt: new Date().toISOString()
        };

        Storage.save(schedule);
        UI.render();
        closeModal();
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        const id = form.id.value;
        if (id && confirm('この予定を削除しますか？')) {
            Storage.delete(id);
            UI.render();
            closeModal();
        }
    });

    // Global expose for UI onclick
    window.openEditModal = (id) => {
        const schedule = Storage.getById(id);
        if (!schedule) return;

        form.id.value = schedule.id;
        document.getElementById('title').value = schedule.title;
        document.getElementById('date').value = schedule.date;
        document.getElementById('start-time').value = schedule.startTime;
        document.getElementById('end-time').value = schedule.endTime;
        document.getElementById('description').value = schedule.description;

        document.getElementById('modal-title').textContent = '予定を編集';
        deleteBtn.hidden = false;
        modal.showModal();
    };
}
