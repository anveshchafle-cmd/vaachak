// Dual-engine check: Gemini's reading must agree with an independent on-device OCR (Tesseract.js
// in the browser). Two different engines agreeing is much stronger than one model checking itself.
import { levenshtein, fixOcrDigits, isUsableOcr } from './text.js';
import { toAsciiDigits, dateAppearsInText, isIsoDate } from './rules.js';

function numbersIn(text) {
  return (fixOcrDigits(toAsciiDigits(text)).replace(/(\d),(?=\d)/g, '$1').match(/\d+(?:\.\d{1,2})?/g) || []);
}

// Agrees if OCR printed the same number, allowing one wrong digit (e.g. "84O" or "B40").
export function edgeAgreesOnAmount(value, edgeText) {
  if (!Number.isFinite(value)) return null;
  const whole = String(Math.round(value));
  for (const n of numbersIn(edgeText)) {
    if (Math.abs(Number(n) - value) < 0.005) return true;
    const nWhole = n.split('.')[0];
    if (whole.length >= 3 && nWhole.length === whole.length && levenshtein(nWhole, whole) <= 1) return true;
  }
  return false;
}

export function edgeAgreesOnDate(iso, edgeText) {
  if (!isIsoDate(iso)) return null;
  const text = fixOcrDigits(toAsciiDigits(edgeText));
  if (dateAppearsInText(iso, text)) return true;
  const [y, m, d] = iso.split('-');
  const target = `${d}/${m}/${y}`;
  for (const p of text.matchAll(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/g)) {
    const year = p[3].length === 2 ? `20${p[3]}` : p[3];
    if (levenshtein(`${p[1].padStart(2, '0')}/${p[2].padStart(2, '0')}/${year}`, target) <= 1) return true;
  }
  return false;
}

// Returns null when there is no usable OCR text (then nothing is penalised).
export function checkConsensus({ amountValue, deadlineIso }, edgeText) {
  if (!isUsableOcr(edgeText)) return { available: false, engines: ['gemini'], badge: null };
  const amount = amountValue != null ? edgeAgreesOnAmount(amountValue, edgeText) : null;
  const deadline = deadlineIso ? edgeAgreesOnDate(deadlineIso, edgeText) : null;
  const checked = [amount, deadline].filter((v) => v !== null);
  const agreed = checked.length > 0 && checked.every(Boolean);
  return {
    available: true,
    engines: ['gemini', 'tesseract'],
    amount: amount === null ? 'n/a' : amount ? 'agree' : 'disagree',
    deadline: deadline === null ? 'n/a' : deadline ? 'agree' : 'disagree',
    badge: agreed ? 'VERIFIED_BY_EDGE' : null,
  };
}
