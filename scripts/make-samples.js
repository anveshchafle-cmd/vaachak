// Builds ready-made cards for the frontend's offline Demo mode from the test fixtures.
// Usage: npm run samples -- [YYYY-MM-DD]   (date defaults to today in India; use the demo day)
// Writes samples/<name>.json (Marathi, also used by the classic page), <name>.hi.json and <name>.en.json.
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { todayIST } from '../lib/rules.js';

const today = process.argv[2] || todayIST();
const fixtures = ['electricity-bill', 'medicine-expired', 'scam-sms', 'prescription'];

// The fixtures are what Gemini wrote in Marathi. These are the same readings as Gemini would write them
// in Hindi and English; everything the rule engine adds (warnings, speech) comes from lib/i18n.js.
const TRANSLATIONS = {
  hi: {
    'electricity-bill': {
      fields: { what: 'MSEDCL का बिजली बिल', action: '₹840 भरें', deadline: '10 अक्टूबर 2026', amount: '₹840', warning: 'देर से भरने पर ₹850 भरने होंगे' },
      amountWords: 'आठ सौ चालीस रुपये',
    },
    'medicine-expired': {
      fields: { what: 'पैरासिटामोल 500 mg गोली (बुखार और दर्द के लिए)', action: 'डॉक्टर के बताए अनुसार लें', warning: 'बच्चों से दूर रखें' },
    },
    'scam-sms': {
      fields: { what: 'बिजली काटने के बारे में SMS', action: '7894561230 पर फोन करें', deadline: 'आज रात 9.30', warning: 'आज रात बिजली काट दी जाएगी' },
    },
    prescription: {
      fields: { what: 'डॉक्टर की पर्ची: मेटफॉर्मिन 500 mg (शुगर के लिए)', action: 'सुबह 1 और रात 1 गोली खाने के बाद, 30 दिन', deadline: 'अगली मुलाकात 5 नवंबर 2026' },
    },
  },
  en: {
    'electricity-bill': {
      fields: { what: 'MSEDCL electricity bill', action: 'Pay ₹840', deadline: '10 October 2026', amount: '₹840', warning: 'If paid late, you must pay ₹850' },
      amountWords: 'eight hundred and forty rupees',
    },
    'medicine-expired': {
      fields: { what: 'Paracetamol 500 mg tablet (for fever and pain)', action: 'Take as the doctor says', warning: 'Keep away from children' },
    },
    'scam-sms': {
      fields: { what: 'SMS about cutting electricity', action: 'Call 7894561230', deadline: 'Tonight 9.30', warning: 'Electricity will be cut tonight' },
    },
    prescription: {
      fields: { what: "Doctor's prescription: Metformin 500 mg (for sugar)", action: '1 tablet morning and 1 at night after food, 30 days', deadline: 'Next visit 5 November 2026' },
    },
  },
};

function translate(ex, tr) {
  const out = structuredClone(ex);
  for (const [k, text] of Object.entries(tr.fields)) out.fields[k].text = text;
  if (tr.amountWords) out.amountWords = tr.amountWords;
  return out;
}

fs.mkdirSync('samples', { recursive: true });
for (const name of fixtures) {
  const ex = JSON.parse(fs.readFileSync(`test/fixtures/${name}.json`, 'utf8'));
  const write = (file, card) => fs.writeFileSync(`samples/${file}.json`, `${JSON.stringify(card, null, 2)}\n`);
  write(name, buildCard(ex, { lang: 'mr', today }));
  for (const lang of ['hi', 'en']) write(`${name}.${lang}`, buildCard(translate(ex, TRANSLATIONS[lang][name]), { lang, today }));
}
console.log(`Wrote ${fixtures.length} sample cards in mr, hi and en to samples/ (today = ${today})`);
