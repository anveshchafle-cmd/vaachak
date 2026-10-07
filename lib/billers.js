// Zero-type payment. Vaachak never guesses where money goes:
//  1. If the bill itself prints a UPI ID, we build a UPI link to exactly that ID (after the scam check).
//  2. Otherwise we copy the consumer number and open the biller's official payment page.
import { toAsciiDigits } from './rules.js';

// Only official websites (all checked to load). Add a biller's UPI ID here only after verifying it.
export const BILLERS = [
  {
    id: 'msedcl',
    name: 'MSEDCL (Mahavitaran)',
    match: /msedcl|mahadiscom|mahavitaran|maharashtra state electricity|महावितरण/i,
    payUrl: 'https://wss.mahadiscom.in/wss/wss?uiActionName=getViewPayBill',
    upi: null,
  },
  { id: 'adani', name: 'Adani Electricity', match: /adani\s*electricity/i, payUrl: 'https://www.adanielectricity.com/', upi: null },
  { id: 'tatapower', name: 'Tata Power', match: /tata\s*power/i, payUrl: 'https://www.tatapower.com/', upi: null },
  { id: 'best', name: 'BEST', match: /\bB\.?E\.?S\.?T\.?\s*undertaking|brihanmumbai electric/i, payUrl: 'https://www.bestundertaking.com/', upi: null },
  { id: 'torrent', name: 'Torrent Power', match: /torrent\s*power/i, payUrl: 'https://www.torrentpower.com/', upi: null },
  { id: 'mgl', name: 'Mahanagar Gas', match: /mahanagar\s*gas|\bMGL\b/i, payUrl: 'https://www.mahanagargas.com/', upi: null },
];

export function findBiller(issuer, rawText) {
  const hay = `${issuer || ''}\n${rawText || ''}`;
  return BILLERS.find((b) => b.match.test(hay)) || null;
}

// A UPI ID printed on the document (not an email address, not a personal phone-number handle).
export function upiIdOnDocument(rawText) {
  for (const m of String(rawText || '').matchAll(/(?<![\w.])([a-z0-9][a-z0-9.\-_]{1,48})@([a-z]{2,20})(?![\w.@])/gi)) {
    if (/^[6-9]\d{9}$/.test(m[1])) continue;
    return `${m[1]}@${m[2]}`.toLowerCase();
  }
  return null;
}

// The consumer number must be printed on the bill, so we never copy a number the AI made up.
export function verifiedConsumerNumber(accountId, rawText) {
  const acc = toAsciiDigits(accountId).replace(/\D/g, '');
  if (acc.length < 6) return null;
  const digits = toAsciiDigits(rawText).replace(/\D/g, '');
  return digits.includes(acc) ? acc : null;
}

// `vpa` only ever comes from upiIdOnDocument/BILLERS, so it holds URL-safe characters; UPI apps
// expect its "@" unencoded.
export function upiUrl({ vpa, name, amount, note }) {
  const enc = encodeURIComponent;
  return `upi://pay?pa=${vpa}&pn=${enc(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${enc(note)}`;
}
