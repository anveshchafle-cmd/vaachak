// Rule-based fraud check for bills, notices and SMS screenshots. No AI involved:
// every reason can be traced back to a pattern in this file.
import { toAsciiDigits } from './rules.js';
import { messages } from './i18n.js';

const OFFICIAL_DOMAINS = [
  'mahadiscom.in', 'mahatransco.in', 'bestundertaking.com', 'tatapower.com', 'adanielectricity.com',
  'torrentpower.com', 'bescom.co.in', 'mahanagargas.com', 'bsnl.co.in', 'jio.com', 'airtel.in', 'myvi.in',
  'onlinesbi.sbi', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'npci.org.in', 'rbi.org.in',
  'bharatbillpay.com', 'mcgm.gov.in', 'paytm.com', 'phonepe.com', 'pay.google.com',
];
const OFFICIAL_SUFFIXES = ['.gov.in', '.nic.in', '.gov', '.bank.in', '.sbi'];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.ly', 'cutt.ly', 'rb.gy', 'is.gd', 'goo.gl', 'shorturl.at', 'rebrand.ly', 'ow.ly', 'tiny.cc'];
const SHADY_TLDS = ['xyz', 'top', 'click', 'online', 'site', 'link', 'live', 'buzz', 'info', 'shop', 'icu', 'cfd', 'sbs'];
const BRAND_WORDS = ['mseb', 'msedcl', 'mahadiscom', 'mahavitaran', 'electricity', 'bijli', 'sbi', 'kyc', 'aadhaar', 'bill'];

const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+(?:com|in|net|org|co|ly|xyz|top|click|online|site|link|live|buzz|info|shop|icu|cfd|sbs|me|cc|io|app|sbi|gl|at|gd))(?:\/[^\s]*)?/gi;
const MOBILE_RE = /(?:\+?91[\s-]?)?(?<!\d)([6-9]\d{4}[\s-]?\d{5})(?!\d)/g;
const CALL_WORDS = /call|contact|whatsapp|dial|helpline|officer|संपर्क|कॉल|फोन|फ़ोन|अधिकारी/i;
const NEGATED_OTP = /(never|do not|don't|dont)\s+(share|disclose|tell)|सांगू नका|शेअर करू नका|न बताएं|मत बताइए|किसी को न/i;

function isOfficial(host) {
  return OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)) || OFFICIAL_SUFFIXES.some((s) => host.endsWith(s));
}

function checkLinks(text) {
  let weight = 0;
  for (const m of text.matchAll(URL_RE)) {
    const host = m[1].toLowerCase();
    if (isOfficial(host)) continue;
    const tld = host.split('.').pop();
    const looksLikeBrand = BRAND_WORDS.some((w) => host.includes(w));
    if (SHORTENERS.includes(host) || SHADY_TLDS.includes(tld) || looksLikeBrand) weight = Math.max(weight, 2);
    else weight = Math.max(weight, 1);
  }
  return weight;
}

function checkPersonalNumber(text) {
  for (const m of text.matchAll(MOBILE_RE)) {
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    if (CALL_WORDS.test(before)) return 2;
  }
  return 0;
}

const SIGNALS = [
  {
    code: 'OTP_REQUEST',
    test: (t) => (/\bOTP\b|one[\s-]?time[\s-]?password|\bCVV\b|\b(?:ATM|UPI)\s*PIN\b|ओटीपी|पिन\s*नंबर/i.test(t) && !NEGATED_OTP.test(t) ? 3 : 0),
  },
  {
    code: 'REMOTE_APP',
    test: (t) =>
      /any\s?desk|team\s?viewer|quick\s?support|rust\s?desk|airdroid|\.apk\b/i.test(t) ? 3
        : /(download|install)\s+(?:this|the|our|below)?\s*app|अ‍?ॅप\s*(डाउनलोड|इन्स्टॉल)|ऐप\s*डाउनलोड/i.test(t) ? 2 : 0,
  },
  { code: 'PERSONAL_NUMBER', test: checkPersonalNumber },
  { code: 'UNOFFICIAL_LINK', test: checkLinks },
  {
    code: 'THREAT_URGENCY',
    test: (t) => {
      const threat = /disconnect|will be cut|be cut off|block(?:ed)?|suspend|बंद\s*(होईल|केला|केली|केले|होगा|हो जाएगा|कर दिया)|खंडित|कापला|काटा|कट\s*(होईल|होगा|हो जाएगा)/i.test(t);
      const now = /tonight|today|immediately|urgent|within\s*\d+\s*(?:hours?|hrs?|minutes?|mins?)|\d{1,2}[:.]\d{2}\s*(?:pm|am)|आज\s*रात्री|आज\s*रात|आजच|ताबडतोब|लगेच|त्वरित|तुरंत|तत्काल|आज\s*ही/i.test(t);
      return threat && now ? 2 : 0;
    },
  },
  { code: 'KYC', test: (t) => (/\bKYC\b|केवायसी|update\s+your\s+(?:pan|aadhaar|aadhar|account|details)/i.test(t) ? 1 : 0) },
  {
    code: 'PERSONAL_UPI',
    test: (t) => {
      const m = /\b([a-z0-9.\-_]{3,})@(?:ybl|okaxis|okhdfcbank|oksbi|okicici|paytm|axl|ibl|apl|upi)\b/i.exec(t);
      if (!m) return 0;
      return /^[6-9]\d{9}$/.test(m[1]) ? 2 : 1;
    },
  },
  { code: 'PRIZE', test: (t) => (/lottery|lucky\s*draw|you\s+(?:have\s+)?won|\bprize\b|\bKBC\b|लॉटरी|बक्षीस|इनाम|जीत/i.test(t) ? 2 : 0) },
];

export const SCAM_THRESHOLD = 3;

export function detectScam(rawText, lang = 'mr') {
  const text = toAsciiDigits(rawText);
  const reasonText = messages(lang).reasons;
  const hits = SIGNALS.map((s) => ({ code: s.code, weight: s.test(text) })).filter((h) => h.weight > 0);
  hits.sort((a, b) => b.weight - a.weight);
  const score = hits.reduce((sum, h) => sum + h.weight, 0);
  return {
    isSuspect: score >= SCAM_THRESHOLD,
    score,
    reasons: hits.map((h) => ({ code: h.code, weight: h.weight, text: reasonText[h.code] })),
  };
}
