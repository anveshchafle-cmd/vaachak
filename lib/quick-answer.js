// Answers the most common questions straight from the card, with no internet: "how much?",
// "by when?", "what is my consumer number?", "what is this?", "what should I do?".
// Used when the AI answer does not come back in time, so the person is never left waiting.
// Returns null when the question is not one of these.

const TOPICS = [
  ['amount', /किती|पैसे|रक्कम|रुपये|कितना|कितने|पैसा|रकम|how much|amount|cost|rupee/i],
  ['deadline', /तारीख|कधी|शेवट|मुदत|कब|आखिरी|अंतिम|last date|when|due|deadline|\bdate\b/i],
  ['account', /ग्राहक क्र|क्रमांक|नंबर|खाते|उपभोक्ता|consumer|account|customer|number/i],
  ['action', /काय कर|काय करू|क्या कर|what (should|do|to)|करायचं/i],
  ['what', /काय आहे|कसला|कोणता|क्या है|किसका|what is this|which/i],
];

const SAY = {
  mr: { amount: (v) => `भरायची रक्कम ${v} आहे.`, deadline: (v) => `शेवटची तारीख ${v} आहे.`, account: (v) => `ग्राहक क्रमांक ${v} आहे.`, action: (v) => `${v}.`, what: (v) => `${v}.` },
  hi: { amount: (v) => `भरने की रकम ${v} है.`, deadline: (v) => `आखिरी तारीख ${v} है.`, account: (v) => `उपभोक्ता नंबर ${v} है.`, action: (v) => `${v}.`, what: (v) => `${v}.` },
  en: { amount: (v) => `The amount to pay is ${v}.`, deadline: (v) => `The last date is ${v}.`, account: (v) => `The consumer number is ${v}.`, action: (v) => `${v}.`, what: (v) => `${v}.` },
};

function value(card, topic) {
  if (topic === 'account') return card.payment?.consumerNumber || card.extraction?.accountId || '';
  return card.fields?.[topic]?.text || '';
}

export function quickAnswer(question, card, lang = card?.lang || 'mr') {
  const q = String(question || '');
  if (!q || !card) return null;
  const say = SAY[lang] || SAY.mr;
  for (const [topic, re] of TOPICS) {
    if (!re.test(q)) continue;
    const v = value(card, topic).trim().replace(/[.।]$/, '');
    if (v) return say[topic](v);
  }
  return null;
}
