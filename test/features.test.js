import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { levenshtein, fixOcrDigits } from '../lib/text.js';
import { checkConsensus, edgeAgreesOnAmount } from '../lib/consensus.js';
import { findBiller, upiIdOnDocument, verifiedConsumerNumber } from '../lib/billers.js';
import { matchMedicine } from '../lib/medicines.js';
import { offlineRead, parseBillText } from '../lib/offline.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const TODAY = '2026-10-08';

// Tesseract-style output of the test bill, with typical OCR mistakes.
const BILL_OCR = `MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD. (MSEDCL)
Consumer No: 000123456789
Due Date: 1O/10/2026
Net Amount Payable Rs. 84O.00
Pay online at www.mahadiscom.in`;

test('levenshtein and OCR digit fixing', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('840', '840'), 0);
  assert.equal(fixOcrDigits('Rs. 84O.00 on 1O/l0/2026'), 'Rs. 840.00 on 10/10/2026');
  assert.equal(fixOcrDigits('DOLO 650'), 'DOLO 650');
});

test('dual-engine consensus: agreement earns the VERIFIED_BY_EDGE badge', () => {
  const card = buildCard(fixture('electricity-bill'), { today: TODAY, edgeText: BILL_OCR });
  assert.equal(card.consensus.badge, 'VERIFIED_BY_EDGE');
  assert.equal(card.fields.amount.edge, 'agree');
  assert.equal(card.fields.deadline.edge, 'agree');
  assert.ok(!card.flags.includes('LOW_CONFIDENCE'));
});

test('dual-engine consensus: one wrong OCR digit is tolerated, a different amount is not', () => {
  assert.equal(edgeAgreesOnAmount(840, 'Amount Rs. 846.00 payable'), true);
  assert.equal(edgeAgreesOnAmount(840, 'Amount Rs. 1,840.00 payable'), false);
  const ex = fixture('electricity-bill');
  const card = buildCard(ex, { today: TODAY, edgeText: BILL_OCR.replace('84O.00', '1,290.00') });
  assert.equal(card.fields.amount.edge, 'disagree');
  assert.equal(card.consensus.badge, null);
  assert.ok(card.fields.amount.confidence < 0.6, 'the amount is marked unclear');
  assert.ok(!card.flags.includes('LOW_CONFIDENCE'), 'the rest of the card is still read');
  assert.match(card.speak, /हे एकदा कागदावर तपासून घ्या/);
  assert.equal(card.payment, null, 'never offer payment when the engines disagree on the amount');
});

test('dual-engine consensus: junk OCR is ignored, not punished', () => {
  const c = checkConsensus({ amountValue: 840, deadlineIso: '2026-10-10' }, '~~ ,. ||');
  assert.equal(c.available, false);
  const card = buildCard(fixture('electricity-bill'), { today: TODAY, edgeText: '###' });
  assert.ok(!card.flags.includes('LOW_CONFIDENCE'));
});

