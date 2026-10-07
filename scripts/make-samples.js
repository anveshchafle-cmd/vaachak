// Builds ready-made cards for the frontend's offline Demo mode from the test fixtures.
// Usage: npm run samples -- [YYYY-MM-DD]   (date defaults to today in India; use the demo day)
import fs from 'node:fs';
import { buildCard } from '../lib/card.js';
import { todayIST } from '../lib/rules.js';

const today = process.argv[2] || todayIST();
const fixtures = ['electricity-bill', 'medicine-expired', 'scam-sms', 'prescription'];
fs.mkdirSync('samples', { recursive: true });

// The fixtures are written in Marathi, so the samples are Marathi cards.
for (const name of fixtures) {
  const ex = JSON.parse(fs.readFileSync(`test/fixtures/${name}.json`, 'utf8'));
  const card = buildCard(ex, { lang: 'mr', today });
  fs.writeFileSync(`samples/${name}.json`, `${JSON.stringify(card, null, 2)}\n`);
}
console.log(`Wrote ${fixtures.length} sample cards to samples/ (today = ${today})`);
