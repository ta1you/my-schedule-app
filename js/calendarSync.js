import { Storage } from './storage.js';

export const CalendarSync = {
    generateICS(alertMinutes = 10) {
        const schedules = Storage.getAll();
        if (!schedules || schedules.length === 0) {
            alert('同期する予定がありません。');
            return null;
        }

        let icsContent = "BEGIN:VCALENDAR\r\n";
        icsContent += "VERSION:2.0\r\n";
        icsContent += "PRODID:-//My Schedule App//JP\r\n";
        icsContent += "CALSCALE:GREGORIAN\r\n";

        schedules.forEach(event => {
            const startDate = this.formatDate(event.date, event.startTime);
            const endDate = this.formatDate(event.date, event.endTime, true); // default to +1 hr if no end
            const dtStamp = this.getDTStamp();
            const uid = event.id + "@myschedule.local";

            icsContent += "BEGIN:VEVENT\r\n";
            icsContent += `DTSTAMP:${dtStamp}\r\n`;
            icsContent += `UID:${uid}\r\n`;
            icsContent += `DTSTART;TZID=Asia/Tokyo:${startDate}\r\n`;
            if (endDate) {
                icsContent += `DTEND;TZID=Asia/Tokyo:${endDate}\r\n`;
            }
            icsContent += `SUMMARY:${this.escapeICS(event.title || '予定')}\r\n`;
            if (event.description) {
                icsContent += `DESCRIPTION:${this.escapeICS(event.description)}\r\n`;
            }
            
            // Add a default alarm based on configured setting
            icsContent += "BEGIN:VALARM\r\n";
            icsContent += "ACTION:DISPLAY\r\n";
            icsContent += "DESCRIPTION:Reminder\r\n";
            if (alertMinutes === 0) {
                icsContent += "TRIGGER:PT0M\r\n"; // exactly at start time
            } else {
                icsContent += `TRIGGER:-PT${alertMinutes}M\r\n`;
            }
            icsContent += "END:VALARM\r\n";

            icsContent += "END:VEVENT\r\n";
        });

        icsContent += "END:VCALENDAR\r\n";
        return icsContent;
    },

    formatDate(dateStr, timeStr, isEnd = false) {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        let hourStr = '00';
        let minStr = '00';

        if (timeStr) {
            const [h, m] = timeStr.split(':');
            hourStr = h.padStart(2, '0');
            minStr = m.padStart(2, '0');
        } else if (isEnd) {
            hourStr = '23';
            minStr = '59';
        }

        return `${year}${month}${day}T${hourStr}${minStr}00`;
    },

    getDTStamp() {
        const now = new Date();
        return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    },

    escapeICS(str) {
        return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    },

    downloadICS(alertMinutes = 10) {
        const icsData = this.generateICS(alertMinutes);
        if (!icsData) return;

        const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule_${new Date().toISOString().split('T')[0]}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
