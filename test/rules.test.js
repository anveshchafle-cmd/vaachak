import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExpiry, amountAppearsInText, dateAppearsInText, daysBetween, addDays,
  todayIST, isIsoDate, makeBillerKey, checkBillSpike,
} from '../lib/rules.js';

test('parseExpiry reads common medicine-strip formats', () => {
  assert.equal(parseExpiry('MFG. 09/2024\nEXP. 08/2026'), '2026-08-31');
  assert.equal(parseExpiry('Exp Date: AUG.2026'), '2026-08-31');
  assert.equal(parseExpiry('USE BEFORE 07/27'), '2027-07-31');
  assert.equal(parseExpiry('EXP 31/08/2026'), '2026-08-31');
  assert.equal(parseExpiry('Expiry: FEB 2028'), '2028-02-29');
  assert.equal(parseExpiry('Exp. ०८/२०२६'), '2026-08-31');
  assert.equal(parseExpiry('MFG 09/2024 only'), null);
  assert.equal(parseExpiry(''), null);
});

test('amountAppearsInText handles Indian grouping, decimals and Devanagari digits', () => {
  assert.equal(amountAppearsInText(840, 'Net Amount Payable Rs. 840.00'), true);
  assert.equal(amountAppearsInText(123456, 'Total ₹1,23,456'), true);
  assert.equal(amountAppearsInText(840, 'देय रक्कम ₹८४०'), true);
  assert.equal(amountAppearsInText(840, 'Rs 480'), false);
  assert.equal(amountAppearsInText(NaN, 'Rs 480'), false);
});

test('dateAppearsInText matches the formats bills use', () => {
  assert.equal(dateAppearsInText('2026-10-10', 'Due Date: 10/10/2026'), true);
  assert.equal(dateAppearsInText('2026-10-05', 'Due 05-10-26'), true);
  assert.equal(dateAppearsInText('2026-10-15', 'Pay by 15 Oct 2026'), true);
  assert.equal(dateAppearsInText('2026-10-15', 'Pay by October 15, 2026'), true);
  assert.equal(dateAppearsInText('2026-10-15', 'Pay by 16/10/2026'), false);
  assert.equal(dateAppearsInText('2026-10-15', 'Pay by 15/10/2025'), false);
});

test('date helpers', () => {
  assert.equal(daysBetween('2026-10-07', '2026-10-10'), 3);
  assert.equal(daysBetween('2026-10-10', '2026-10-07'), -3);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
  // 20:00 UTC is already the next day in India.
  assert.equal(todayIST(new Date('2026-10-07T20:00:00Z')), '2026-10-08');
});

test('bill spike needs at least double the previous amount', () => {
  const key = makeBillerKey('MSEDCL', '0001 2345 6789');
  assert.equal(key, 'msedcl:000123456789');
  assert.deepEqual(checkBillSpike(key, 900, { [key]: 300 }), { previous: 300, current: 900, ratio: 3 });
  assert.equal(checkBillSpike(key, 500, { [key]: 300 }), null);
  assert.equal(checkBillSpike(key, 900, {}), null);
  assert.equal(makeBillerKey(null, null), null);
});
