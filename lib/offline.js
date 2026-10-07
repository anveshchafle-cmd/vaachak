// Offline mode: builds the same action card in the browser from on-device OCR text
// (Tesseract.js), with no network call at all. It reuses the exact same rule engine as the
// server: expiry, urgency, scam shield, bill spike, confidence. Only the reading is simpler.
import { buildCard } from './card.js';
import { matchMedicine } from './medicines.js';
import { findBiller } from './billers.js';
import { messages, normalizeLang, formatRupees, formatDate } from './i18n.js';
import { detectScam } from './scam.js';
import { fixOcrDigits, isUsableOcr } from './text.js';
import { toAsciiDigits, todayIST, isIsoDate } from './rules.js';

// Most specific first: utility bills, then shop / GST invoices, then a bare "Total ... 1,234.00" line.
const AMOUNT_RES = [
  /(?:net\s*amount\s*payable|amount\s*payable|total\s*(?:amount\s*)?(?:due|payable)|bill\s*amount|amount\s*due|balance\s*due)\s*(?:\((?:₹|rs\.?)\))?\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:grand\s*total|invoice\s*total|total\s*invoice\s*(?:value|amount)|net\s*total|total\s*amount)\s*(?:\((?:₹|rs\.?)\))?\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
];
const TOTAL_LINE_RE = /^\s*total\b[^\n\d]*([\d,]+(?:\.\d{1,2})?)\s*$/gim;
const DUE_RE = /(?:due\s*date|last\s*date|pay\s*by|payable\s*by)\s*[:\-]?\s*(\d{1,2})[/.\-\s]([a-z]{3,9}|\d{1,2})[/.\-\s](\d{2,4})/i;
const MONTH_NUM = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ACCOUNT_RE = /(?:consumer|account|customer|ca)\s*(?:no|number|id)?\.?\s*[:\-]?\s*(\d[\d\s]{5,15}\d)/i;

const field = (text, confidence = 0.75) => ({ text: text || '', confidence: text ? confidence : 1, box: null });

export function parseBillText(text) {
  let amountMatch = null;
  for (const re of AMOUNT_RES) amountMatch ||= re.exec(text);
  amountMatch ||= [...text.matchAll(TOTAL_LINE_RE)].pop() || null;
  const dueMatch = DUE_RE.exec(text);
  const accountMatch = ACCOUNT_RE.exec(text);
  let deadlineIso = null;
  if (dueMatch) {
    const y = dueMatch[3].length === 2 ? `20${dueMatch[3]}` : dueMatch[3];
    const m = /\d/.test(dueMatch[2]) ? Number(dueMatch[2]) : MONTH_NUM[dueMatch[2].slice(0, 3).toLowerCase()];
    const iso = m ? `${y}-${String(m).padStart(2, '0')}-${dueMatch[1].padStart(2, '0')}` : '';
    deadlineIso = isIsoDate(iso) ? iso : null;
  }
  const amountValue = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null;
  return {
    amountValue: Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null,
    deadlineIso,
    accountId: accountMatch ? accountMatch[1].replace(/\s/g, '') : null,
  };
}

export function offlineRead(ocrText, { lang = 'mr', today = todayIST(), history = {}, familyPhone = null } = {}) {
  lang = normalizeLang(lang);
  const t = messages(lang);
  const text = fixOcrDigits(toAsciiDigits(ocrText));
  const readable = isUsableOcr(text);
  const ex = { readable, rawText: text, fields: {}, docType: 'other' };

  const med = readable ? matchMedicine(text) : null;
  const biller = readable ? findBiller(null, text) : null;
  const bill = readable ? parseBillText(text) : {};

  if (med) {
    const { medicine, name } = med;
    ex.docType = 'medicine';
    ex.fields = {
      what: field(`${name[0].toUpperCase()}${name.slice(1)} (${medicine.generic}): ${medicine.use[lang]}`, 0.8),
      action: field(t.medAction, 0.8),
      deadline: field(''),
      amount: field(''),
      warning: field(medicine.warning[lang], 0.8),
    };
  } else if (biller || bill.amountValue) {
    ex.docType = biller && /electric|mahavitaran|power|best/i.test(biller.name) ? 'electricity_bill' : 'other_bill';
    ex.issuer = biller?.name || null;
    ex.accountId = bill.accountId;
    ex.amountValue = bill.amountValue;
    ex.deadlineIso = bill.deadlineIso;
    const amount = bill.amountValue ? formatRupees(bill.amountValue) : '';
    ex.fields = {
      what: field(biller ? t.billOf(biller.name) : t.bill),
      action: field(amount ? t.payAmount(amount) : ''),
      deadline: field(bill.deadlineIso ? formatDate(bill.deadlineIso, lang) : ''),
      amount: field(amount),
      warning: field(''),
    };
  } else if (detectScam(text, lang).isSuspect) {
    ex.docType = 'sms_message';
    ex.fields = { what: field('SMS', 0.7) };
  }

  const card = buildCard(ex, { lang, today, history, familyPhone, isPdf: true, mode: 'offline' });
  card.offline = { note: t.offlineNote, medicine: med ? { name: med.name, generic: med.medicine.generic } : null };
  return card;
}
