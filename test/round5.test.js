import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { doseEvents, toIcs, encodeReminders, decodeReminders, googleCalendarUrl } from '../lib/reminders.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const TODAY = '2026-10-08';
const RX = 'Rx: 1) Tab Pan 40 1-0-0 before breakfast x 15 days 2) Tab Dolo 650 1-1-1 after food x 5 days. Review after 1 week.';

test('a scam card offers 1930 and the real helpline of the company it pretends to be', () => {
  const card = buildCard({ ...fixture('scam-sms'), rawText: `${fixture('scam-sms').rawText} MSEDCL` }, { lang: 'mr', today: TODAY });
  assert.deepEqual(card.helplines.map((h) => h.number), ['1930', '1912']);
  assert.match(card.speak, /1930/);
  assert.equal(buildCard(fixture('electricity-bill'), { today: TODAY }).helplines, null);
});

test('prescription reminders keep each medicine and its course length', () => {
  const card = buildCard({ ...fixture('prescription'), rawText: RX, medicines: null }, { lang: 'en', today: TODAY });
  assert.deepEqual(card.reminders.map((r) => [r.name, r.days]), [['Pan 40', 15], ['Dolo 650', 5]]);
});

test('single-medicine prescription still gets a named reminder', () => {
  const card = buildCard(fixture('prescription'), { lang: 'mr', today: TODAY });
  assert.equal(card.reminders.length, 1);
  assert.match(card.reminders[0].name, /Metformin/i);
  assert.equal(card.reminders[0].days, 30);
});

test('Jan Aushadhi tip names the generic medicine, never for expired strips', () => {
  const rx = RX.replace('Pan 40', 'Pantocid 40');
  const card = buildCard({ ...fixture('prescription'), rawText: rx, medicines: null }, { lang: 'en', today: TODAY });
  assert.match(card.janAushadhi, /pantoprazole, paracetamol/);
  assert.equal(buildCard(fixture('medicine-expired'), { lang: 'en', today: TODAY }).janAushadhi, null);
});

test('dose events: one per medicine per dose time, before-food doses half an hour early', () => {
  const now = new Date('2026-10-08T06:00:00Z'); // 11:30 IST
  const events = doseEvents([{ name: 'Pan 40', morning: 1, food: 'before', days: 15 }, { name: 'Dolo 650', morning: 1, noon: 1, night: 1, food: 'after', days: 5 }], { lang: 'en', now });
  assert.deepEqual(events.map((e) => [e.name, e.time, e.days]), [
    ['Pan 40', '07:30', 15], ['Dolo 650', '08:00', 5], ['Dolo 650', '14:00', 5], ['Dolo 650', '20:00', 5],
  ]);
  // 8:00 IST already passed at 11:30, so the morning dose starts tomorrow; 14:00 is still today.
  assert.equal(events[1].start.toISOString(), '2026-10-09T02:30:00.000Z');
  assert.equal(events[2].start.toISOString(), '2026-10-08T08:30:00.000Z');
});

test('ics file is valid, folded and carries Devanagari names', () => {
  const now = new Date('2026-10-08T06:00:00Z');
  const ics = toIcs(doseEvents([{ name: 'डोलो 650', morning: 1, noon: 1, night: 1, food: 'after', days: 5 }], { lang: 'mr', now }), now);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /RRULE:FREQ=DAILY;COUNT=5/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.match(ics.replace(/\r\n /g, ''), /डोलो 650: 1 गोळी जेवणानंतर/);
});

test('reminders survive the trip through the link', () => {
  const list = [{ name: 'डोलो 650', morning: 1, noon: 1, night: 1, food: 'after', days: 5 }];
  assert.deepEqual(decodeReminders(encodeReminders(list)), list);
  assert.deepEqual(decodeReminders('not base64 json'), []);
  const url = googleCalendarUrl(doseEvents(list, { lang: 'mr' })[0]);
  assert.match(url, /recur=RRULE%3AFREQ%3DDAILY%3BCOUNT%3D5/);
});
