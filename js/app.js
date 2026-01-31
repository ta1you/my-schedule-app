import { Storage } from './storage.js';
import { UI } from './ui.js';
import { generateId, getTodayString } from './utils.js';
import { Calendar } from './calendar.js';

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
    Calendar.init();
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
        // Switch to list view if in calendar view (optional, but makes sense)
        if (document.getElementById('schedule-list').hidden) {
            document.getElementById('btn-view-list').click();
        }

        UI.render(); // Re-render to ensure fresh state
        const todayHeaders = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.includes('今日'));
        if (todayHeaders.length > 0) {
            todayHeaders[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            document.getElementById('main-content').scrollTop = 0;
        }
    });

    // View Switching
    const btnList = document.getElementById('btn-view-list');
    const btnCalendar = document.getElementById('btn-view-calendar');
    const listView = document.getElementById('schedule-list');
    const calendarView = document.getElementById('calendar-view');

    // Helper to set view state; uses both attribute and fallback class for robustness
    function setView(showList) {
        const categoryTabs = document.querySelector('.category-tabs');
        if (showList) {
            listView.hidden = false;
            calendarView.hidden = true;
            listView.classList.remove('is-hidden');
            calendarView.classList.add('is-hidden');
            // Inline style fallback
            listView.style.display = '';
            calendarView.style.display = 'none';
            btnList.classList.add('active');
            btnCalendar.classList.remove('active');
            fab.hidden = false;
            fab.classList.remove('is-hidden');
            // Show category tabs
            if (categoryTabs) {
                categoryTabs.hidden = false;
                categoryTabs.style.display = '';
            }
        } else {
            listView.hidden = true;
            calendarView.hidden = false;
            listView.classList.add('is-hidden');
            calendarView.classList.remove('is-hidden');
            // Inline style fallback
            listView.style.display = 'none';
            calendarView.style.display = '';
            btnList.classList.remove('active');
            btnCalendar.classList.add('active');
            fab.hidden = true;
            fab.classList.add('is-hidden');
            // Hide category tabs
            if (categoryTabs) {
                categoryTabs.hidden = true;
                categoryTabs.style.display = 'none';
            }
        }
    }

    // initial state: show list
    setView(true);

    btnList.addEventListener('click', () => setView(true));
    btnCalendar.addEventListener('click', () => setView(false));

    // Modal category select
    let selectedCategory = 'その他';
    const modalCategorySelect = document.getElementById('modal-category-select');
    const titleInput = document.getElementById('title');
    
    modalCategorySelect.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
    });

    // Click title input to open category dropdown
    titleInput.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        modalCategorySelect.focus();
        // Use showPicker() if available, otherwise click
        if (modalCategorySelect.showPicker) {
            modalCategorySelect.showPicker();
        } else {
            modalCategorySelect.click();
        }
    });

    // Open Modal (Add)
    fab.addEventListener('click', () => {
        form.reset();
        document.getElementById('date').value = getTodayString();
        form.id.value = '';
        document.getElementById('modal-title').textContent = '予定を追加';
        deleteBtn.hidden = true;
        // Reset category select to default
        selectedCategory = 'その他';
        modalCategorySelect.value = 'その他';
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
            category: selectedCategory,
            createdAt: new Date().toISOString()
        };

        Storage.save(schedule);
        UI.render();
        Calendar.refresh();
        closeModal();
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        const id = form.id.value;
        if (id && confirm('この予定を削除しますか？')) {
            Storage.delete(id);
            UI.render();
            Calendar.refresh();
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
        
        // Set category select
        selectedCategory = schedule.category || 'その他';
        modalCategorySelect.value = selectedCategory;

        document.getElementById('modal-title').textContent = '予定を編集';
        deleteBtn.hidden = false;
        modal.showModal();
    };
}
