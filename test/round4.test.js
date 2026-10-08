import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { parseAllDoses } from '../lib/rules.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const TODAY = '2026-10-08';
const TWO_MEDS = 'Rx: 1) Tab Metformin 500mg 1-0-1 after food x 30 days 2) Tab Amlodipine 5mg 0-0-1 x 30 days. Review after 1 month.';

test('every medicine on a prescription gets its own schedule', () => {
  assert.deepEqual(parseAllDoses(TWO_MEDS), [
    { name: 'Metformin 500mg', morning: 1, noon: 0, night: 1, food: 'after' },
    { name: 'Amlodipine 5mg', morning: 0, noon: 0, night: 1, food: 'any' },
  ]);
});

test('two medicines are never merged into one pill card, even when the AI does', () => {
  const ex = { ...fixture('prescription'), rawText: TWO_MEDS, pills: { morning: 1, noon: 0, night: 1, food: 'after' }, medicines: null };
  const card = buildCard(ex, { lang: 'mr', today: TODAY });
  assert.equal(card.pills, null);
  assert.equal(card.medicines.length, 2);
  assert.match(card.speak, /Amlodipine 5mg: सकाळी 0, दुपारी 0, रात्री 1/);
});

test('AI medicines list is used when it has two or more entries', () => {
  const ex = {
    ...fixture('prescription'),
    medicines: [
      { name: 'Pan 40', morning: 1, noon: 0, night: 0, food: 'before' },
      { name: 'Dolo 650', morning: 1, noon: 1, night: 1, food: 'after' },
    ],
  };
  const card = buildCard(ex, { lang: 'en', today: TODAY });
  assert.deepEqual(card.medicines.map((m) => m.name), ['Pan 40', 'Dolo 650']);
});

test('a scam card does not repeat the scammer\'s deadline or amount', () => {
  const card = buildCard(fixture('scam-sms'), { lang: 'mr', today: TODAY });
  assert.ok(card.flags.includes('SCAM'));
  assert.equal(card.fields.deadline.text, '');
  assert.equal(card.fields.amount.text, '');
  assert.equal(card.actions.calendarUrl, null);
});

test('bill-spike key stays the same whatever name the AI gives the biller', () => {
  const base = fixture('electricity-bill');
  const a = buildCard({ ...base, issuer: 'MSEDCL' }, { today: TODAY });
  const b = buildCard({ ...base, issuer: 'Maharashtra State Electricity Distribution Co. Ltd.' }, { today: TODAY });
  assert.ok(a.billerKey);
  assert.equal(a.billerKey, b.billerKey);
});
