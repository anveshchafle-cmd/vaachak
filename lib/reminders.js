// Medicine reminders for the whole course: every medicine x every dose time, repeated daily.
// Pure functions shared by the browser (Google Calendar links) and /api/reminders (one .ics file).
import { messages, normalizeLang } from './i18n.js';

// Dose times in India (IST, no daylight saving). Before-food doses are half an hour earlier.
const SLOTS = { morning: [8, 0], noon: [14, 0], night: [20, 0] };
export const DEFAULT_DAYS = 30;
const IST_OFFSET_MIN = 330;

function clean(r) {
  const n = (v) => Math.min(10, Math.max(0, Math.round(Number(v) || 0)));
  const days = Math.round(Number(r?.days));
  return {
    name: String(r?.name || '').replace(/[<>{}\r\n]/g, ' ').trim().slice(0, 40),
    morning: n(r?.morning),
    noon: n(r?.noon),
    night: n(r?.night),
    food: ['before', 'after'].includes(r?.food) ? r.food : 'any',
    days: days >= 1 && days <= 365 ? days : null,
  };
}

// One event per medicine per dose time. `now` decides the first day: a dose whose time has
// already passed today starts tomorrow, so the course still gets its full number of days.
export function doseEvents(reminders, { lang = 'mr', now = new Date() } = {}) {
  lang = normalizeLang(lang);
  const t = messages(lang);
  const nowIst = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const events = [];
  for (const r of (Array.isArray(reminders) ? reminders : []).slice(0, 8).map(clean)) {
    for (const slot of ['morning', 'noon', 'night']) {
      const count = r[slot];
      if (!count) continue;
      let [h, m] = SLOTS[slot];
      if (r.food === 'before') [h, m] = m >= 30 ? [h, m - 30] : [h - 1, m + 30];
      const start = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), h, m) - IST_OFFSET_MIN * 60_000);
      if (start <= now) start.setUTCDate(start.getUTCDate() + 1);
      const days = r.days || DEFAULT_DAYS;
      events.push({
        slot,
        name: r.name,
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        start,
        days,
        title: `💊 ${t.doseTitle(r.name, count, r.food)}`,
        details: t.doseDetails(days),
      });
    }
  }
  return events;
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// iCalendar lines must be folded at 75 bytes without splitting a UTF-8 character.
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function toIcs(events, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vaachak//Medicine reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  events.forEach((e, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:vaachak-${stamp(now)}-${i}@vaachak`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      'DURATION:PT15M',
      `RRULE:FREQ=DAILY;COUNT=${e.days}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.details)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0M',
      `DESCRIPTION:${escapeText(e.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// Google Calendar "add event" link for one dose time (Android has no one-tap .ics import).
export function googleCalendarUrl(e) {
  const end = new Date(e.start.getTime() + 15 * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(end)}`,
    details: e.details,
    recur: `RRULE:FREQ=DAILY;COUNT=${e.days}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// The reminders travel to /api/reminders inside the link itself, so nothing is stored on a server.
export function encodeReminders(reminders) {
  const json = JSON.stringify((reminders || []).map(clean));
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(json, 'utf8').toString('base64')
    : btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeReminders(s) {
  try {
    const b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    const list = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return Array.isArray(list) ? list.map(clean) : [];
  } catch {
    return [];
  }
}
