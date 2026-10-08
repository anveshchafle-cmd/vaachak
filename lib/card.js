// Turns Gemini's raw extraction into the final action card, applying every
// rule-based check on top. Pure function: no network, easy to test.
import { DOC_TYPES } from './prompts.js';
import { messages, normalizeLang, formatRupees } from './i18n.js';
import { detectScam } from './scam.js';
import { checkConsensus } from './consensus.js';
import { findBiller, upiIdOnDocument, verifiedConsumerNumber, upiUrl } from './billers.js';
import {
  todayIST, isIsoDate, daysBetween, addDays, parseExpiry,
  amountAppearsInText, dateAppearsInText, makeBillerKey, checkBillSpike, parseDosePattern, parseAllDoses,
} from './rules.js';

export const FIELD_KEYS = ['what', 'action', 'deadline', 'amount', 'warning'];
export const LOW_CONFIDENCE = 0.6;

const BILL_TYPES = ['electricity_bill', 'water_bill', 'phone_bill', 'gas_bill', 'other_bill'];
const MEDICINE_TYPES = ['medicine', 'prescription'];

function clamp01(n) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function cleanBox(box, isPdf) {
  if (isPdf || !Array.isArray(box) || box.length !== 4) return null;
  const b = box.map(Number);
  if (!b.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  if (b[0] >= b[2] || b[1] >= b[3]) return null;
  return b.map(Math.round);
}

function aiField(f, isPdf) {
  const text = typeof f?.text === 'string' ? f.text.trim() : '';
  return {
    text,
    confidence: text ? clamp01(Number(f?.confidence)) : 1,
    box: text ? cleanBox(f?.box, isPdf) : null,
    source: 'ai',
  };
}

function ruleField(text) {
  return { text, confidence: 1, box: null, source: 'rule' };
}

function cleanPills(p) {
  if (!p) return null;
  const n = (v) => Math.min(10, Math.max(0, Math.round(Number(v) || 0)));
  const pills = { morning: n(p.morning), noon: n(p.noon), night: n(p.night), food: ['before', 'after'].includes(p.food) ? p.food : 'any' };
  return pills.morning + pills.noon + pills.night > 0 ? pills : null;
}

// Several medicines on one prescription: one schedule each, never merged into one.
function cleanMedicines(list) {
  if (!Array.isArray(list)) return null;
  const meds = list
    .map((m) => {
      const pills = cleanPills(m);
      const name = typeof m?.name === 'string' ? m.name.replace(/[<>{}]/g, '').trim().slice(0, 30) : '';
      return pills && name ? { name, ...pills } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
  return meds.length >= 2 ? meds : null;
}

function cleanChecklist(list) {
  if (!Array.isArray(list)) return null;
  const items = list.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 8);
  return items.length ? items : null;
}

function compact(iso) {
  return iso.replaceAll('-', '');
}

const DOC_LABELS_EN = {
  electricity_bill: 'electricity bill', water_bill: 'water bill', phone_bill: 'phone bill', gas_bill: 'gas bill',
  other_bill: 'bill', medicine: 'medicine', prescription: 'prescription', government_notice: 'government notice',
  bank_notice: 'bank notice', sms_message: 'message', other: 'document',
};
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// One plain English line for the son/daughter, whatever language the parent uses.
function familySummaryEn({ docType, issuer, amountValue, deadlineIso, flags }) {
  if (flags.includes('SCAM')) return 'Looks like a SCAM message. Please call me before I do anything.';
  let s = `${issuer ? `${issuer} ` : ''}${DOC_LABELS_EN[docType] || 'document'}`;
  if (amountValue != null) s += ` of ${formatRupees(amountValue)}`;
  if (deadlineIso) {
    const [y, m, d] = deadlineIso.split('-').map(Number);
    s += ` due on ${d} ${MONTHS_EN[m - 1]} ${y}`;
  }
  if (flags.includes('EXPIRED')) s += ' (EXPIRED)';
  return `${s[0].toUpperCase()}${s.slice(1)}. Please verify.`;
}

function buildActions({ t, lang, fields, flags, deadlineIso, today, familyPhone, summaryEn }) {
  const lines = [fields.what, fields.action, fields.amount, fields.deadline]
    .map((f) => f.text)
    .filter(Boolean);
  if (fields.warning.text) lines.push(`⚠️ ${fields.warning.text}`);
  const english = lang === 'en' ? '' : `\n\n🇬🇧 ${summaryEn}`;
  const whatsappText = `${t.waHeader}\n\n${lines.join('\n')}${english}\n\n${t.waAsk}`;
  const phone = String(familyPhone || '').replace(/\D/g, '').slice(-10);
  const whatsappUrl = `https://wa.me/${phone.length === 10 ? `91${phone}` : ''}?text=${encodeURIComponent(whatsappText)}`;

  let calendarUrl = null;
  if (deadlineIso && deadlineIso >= today && !flags.includes('SCAM')) {
    // Remind one day early so there is time to pay; same day if it is due tomorrow or today.
    const day = daysBetween(today, deadlineIso) >= 2 ? addDays(deadlineIso, -1) : deadlineIso;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${t.reminder}: ${fields.action.text || fields.what.text}`,
      dates: `${compact(day)}/${compact(addDays(day, 1))}`,
      details: lines.join('\n'),
    });
    calendarUrl = `https://calendar.google.com/calendar/render?${params}`;
  }
  return { whatsappText, whatsappUrl, calendarUrl, familySummaryEn: summaryEn };
}

// Vibration patterns (ms on/off) for navigator.vibrate, strongest danger first.
const ALERTS = {
  SCAM: { level: 'danger', vibrate: [400, 200, 400, 200, 800] },
  EXPIRED: { level: 'danger', vibrate: [400, 200, 400, 200, 800] },
  URGENT: { level: 'warning', vibrate: [200, 100, 200] },
  BILL_SPIKE: { level: 'warning', vibrate: [200, 100, 200] },
  LOW_CONFIDENCE: { level: 'info', vibrate: [150] },
};

function buildAlert(flags) {
  const flag = Object.keys(ALERTS).find((f) => flags.includes(f));
  return flag ? { flag, ...ALERTS[flag] } : { flag: null, level: 'ok', vibrate: [60] };
}

// Zero-type payment, only when we are sure about who gets the money and how much.
function buildPayment({ t, docType, ex, rawText, fields, flags, amountValue }) {
  if (!BILL_TYPES.includes(docType) || amountValue == null) return null;
  if (flags.includes('SCAM') || flags.includes('LOW_CONFIDENCE') || fields.amount.confidence < LOW_CONFIDENCE) return null;
  const biller = findBiller(ex?.issuer, rawText);
  const consumerNumber = verifiedConsumerNumber(ex?.accountId, rawText);
  const vpa = upiIdOnDocument(rawText) || biller?.upi || null;
  const name = biller?.name || ex?.issuer || 'Biller';
  const amount = formatRupees(amountValue);
  const upi = vpa
    ? upiUrl({ vpa, name, amount: amountValue, note: consumerNumber ? `Bill ${consumerNumber}` : 'Bill payment' })
    : null;
  if (!upi && !biller) return null;
  return {
    method: upi ? 'upi' : 'official_site',
    billerId: biller?.id || null,
    billerName: name,
    amount: amountValue,
    consumerNumber,
    upiUrl: upi,
    upiSource: upi ? (upiIdOnDocument(rawText) ? 'document' : 'verified_list') : null,
    officialUrl: biller?.payUrl || null,
    copyText: consumerNumber,
    confirmText: t.payConfirm(amount, name),
    copiedText: consumerNumber ? t.payCopied : null,
  };
}

function buildSpeech({ t, fields, flags, scam, amountWords, daysLeft, overdue, pills, medicines, userName }) {
  // Addressing the person by name ("प्रकाश काका, ...") makes it feel like family, not a machine.
  const say = userName ? [`${userName},`] : [];
  if (flags.includes('SCAM')) {
    say.push(t.scam, ...scam.reasons.slice(0, 2).map((r) => r.text), t.scamAction);
    return say.join(' ');
  }
  if (flags.includes('LOW_CONFIDENCE')) {
    if (fields.what.text && fields.what.confidence >= LOW_CONFIDENCE) say.push(`${fields.what.text}.`);
    say.push(t.lowConfidence);
    return say.join(' ');
  }
  if (fields.what.text) say.push(`${fields.what.text}.`);
  if (flags.includes('EXPIRED')) say.push(t.expired);
  if (fields.action.text && fields.action.source === 'ai') say.push(`${fields.action.text}.`);
  // Say the amount twice — digits, then words — so it sticks.
  if (fields.amount.text) say.push(`${t.amountIs}: ${fields.amount.text}.${amountWords ? ` ${amountWords}.` : ''}`);
  if (fields.deadline.text) say.push(`${t.lastDate}: ${fields.deadline.text}.`);
  if (daysLeft != null && !overdue && daysLeft <= 3) say.push(t.urgent(daysLeft));
  if (medicines) say.push(...medicines.map((m) => `${m.name}: ${t.pills(m)}`));
  else if (pills) say.push(t.pills(pills));
  if (fields.warning.text && !flags.includes('EXPIRED')) say.push(fields.warning.text);
  return say.join(' ').replace(/\.\./g, '.');
}

export function buildCard(
  ex,
  {
    lang = 'mr', today = todayIST(), history = {}, familyPhone = null, isPdf = false,
    edgeText = null, mode = 'online', userName = null,
  } = {},
) {
  lang = normalizeLang(lang);
  const t = messages(lang);
  const rawText = typeof ex?.rawText === 'string' ? ex.rawText : '';
  const docType = DOC_TYPES.includes(ex?.docType) ? ex.docType : 'other';

  const fields = {};
  for (const k of FIELD_KEYS) fields[k] = aiField(ex?.fields?.[k], isPdf);

  // Amount: must actually be printed on the document, otherwise we don't trust it.
  const amountValue = Number.isFinite(ex?.amountValue) && ex.amountValue > 0 ? Math.round(ex.amountValue * 100) / 100 : null;
  fields.amount.value = amountValue;
  if (amountValue != null) {
    fields.amount.verified = amountAppearsInText(amountValue, rawText);
    if (!fields.amount.verified) fields.amount.confidence = Math.min(fields.amount.confidence, 0.5);
  }

  // Deadline: same idea, but a date can be printed in many ways, so we only cap confidence lightly.
  const deadlineIso = isIsoDate(ex?.deadlineIso) ? ex.deadlineIso : null;
  fields.deadline.iso = deadlineIso;
  if (deadlineIso) {
    fields.deadline.verified = dateAppearsInText(deadlineIso, rawText);
    if (!fields.deadline.verified) fields.deadline.confidence = Math.min(fields.deadline.confidence, 0.7);
  }

  // Second engine: on-device OCR must agree with Gemini, or we stop trusting that field.
  const consensus = checkConsensus({ amountValue, deadlineIso }, edgeText);
  if (consensus.amount === 'disagree') fields.amount.confidence = Math.min(fields.amount.confidence, 0.5);
  if (consensus.deadline === 'disagree') fields.deadline.confidence = Math.min(fields.deadline.confidence, 0.5);
  if (consensus.available) {
    if (consensus.amount !== 'n/a') fields.amount.edge = consensus.amount;
    if (consensus.deadline !== 'n/a') fields.deadline.edge = consensus.deadline;
  }

  // Expiry: our own parser wins over the AI when it finds a date.
  const ruleExpiry = parseExpiry(rawText);
  const expiryIso = ruleExpiry || (isIsoDate(ex?.expiryIso) ? ex.expiryIso : null);

  const flags = [];
  const scam = detectScam(rawText, lang);
  if (scam.isSuspect) flags.push('SCAM');

  const expired = Boolean(expiryIso && expiryIso < today);
  if (expired) flags.push('EXPIRED');

  let daysLeft = null;
  let overdue = false;
  if (deadlineIso) {
    daysLeft = daysBetween(today, deadlineIso);
    overdue = daysLeft < 0;
    if (daysLeft <= 3) flags.push('URGENT');
  }

  // A known biller's id keeps the key stable when the AI writes "MSEDCL" once and "Mahavitaran" the next time.
  const billerKey = makeBillerKey(findBiller(ex?.issuer, rawText)?.id || ex?.issuer, ex?.accountId);
  const spike = BILL_TYPES.includes(docType) ? checkBillSpike(billerKey, amountValue, history) : null;
  if (spike) flags.push('BILL_SPIKE');

  // Rule messages replace the AI's text where safety matters, most serious first.
  if (scam.isSuspect) {
    fields.warning = ruleField(t.scam);
    fields.action = ruleField(t.scamAction);
    // The scammer's "tonight 9:30" and amount are pressure tactics, not real deadlines.
    fields.deadline = { ...ruleField(''), iso: null };
    fields.amount = { ...ruleField(''), value: null };
  } else if (expired) {
    fields.warning = ruleField(t.expired);
    fields.action = ruleField(t.expiredAction);
  } else if (spike) {
    fields.warning = ruleField(t.spike(spike.ratio));
  } else if (overdue) {
    fields.warning = ruleField(t.overdue);
  } else if (daysLeft != null && daysLeft <= 3 && !fields.warning.text) {
    fields.warning = ruleField(t.urgent(daysLeft));
  }

  const unsure = (k) => fields[k].text && fields[k].confidence < LOW_CONFIDENCE;
  if (ex?.readable === false || !fields.what.text || FIELD_KEYS.some(unsure)) flags.push('LOW_CONFIDENCE');

  // Dose pattern: the AI's reading, or our own "1-0-1 after food" parser when the AI has none.
  const isMed = MEDICINE_TYPES.includes(docType) && !expired;
  const medicines = isMed ? cleanMedicines(ex?.medicines) || cleanMedicines(parseAllDoses(rawText)) : null;
  const pills = isMed && !medicines ? cleanPills(ex?.pills) || parseDosePattern(rawText) : null;
  const checklist = cleanChecklist(ex?.checklist);
  const amountWords = typeof ex?.amountWords === 'string' ? ex.amountWords.trim() : null;
  const name = typeof userName === 'string' ? userName.replace(/[<>{}]/g, '').trim().slice(0, 30) : '';
  const summaryEn = familySummaryEn({ docType, issuer: ex?.issuer, amountValue, deadlineIso, flags });

  const disagree = consensus.amount === 'disagree' || consensus.deadline === 'disagree';
  if (consensus.available) consensus.label = consensus.badge ? t.verified : disagree ? t.edgeMismatch : null;

  return {
    mode,
    docType,
    lang,
    fields,
    flags,
    alert: buildAlert(flags),
    consensus,
    payment: buildPayment({ t, docType, ex, rawText, fields, flags, amountValue }),
    scam: { isSuspect: scam.isSuspect, score: scam.score, reasons: scam.reasons },
    pills,
    medicines,
    checklist,
    dates: { today, deadline: deadlineIso, expiry: expiryIso, daysLeft, overdue },
    spike,
    billerKey: BILL_TYPES.includes(docType) ? billerKey : null,
    actions: buildActions({ t, lang, fields, flags, deadlineIso, today, familyPhone, summaryEn }),
    speak: buildSpeech({ t, fields, flags, scam, amountWords, daysLeft, overdue, pills, medicines, userName: name }),
    rawText,
  };
}
