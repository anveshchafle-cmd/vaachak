import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const TODAY = '2026-10-08';

test('electricity bill: urgent, verified amount, reminders and speech', () => {
  const card = buildCard(fixture('electricity-bill'), { lang: 'mr', today: TODAY, familyPhone: '98765 43210' });
  assert.deepEqual(card.flags, ['URGENT']);
  assert.equal(card.dates.daysLeft, 2);
  assert.equal(card.fields.amount.value, 840);
  assert.equal(card.fields.amount.verified, true);
  assert.equal(card.fields.deadline.verified, true);
  assert.equal(card.fields.warning.source, 'ai');
  assert.deepEqual(card.fields.what.box, [20, 40, 70, 960]);
  assert.equal(card.billerKey, 'msedcl:000123456789');
  assert.match(card.actions.whatsappUrl, /^https:\/\/wa\.me\/919876543210\?text=/);
  assert.match(card.actions.calendarUrl, /dates=20261009%2F20261010/);
  assert.match(card.speak, /₹840/);
  assert.match(card.speak, /आठशे चाळीस/);
  assert.match(card.speak, /फक्त 2 दिवस/);
});

test('bill spike against saved history', () => {
  const card = buildCard(fixture('electricity-bill'), { today: TODAY, history: { 'msedcl:000123456789': 300 } });
  assert.ok(card.flags.includes('BILL_SPIKE'));
  assert.deepEqual(card.spike, { previous: 300, current: 840, ratio: 2.8 });
  assert.equal(card.fields.warning.source, 'rule');
  assert.match(card.fields.warning.text, /2.8/);
});

test('amount not printed on the document lowers confidence', () => {
  const ex = fixture('electricity-bill');
  ex.amountValue = 8400;
  const card = buildCard(ex, { today: TODAY });
  assert.equal(card.fields.amount.verified, false);
  assert.ok(card.fields.amount.confidence <= 0.5);
  assert.ok(card.flags.includes('LOW_CONFIDENCE'));
  assert.match(card.speak, /नीट वाचता येत नाही/);
});

test('expired medicine: rule overrides AI, red flag, no pill schedule', () => {
  const card = buildCard(fixture('medicine-expired'), { lang: 'mr', today: TODAY });
  assert.ok(card.flags.includes('EXPIRED'));
  assert.equal(card.dates.expiry, '2026-08-31');
  assert.equal(card.fields.warning.source, 'rule');
  assert.equal(card.fields.action.source, 'rule');
  assert.equal(card.pills, null);
  assert.match(card.speak, /मुदत संपली/);
});

test('scam SMS: SCAM flag, safe action, no calendar link, warning spoken first', () => {
  const card = buildCard(fixture('scam-sms'), { lang: 'mr', today: TODAY });
  assert.equal(card.flags[0], 'SCAM');
  assert.equal(card.scam.isSuspect, true);
  assert.equal(card.fields.action.source, 'rule');
  assert.equal(card.actions.calendarUrl, null);
  assert.ok(card.speak.startsWith('सावधान'));
});

test('prescription: pill schedule and next-visit reminder', () => {
  const card = buildCard(fixture('prescription'), { lang: 'mr', today: TODAY });
  assert.deepEqual(card.pills, { morning: 1, noon: 0, night: 1, food: 'after' });
  assert.deepEqual(card.flags, []);
  assert.ok(card.actions.calendarUrl);
  assert.match(card.speak, /सकाळी 1, दुपारी 0, रात्री 1, जेवणानंतर/);
});

test('PDFs never get highlight boxes', () => {
  const card = buildCard(fixture('electricity-bill'), { today: TODAY, isPdf: true });
  assert.ok(Object.values(card.fields).every((f) => f.box === null));
});

test('unreadable photo is flagged and speaks the safe fallback', () => {
  const card = buildCard({ readable: false, rawText: '', fields: {} }, { lang: 'hi', today: TODAY });
  assert.ok(card.flags.includes('LOW_CONFIDENCE'));
  assert.equal(card.docType, 'other');
  assert.match(card.speak, /किसी से पूछ/);
});

test('garbage boxes and confidences from the model are cleaned', () => {
  const ex = fixture('electricity-bill');
  ex.fields.what.box = [500, 0, 100, 900];
  ex.fields.action.box = [0, 0, 2000, 10];
  ex.fields.amount.confidence = 7;
  const card = buildCard(ex, { today: TODAY });
  assert.equal(card.fields.what.box, null);
  assert.equal(card.fields.action.box, null);
  assert.equal(card.fields.amount.confidence, 1);
});
