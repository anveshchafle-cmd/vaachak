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
    // "call 98xxx" or, as callers say it, "on this number 98xxx call now".
    const around = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 40);
    if (CALL_WORDS.test(around)) return 2;
  }
  return 0;
}

const SIGNALS = [
  {
    code: 'OTP_REQUEST',
    test: (t) => {
      if (NEGATED_OTP.test(t)) return 0;
      if (/\bOTP\b|one[\s-]?time[\s-]?password|\bCVV\b|\b(?:ATM|UPI)\s*PIN\b|ओटीपी|पिन\s*नंबर/i.test(t)) return 3;
      // Callers rarely say "OTP": "tell me the code/number in the SMS you just got".
      return /(?:sms|message|मेसेज|मैसेज|संदेश)[\s\S]{0,40}(?:code|number|digits|नंबर|कोड|अंक)[\s\S]{0,25}(?:tell|share|read|say|बता|सांगा|सांग|सांगून|वाचून)/i.test(t) ||
        /(?:tell|share|read|say)\b[\s\S]{0,20}(?:code|number|digits)[\s\S]{0,25}(?:sms|message)/i.test(t)
        ? 3 : 0;
    },
  },
  {
    code: 'REMOTE_APP',
    test: (t) =>
      /any\s?desk|team\s?viewer|quick\s?support|rust\s?desk|airdroid|\.apk\b|screen\s*shar|स्क्रीन\s*शेअर|स्क्रीन\s*शेयर/i.test(t) ? 3
        : /(download|install)\s+(?:this|the|our|below)?\s*app|अ‍?ॅप\s*(डाउनलोड|इन्स्टॉल)|ऐप\s*डाउनलोड/i.test(t) ? 2 : 0,
  },
  { code: 'PERSONAL_NUMBER', test: checkPersonalNumber },
  { code: 'UNOFFICIAL_LINK', test: checkLinks },
  {
    code: 'THREAT_URGENCY',
    test: (t) => {
      const threat = /disconnect|will be cut|be cut off|block(?:ed)?|suspend|बंद\s*(होईल|केला|केली|केले|होगा|हो जाएगा|कर दिया)|खंडित|कापला|काटा|कट\s*(होईल|होगा|हो जाएगा|जाएगा|जाईल|करेंगे|करू)/i.test(t);
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
  {
    code: 'PRIZE',
    test: (t) => {
      if (!/lottery|lucky\s*draw|you\s+(?:have\s+)?won|\bprize\b|\bKBC\b|लॉटरी|बक्षीस|इनाम|जीत/i.test(t)) return 0;
      // A prize you must first pay a "fee" or "tax" for is always a fraud.
      return /\bfees?\b|\btax\b|charges?|deposit|processing|registration|फी|फ़ीस|फीस|शुल्क|टॅक्स|टैक्स|कर\s*भरा/i.test(t) ? 3 : 2;
    },
  },
  // Phone-call frauds (what an elder says a caller told them), India's fastest-growing scams.
  {
    code: 'DIGITAL_ARREST',
    test: (t) => {
      if (/digital\s*arrest|डिजिटल\s*(?:अरेस्ट|अटक)/i.test(t)) return 3;
      const authority = /police|\bCBI\b|\bNCB\b|narcotics|customs|crime\s*branch|cyber\s*(?:cell|police)|enforcement\s*directorate|\bTRAI\b|\bRBI\s*officer|पोलीस|पोलिस|पुलिस|सीबीआय|सीबीआई|कस्टम|नार्कोटिक्स|क्राइम\s*ब्रांच/i.test(t);
      const threat = /arrest|warrant|\bFIR\b|\bcase\b|parcel|drugs?|money\s*launder|illegal|court|jail|अटक|गिरफ्तार|गिरफ़्तार|वॉरंट|वारंट|केस|गुन्हा|तुरुंग|जेल|ड्रग्स|पार्सल|मनी\s*लॉन्ड्रिंग/i.test(t);
      return authority && threat ? 3 : 0;
    },
  },
  {
    code: 'SAFE_ACCOUNT',
    test: (t) =>
      /safe\s*account|secure\s*account|verification\s*(?:amount|fee|charge|money)|refundable\s*(?:deposit|amount)|सुरक्षित\s*खात|सेफ\s*अकाउंट|सुरक्षित\s*अकाउंट|सुरक्षित\s*खाते/i.test(t) ? 3 : 0,
  },
  {
    code: 'SECRECY',
    test: (t) =>
      /(?:don'?t|do\s*not)\s*tell\s*(?:anyone|anybody|your\s*(?:family|son|daughter|children))|keep\s*(?:it|this)\s*(?:a\s*)?secret|(?:कोणाला|कुणाला|कोणालाही|घरच्यांना)\s*(?:ही\s*)?सांगू\s*नका|गुप्त\s*ठेवा|किसी\s*को\s*(?:भी\s*)?(?:मत|न)\s*बता|घरवालों\s*को\s*(?:मत|न)\s*बता/i.test(t) ? 2 : 0,
  },
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
