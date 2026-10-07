// Prepares public/ for the demo page: bundles the offline rule engine for the browser and copies
// the sample cards + offline voice clips. Run after changing lib/ or samples/: npm run public
import { execSync } from 'node:child_process';
import fs from 'node:fs';

execSync('npx -y esbuild lib/offline.js --bundle --format=esm --platform=browser --minify --outfile=public/vaachak-offline.js', {
  stdio: 'inherit',
});

fs.mkdirSync('public/samples/audio', { recursive: true });
for (const f of fs.readdirSync('samples')) {
  if (f.endsWith('.json') || f.endsWith('.wav')) fs.copyFileSync(`samples/${f}`, `public/samples/${f}`);
}
for (const f of fs.readdirSync('samples/audio')) fs.copyFileSync(`samples/audio/${f}`, `public/samples/audio/${f}`);
console.log('public/ ready');
