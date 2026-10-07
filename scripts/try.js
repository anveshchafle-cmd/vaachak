// Send a real photo/PDF to the running local server and print the card.
// Usage: npm run try -- "C:\path\to\bill.jpg" [mr|hi|en]
import fs from 'node:fs';
import path from 'node:path';

const [file, lang = 'mr'] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npm run try -- <image-or-pdf> [mr|hi|en]');
  process.exit(1);
}

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.pdf': 'application/pdf' };
const type = TYPES[path.extname(file).toLowerCase()];
if (!type) {
  console.error('Unsupported file type. Use jpg, png, webp, heic or pdf.');
  process.exit(1);
}

const base = process.env.API_URL || 'http://localhost:3000';
const form = new FormData();
form.append('file', new Blob([fs.readFileSync(file)], { type }), path.basename(file));
form.append('lang', lang);

const started = Date.now();
const res = await fetch(`${base}/api/read`, { method: 'POST', body: form });
const card = await res.json();
console.log(`HTTP ${res.status} in ${Date.now() - started} ms\n`);
if (!res.ok) {
  console.log(card);
  process.exit(1);
}

for (const [k, f] of Object.entries(card.fields)) {
  const extra = [f.source === 'rule' ? 'RULE' : `${Math.round(f.confidence * 100)}%`, f.verified === false ? 'NOT VERIFIED' : '', f.box ? 'box' : '']
    .filter(Boolean)
    .join(', ');
  console.log(`${k.padEnd(9)} ${f.text || '—'}  (${extra})`);
}
console.log(`\nflags     ${card.flags.join(', ') || 'none'}`);
if (card.scam.reasons.length) console.log(`scam      score ${card.scam.score}: ${card.scam.reasons.map((r) => r.code).join(', ')}`);
if (card.pills) console.log(`pills     ${JSON.stringify(card.pills)}`);
console.log(`\nspeak     ${card.speak}`);