test('zero-type payment: official site + copied consumer number when the bill shows no UPI ID', () => {
  const card = buildCard(fixture('electricity-bill'), { today: TODAY });
  assert.equal(card.payment.method, 'official_site');
  assert.equal(card.payment.billerId, 'msedcl');
  assert.equal(card.payment.consumerNumber, '000123456789');
  assert.equal(card.payment.upiUrl, null);
  assert.match(card.payment.officialUrl, /^https:\/\/wss\.mahadiscom\.in\//);
  assert.match(card.payment.confirmText, /₹840/);
});

test('zero-type payment: UPI deep link only to a UPI ID printed on the bill', () => {
  const ex = fixture('electricity-bill');
  ex.rawText += '\nPay by UPI: mahadiscom.bill@sbi';
  const card = buildCard(ex, { today: TODAY });
  assert.equal(card.payment.method, 'upi');
  assert.equal(card.payment.upiSource, 'document');
  assert.equal(
    card.payment.upiUrl,
    'upi://pay?pa=mahadiscom.bill@sbi&pn=MSEDCL%20(Mahavitaran)&am=840.00&cu=INR&tn=Bill%20000123456789',
  );
});

test('zero-type payment: never for scams, medicines or made-up consumer numbers', () => {
  assert.equal(buildCard(fixture('scam-sms'), { today: TODAY }).payment, null);
  assert.equal(buildCard(fixture('medicine-expired'), { today: TODAY }).payment, null);
  assert.equal(verifiedConsumerNumber('999999999', 'Consumer No: 000123456789'), null);
  assert.equal(upiIdOnDocument('mail support@mahadiscom.in or call'), null, 'emails are not UPI IDs');
  assert.equal(upiIdOnDocument('pay 9876543210@ybl now'), null, 'personal phone handles are refused');
  assert.equal(findBiller(null, 'BEST BEFORE 08/2026'), null, '"best before" on a strip is not the BEST utility');
});

test('haptic alert patterns follow severity', () => {
  assert.equal(buildCard(fixture('scam-sms'), { today: TODAY }).alert.level, 'danger');
  assert.deepEqual(buildCard(fixture('medicine-expired'), { today: TODAY }).alert.vibrate, [400, 200, 400, 200, 800]);
  assert.equal(buildCard(fixture('electricity-bill'), { today: TODAY }).alert.level, 'warning');
  assert.equal(buildCard(fixture('prescription'), { today: TODAY }).alert.level, 'ok');
});

test('medicine directory tolerates OCR spelling mistakes', () => {
  assert.equal(matchMedicine('CROCIN Advance 500mg').medicine.generic, 'paracetamol');
  assert.equal(matchMedicine('D0LO 650 tablets').medicine.generic, 'paracetamol');
  assert.equal(matchMedicine('Pantocid 40').medicine.generic, 'pantoprazole');
  assert.equal(matchMedicine('Tab. Metfornin 500').medicine.generic, 'metformin');
  assert.equal(matchMedicine('Electricity bill consumer number'), null);
});

test('offline mode: expired Crocin strip gives a red card with no network', () => {
  const card = offlineRead('CROCIN ADVANCE\nParacetamol Tablets IP 500 mg\nMFG. 09/2024\nEXP. O8/2026\nM.R.P. Rs 30', { lang: 'mr', today: TODAY });
  assert.equal(card.mode, 'offline');
  assert.equal(card.docType, 'medicine');
  assert.deepEqual(card.flags, ['EXPIRED']);
  assert.equal(card.alert.level, 'danger');
  assert.match(card.speak, /Crocin/);
  assert.match(card.speak, /मुदत संपली/);
  assert.equal(card.offline.medicine.generic, 'paracetamol');
});

test('offline mode: bill, scam SMS and unreadable text', () => {
  const bill = offlineRead(BILL_OCR, { lang: 'mr', today: TODAY });
  assert.equal(bill.docType, 'electricity_bill');
  assert.equal(bill.fields.amount.value, 840);
  assert.equal(bill.dates.deadline, '2026-10-10');
  assert.ok(bill.flags.includes('URGENT'));
  assert.match(bill.fields.deadline.text, /10 ऑक्टोबर 2026/);
  assert.equal(bill.payment.consumerNumber, '000123456789');

  const scam = offlineRead('Dear Consumer your electricity will be disconnected tonight 9.30 pm. Contact officer 7894561230', { today: TODAY });
  assert.equal(scam.flags[0], 'SCAM');

  const junk = offlineRead('|| ~ ..', { lang: 'mr', today: TODAY });
  assert.ok(junk.flags.includes('LOW_CONFIDENCE'));
  assert.match(junk.speak, /साफ दिसत नाही/);
});

test('offline bill parser', () => {
  assert.deepEqual(parseBillText('Amount Due: Rs. 1,240.50  Last Date 5-11-26  Account No 1234 5678'), {
    amountValue: 1240.5,
    deadlineIso: '2026-11-05',
    accountId: '12345678',
  });
});
