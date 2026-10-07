// Plain, deterministic checks. Nothing in this file calls an AI model, so these
// results are predictable and can be shown to judges as "rule-based safety".

const MONTHS = {
  JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4, MAY: 5,
  JUN: 6, JUNE: 6, JUL: 7, JULY: 7, AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
};

// Devanagari digits (०-९) → ASCII, so Marathi/Hindi numbers can be compared.
export function toAsciiDigits(text) {
  return String(text || '').replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function utc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

export function addDays(iso, n) {
  return new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fullYear(y) {
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

function toIso(y, m, d) {
  const iso = `${fullYear(y)}-${pad(m)}-${pad(d)}`;
  return isIsoDate(iso) ? iso : null;
}

function lastDayOfMonth(y, m) {
  const yy = fullYear(y);
  if (m < 1 || m > 12) return null;
  return toIso(yy, m, new Date(Date.UTC(yy, m, 0)).getUTCDate());
}

// Finds the expiry date printed on a medicine strip, e.g. "EXP. 08/2026",
// "Exp Date: AUG.2026", "USE BEFORE 07/27", "EXP 31/08/2026".
// Month-only dates count as the last day of that month.
export function parseExpiry(rawText) {
  const text = toAsciiDigits(rawText).toUpperCase();
  const keyword = /\b(?:EXP(?:IRY)?\.?(?:\s*DATE)?|EXPIRES?(?:\s*ON)?|USE\s*BEFORE|BEST\s*BEFORE)\s*[:.\-]?\s*/g;
  let m;
  while ((m = keyword.exec(text))) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    let p;
    if ((p = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/.exec(rest))) {
      const iso = toIso(p[3], Number(p[2]), Number(p[1]));
      if (iso) return iso;
    }
    if ((p = /^(\d{1,2})\s*[/.\-\s]\s*(\d{4}|\d{2})(?!\d)/.exec(rest))) {
      const iso = lastDayOfMonth(p[2], Number(p[1]));
      if (iso) return iso;
    }
    if ((p = /^([A-Z]{3,9})\s*[.\-/'\s]?\s*(\d{4}|\d{2})(?!\d)/.exec(rest)) && MONTHS[p[1]]) {
      const iso = lastDayOfMonth(p[2], MONTHS[p[1]]);
      if (iso) return iso;
    }
  }
  return null;
}

// Checks that the amount the AI reported is really printed in the document.
// Handles Indian grouping (1,23,456) and Devanagari digits.
export function amountAppearsInText(value, rawText) {
  if (!Number.isFinite(value)) return false;
  const text = toAsciiDigits(rawText).replace(/(\d),(?=\d)/g, '$1');
  for (const n of text.match(/\d+(?:\.\d{1,2})?/g) || []) {
    if (Math.abs(Number(n) - value) < 0.005) return true;
  }
  return false;
}

// Checks that the date the AI reported is really printed in the document,
// in any common Indian format (15/10/2026, 15-10-26, 15 Oct 2026, Oct 15, 2026, 2026-10-15).
export function dateAppearsInText(iso, rawText) {
  if (!isIsoDate(iso)) return false;
  const [y, mo, d] = iso.split('-').map(Number);
  const text = toAsciiDigits(rawText).toUpperCase();
  const yearOk = (yy) => !yy || fullYear(yy) === y;

  for (const p of text.matchAll(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/g)) {
    if (Number(p[1]) === d && Number(p[2]) === mo && yearOk(p[3])) return true;
  }
  for (const p of text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    if (Number(p[1]) === y && Number(p[2]) === mo && Number(p[3]) === d) return true;
  }
  for (const p of text.matchAll(/(\d{1,2})(?:ST|ND|RD|TH)?[\s\-.]*([A-Z]{3,9})[\s\-.,']*(\d{4}|\d{2})?/g)) {
    if (Number(p[1]) === d && MONTHS[p[2]] === mo && yearOk(p[3])) return true;
  }
  for (const p of text.matchAll(/([A-Z]{3,9})[\s.\-]*(\d{1,2})(?:ST|ND|RD|TH)?,?\s*(\d{4})?/g)) {
    if (MONTHS[p[1]] === mo && Number(p[2]) === d && yearOk(p[3])) return true;
  }
  return false;
}

// Doctor's shorthand "1-0-1 after food" → { morning: 1, noon: 0, night: 1, food: 'after' }.
// Single digits only, so dates like 5-11-26 are never mistaken for a dose.
export function parseDosePattern(rawText) {
  const text = toAsciiDigits(rawText);
  const m = /(?<![\d/.\-])([0-3])\s*[-–]\s*([0-3])\s*[-–]\s*([0-3])(?![\d/.\-])/.exec(text);
  if (!m) return null;
  const [morning, noon, night] = [m[1], m[2], m[3]].map(Number);
  if (morning + noon + night === 0) return null;
  const after = /after\s*(?:food|meals?|breakfast|lunch|dinner)|post[\s-]*(?:meal|food|prandial)|\bp\.c\.|जेवणानंतर|जेवणा\s*नंतर|खाने\s*के\s*बाद|भोजन\s*के\s*बाद/i;
  const before = /before\s*(?:food|meals?|breakfast|lunch|dinner)|empty\s*stomach|pre[\s-]*(?:meal|food|prandial)|\ba\.c\.|जेवणाआधी|जेवणापूर्वी|उपाशीपोटी|खाने\s*से\s*पहले|खाली\s*पेट/i;
  const food = after.test(text) ? 'after' : before.test(text) ? 'before' : 'any';
  return { morning, noon, night, food };
}

// Stable key for "same biller, same account", used for the bill-spike check.
export function makeBillerKey(issuer, accountId) {
  const acc = toAsciiDigits(accountId).replace(/\D/g, '');
  const who = String(issuer || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!acc && !who) return null;
  return `${who || 'unknown'}:${acc || 'na'}`;
}

export function checkBillSpike(billerKey, amount, history) {
  if (!billerKey || !Number.isFinite(amount) || !history) return null;
  const previous = Number(history[billerKey]);
  if (!(previous > 0) || amount < previous * 2) return null;
  return { previous, current: amount, ratio: Math.round((amount / previous) * 10) / 10 };
}
