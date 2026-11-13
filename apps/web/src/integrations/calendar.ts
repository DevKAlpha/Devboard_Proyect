/**
 * Puts a card's due date in a calendar without any account connected: the
 * Google and Outlook links open their "new event" screen already filled in,
 * and the .ics file works with any calendar app. Due dates are date-only, so
 * the events are all-day.
 */

export interface CalendarEvent {
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  details: string;
}

/** The day after `date` (all-day events end on the next day, exclusive). */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const compact = (date: string) => date.replaceAll('-', '');

/** Google Calendar "create event" screen, prefilled. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(e.date)}/${compact(nextDay(e.date))}`,
    details: e.details,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Outlook on the web (work or school accounts) "new event" screen, prefilled. */
export function outlookCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    body: e.details,
    startdt: e.date,
    enddt: nextDay(e.date),
    allday: 'true',
  });
  return `https://outlook.office.com/calendar/deeplink/compose?${q}`;
}

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A one-event iCalendar file (Apple Calendar, Outlook desktop, Thunderbird...). */
export function icsFile(e: CalendarEvent, uid: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Devbord//ES',
    'BEGIN:VEVENT',
    `UID:${uid}@devbord`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(e.date)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
