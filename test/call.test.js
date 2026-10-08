import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectScam } from '../lib/scam.js';
import { offlineRead } from '../lib/offline.js';
import { buildCard } from '../lib/card.js';

const today = '2026-10-08';

test('call check: digital-arrest, safe-account, OTP and lottery-fee calls are fraud in all three languages', () => {
  const calls = [
    ['Caller said he is from CBI, a drugs parcel in my name, digital arrest, do not tell anyone', 'en', 'DIGITAL_ARREST'],
    ['पोलीस म्हणाले माझ्या नावाने ड्रग्सचे पार्सल आले, अटक करणार, कोणाला सांगू नका', 'mr', 'DIGITAL_ARREST'],
    ['पुलिस ने कहा आपके नाम से पार्सल में ड्रग्स मिले हैं, गिरफ्तार करेंगे, किसी को मत बताना', 'hi', 'DIGITAL_ARREST'],
    ['He said move all my money to a safe account for RBI verification', 'en', 'SAFE_ACCOUNT'],
    ['बँकेतून फोन आला, KYC अपडेटसाठी OTP सांगा म्हणाले', 'mr', 'OTP_REQUEST'],
    ['KBC लॉटरी लागली आहे, आधी 5000 रुपये फी भरा', 'mr', 'PRIZE'],
    ['Customer care asked me to install AnyDesk for my refund', 'en', 'REMOTE_APP'],
  ];
  for (const [text, lang, code] of calls) {
    const r = detectScam(text, lang);
    assert.ok(r.isSuspect, `should flag: ${text}`);
    assert.ok(r.reasons.some((x) => x.code === code), `${code} in ${text}`);
  }
});

test('call check: ordinary calls are not flagged', () => {
  for (const text of [
    'My son called to say he will come home late today',
    'Doctor clinic called to confirm my appointment on Friday',
    'पोलीस स्टेशनमधून फोन आला, पासपोर्ट पडताळणीसाठी कागदपत्रे घेऊन या',
    'Electricity office said a meter reader will visit tomorrow',
  ]) assert.equal(detectScam(text, 'en').isSuspect, false, text);
});

test('call check works offline: scam call gets call wording, 1930 and a family alert', () => {
  const card = offlineRead('पोलीस म्हणाले माझ्या नावाने ड्रग्सचे पार्सल आले, डिजिटल अरेस्ट करणार, कोणाला सांगू नका', { lang: 'mr', today, kind: 'call', userName: 'प्रकाश काका' });
  assert.equal(card.docType, 'phone_call');
  assert.ok(card.flags.includes('SCAM'));
  assert.match(card.fields.warning.text, /फोन कॉल/);
  assert.equal(card.helplines[0].number, '1930');
  assert.equal(card.guardian.reason, 'SCAM');
  assert.match(card.guardian.text, /प्रकाश काका/);
  assert.match(card.guardian.text, /FRAUD/);
  assert.match(card.speak, /हिरवे बटण/);
});

test('a harmless call still gets the golden rules, and no family alert', () => {
  const card = offlineRead('My son called to say he will come home late', { lang: 'en', today, kind: 'call' });
  assert.equal(card.flags.includes('SCAM'), false);
  assert.match(card.fields.warning.text, /OTP/);
  assert.equal(card.guardian, null);
});

test('family alert: expired medicine and overdue bill, in the person\'s language plus English', () => {
  const med = buildCard({ docType: 'medicine', rawText: 'Paracetamol 500 EXP 02/2026', fields: { what: { text: 'पॅरासिटामॉल', confidence: 0.9 } } }, { lang: 'mr', today });
  assert.equal(med.guardian.reason, 'EXPIRED');
  assert.match(med.guardian.text, /मुदत संपलेले/);
  assert.match(med.guardian.text, /EXPIRED/);
  const bill = buildCard({ docType: 'electricity_bill', rawText: 'Bill Amount 840 Due Date 01-10-2026', deadlineIso: '2026-10-01', amountValue: 840,
    fields: { what: { text: 'बिजली बिल', confidence: 0.9 }, amount: { text: '₹840', confidence: 0.9 }, deadline: { text: '1 अक्टूबर', confidence: 0.9 } } }, { lang: 'hi', today });
  assert.equal(bill.guardian.reason, 'OVERDUE');
  const fine = buildCard({ docType: 'electricity_bill', rawText: 'Bill Amount 840 Due Date 20-10-2026', deadlineIso: '2026-10-20', amountValue: 840,
    fields: { what: { text: 'Bill', confidence: 0.9 }, amount: { text: '₹840', confidence: 0.9 } } }, { lang: 'en', today });
  assert.equal(fine.guardian, null);
});

test('call check: indirect OTP ("the number in the SMS") and "connection will be cut tonight, call this number"', () => {
  assert.ok(detectScam('बैंक वाले ने कहा आपका खाता बंद हो जाएगा, एक मैसेज आया होगा उसका नंबर बताइए', 'hi').isSuspect);
  assert.ok(detectScam('किसी ने फ़ोन किया कि बिजली का बिल बकाया है, आज रात 9 बजे कनेक्शन कट जाएगा, इस नंबर 9876543210 पर तुरंत कॉल करो', 'hi').isSuspect);
  assert.ok(detectScam('He said read me the code in the SMS you just got', 'en').isSuspect);
});
