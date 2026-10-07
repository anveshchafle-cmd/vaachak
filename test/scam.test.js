import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectScam } from '../lib/scam.js';

const codes = (r) => r.reasons.map((x) => x.code);

test('classic fake electricity-disconnection SMS is flagged', () => {
  const r = detectScam(
    'Dear Consumer, your electricity power will be disconnected tonight at 9.30 pm because your previous month bill was not updated. Please immediately contact our electricity officer 7894561230. Thank you',
    'en',
  );
  assert.equal(r.isSuspect, true);
  assert.ok(codes(r).includes('THREAT_URGENCY'));
  assert.ok(codes(r).includes('PERSONAL_NUMBER'));
  assert.ok(r.reasons.every((x) => x.text));
});

test('Marathi fake SMS is flagged, with Marathi reasons', () => {
  const r = detectScam('प्रिय ग्राहक, तुमचे वीज कनेक्शन आज रात्री 9.30 वाजता बंद होईल. त्वरित संपर्क करा ७८९४५६१२३०', 'mr');
  assert.equal(r.isSuspect, true);
  assert.match(r.reasons[0].text, /[ऀ-ॿ]/);
});

test('a genuine MSEDCL bill is not flagged', () => {
  const r = detectScam(
    'MSEDCL Consumer No: 000123456789\nDue Date: 10/10/2026\nNet Amount Payable Rs. 840.00\nRegistered Mobile No: 9876543210\nPay online at www.mahadiscom.in\nToll Free: 1912 / 18002333435\nSupply is liable to be disconnected if the bill is not paid within 15 days of the due date.',
  );
  assert.equal(r.isSuspect, false, JSON.stringify(r));
});

test('"never share your OTP" advice is not mistaken for an OTP request', () => {
  const r = detectScam('SBI: Never share your OTP, PIN or CVV with anyone. Visit onlinesbi.sbi');
  assert.equal(r.isSuspect, false, JSON.stringify(r));
});

test('remote-access apps alone are enough to flag', () => {
  const r = detectScam('Your KYC is pending. Download AnyDesk and share the code with our team.');
  assert.equal(r.isSuspect, true);
  assert.equal(r.reasons[0].code, 'REMOTE_APP');
});

test('look-alike links and shorteners count against the message', () => {
  assert.equal(detectScam('Bill pending, pay now at http://mseb-bill-update.xyz immediately or power will be cut today').isSuspect, true);
  assert.equal(detectScam('Pay at bit.ly/abc123').score, 2);
  assert.equal(detectScam('Pay at https://www.mahadiscom.in/consumer').score, 0);
});

test('personal UPI handle on a phone number + prize bait is flagged', () => {
  const r = detectScam('Congratulations you won a lottery prize! Pay Rs 99 fee to 9876543210@ybl');
  assert.equal(r.isSuspect, true);
  assert.ok(codes(r).includes('PERSONAL_UPI'));
  assert.ok(codes(r).includes('PRIZE'));
});
