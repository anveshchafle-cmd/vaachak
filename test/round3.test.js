import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { parseDosePattern } from '../lib/rules.js';
import { MEDICINES, matchMedicine } from '../lib/medicines.js';
import { offlineRead } from '../lib/offline.js';
import { analyzeFrame, assessFrame } from '../lib/viewfinder.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const TODAY = '2026-10-08';

test('dose shorthand becomes a pill schedule, without AI', () => {
  assert.deepEqual(parseDosePattern('Tab Metformin 500  1-0-1  after food x 30 days'), { morning: 1, noon: 0, night: 1, food: 'after' });
  assert.deepEqual(parseDosePattern('Pantocid 40 1 - 0 - 0 before breakfast'), { morning: 1, noon: 0, night: 0, food: 'before' });
  assert.deepEqual(parseDosePattern('Cap. X  0-0-1  post-meal'), { morning: 0, noon: 0, night: 1, food: 'after' });
  assert.equal(parseDosePattern('Next visit 5-11-26'), null, 'dates are not doses');
  assert.equal(parseDosePattern('Due 10-10-2026'), null);
  assert.equal(parseDosePattern('0-0-0'), null);
});

test('prescription without AI pills still gets the picture schedule', () => {
  const ex = fixture('prescription');
  ex.pills = null;
  const card = buildCard(ex, { lang: 'mr', today: TODAY });
  assert.deepEqual(card.pills, { morning: 1, noon: 0, night: 1, food: 'after' });
});

test('offline prescription with a known medicine shows pills', () => {
  const card = offlineRead('Rx Tab. Glycomet 500 mg 1-0-1 after food x 30 days', { lang: 'mr', today: TODAY });
  assert.equal(card.docType, 'medicine');
  assert.deepEqual(card.pills, { morning: 1, noon: 0, night: 1, food: 'after' });
  assert.match(card.speak, /सकाळी 1, दुपारी 0, रात्री 1, जेवणानंतर/);
});

test('speech greets the person by name', () => {
  const card = buildCard(fixture('electricity-bill'), { lang: 'mr', today: TODAY, userName: 'प्रकाश काका' });
  assert.ok(card.speak.startsWith('प्रकाश काका, MSEDCL चे वीज बिल.'));
  const scam = buildCard(fixture('scam-sms'), { lang: 'mr', today: TODAY, userName: '<b>Kaka</b>' });
  assert.ok(scam.speak.startsWith('bKaka/b, सावधान'), 'name is sanitised and still comes first');
});

test('WhatsApp message carries an English line for the family', () => {
  const card = buildCard(fixture('electricity-bill'), { lang: 'mr', today: TODAY });
  assert.equal(card.actions.familySummaryEn, 'MSEDCL electricity bill of ₹840 due on 10 Oct 2026. Please verify.');
  assert.match(card.actions.whatsappText, /🇬🇧 MSEDCL electricity bill of ₹840 due on 10 Oct 2026/);
  const scam = buildCard(fixture('scam-sms'), { lang: 'hi', today: TODAY });
  assert.match(scam.actions.familySummaryEn, /SCAM/);
  const en = buildCard(fixture('electricity-bill'), { lang: 'en', today: TODAY });
  assert.ok(!en.actions.whatsappText.includes('🇬🇧'));
});

test('consensus label: green verified text, or the amber family-check warning', () => {
  const ok = buildCard(fixture('electricity-bill'), { lang: 'mr', today: TODAY, edgeText: 'MSEDCL Due Date: 10/10/2026 Net Amount Payable Rs. 840.00' });
  assert.equal(ok.consensus.label, '✓ दोन वेळा तपासले');
  const bad = buildCard(fixture('electricity-bill'), { lang: 'en', today: TODAY, edgeText: 'MSEDCL Due Date: 10/10/2026 Net Amount Payable Rs. 1,290.00' });
  assert.equal(bad.consensus.label, 'Text unclear. Please verify with a family member.');
});

test('medicine directory has 50 entries, and new ones match', () => {
  assert.ok(MEDICINES.length >= 50, `only ${MEDICINES.length}`);
  assert.equal(matchMedicine('WYSOLONE 10').medicine.generic, 'prednisolone');
  assert.equal(matchMedicine('Sorbitrate 5mg').medicine.generic, 'isosorbide dinitrate');
  assert.equal(matchMedicine('Huminsulin 30/70').medicine.generic, 'insulin');
});

// Synthetic 160x120 camera frames.
function frame(fn) {
  const width = 160;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = fn(x, y);
      const p = (y * width + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { data, width, height };
}

test('viewfinder: dark, blurry and sharp frames', () => {
  const dark = analyzeFrame(frame(() => 25));
  assert.equal(assessFrame(dark), 'dark');
  const blurry = analyzeFrame(frame((x) => 150 + Math.round(20 * Math.sin(x / 30)))); // smooth, no edges
  assert.equal(assessFrame(blurry), 'blurry');
  const sharp = analyzeFrame(frame((x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 230 : 60))); // printed text-like edges
  assert.equal(assessFrame(sharp), 'ok');
});
