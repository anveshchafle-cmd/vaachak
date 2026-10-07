// Pre-records the most important warnings so the frontend can play them with no internet.
// Usage: npm run audio   (needs GEMINI_API_KEY or SARVAM_API_KEY in .env)
import fs from 'node:fs';

for (const line of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { synthesize } = await import('../lib/speech.js');
const { messages } = await import('../lib/i18n.js');

const clips = {
  expired: (t) => t.expired,
  scam: (t) => `${t.scam} ${t.scamAction}`,
  'low-confidence': (t) => t.lowConfidence,
};

fs.mkdirSync('samples/audio', { recursive: true });
for (const lang of ['mr', 'hi']) {
  for (const [name, text] of Object.entries(clips)) {
    const file = `samples/audio/${name}.${lang}.wav`;
    if (fs.existsSync(file) && !process.argv.includes('--force')) {
      console.log(`skip ${file} (exists)`);
      continue;
    }
    const { audio, provider } = await synthesize(text(messages(lang)), lang);
    fs.writeFileSync(file, audio);
    console.log(`wrote ${file} (${provider}, ${Math.round(audio.length / 1024)} KB)`);
  }
}
