import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forSpeech } from '../lib/speech-text.js';
import { inLanguage } from '../lib/prompts.js';
import { buildCard } from '../lib/card.js';
import fs from 'node:fs';

test('rupee amounts are spoken as words in the card language', () => {
  assert.equal(forSpeech('रक्कम: ₹1,740.00.', 'mr'), 'रक्कम: 1,740 रुपये.');
  assert.equal(forSpeech('यह बिल ₹ 500 का है.', 'hi'), 'यह बिल 500 रुपये का है.');
  assert.equal(forSpeech('Pay Rs. 1,200/- today.', 'en'), 'Pay 1,200 rupees today.');
});

test('emojis, ticks and links are not read out', () => {
  assert.equal(forSpeech('📄 MSEDCL चे बिल ✓ दोन वेळा तपासले', 'mr'), 'MSEDCL चे बिल दोन वेळा तपासले');
  assert.equal(forSpeech('Do not open http://bit.ly/x now.', 'en'), 'Do not open now.');
  // The joiner inside Marathi "अ‍ॅप" stays.
  assert.equal(forSpeech('अ‍ॅप', 'mr'), 'अ‍ॅप');
});

test('an English card written in Devanagari is caught as the wrong language', () => {
  assert.equal(inLanguage(['MSEDCL चे बिल', 'बिल भरा'], 'en'), false);
  assert.equal(inLanguage(['MSEDCL electricity bill', 'Pay the bill'], 'en'), true);
});

test('a Marathi or Hindi card written only in English is caught', () => {
  assert.equal(inLanguage(['Electricity bill', 'Pay the bill by Friday'], 'mr'), false);
  assert.equal(inLanguage(['MSEDCL चे बिल', 'OTP सांगू नका'], 'mr'), true);
  assert.equal(inLanguage(['MSEDCL का बिल', 'बिल भरिए'], 'hi'), true);
});

test('a misread year (2020 for 2026) asks to check the date instead of saying it is overdue', () => {
  const ex = JSON.parse(fs.readFileSync(new URL('./fixtures/electricity-bill.json', import.meta.url)));
  ex.deadlineIso = '2020-10-10';
  ex.fields.deadline.text = '10 ऑक्टोबर 2020';
  const card = buildCard(ex, { lang: 'mr', today: '2026-10-09' });
  assert.ok(!card.flags.includes('URGENT'));
  assert.ok(!/निघून गेली/.test(card.speak));
  assert.match(card.speak, /शेवटची तारीख: 10 ऑक्टोबर 2020. हे एकदा कागदावर तपासून घ्या/);
});
