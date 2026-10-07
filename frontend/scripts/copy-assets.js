// Copies the backend's offline voice clips and the classic demo page into public/,
// so the built site serves them at /samples/... and /classic.html.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(import.meta.dirname, '../public');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, f.name);
    const dst = path.join(to, f.name);
    if (f.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

copyDir(path.join(root, 'public', 'samples'), path.join(out, 'samples'));
fs.copyFileSync(path.join(root, 'public', 'vaachak-offline.js'), path.join(out, 'vaachak-offline.js'));
fs.copyFileSync(path.join(root, 'public', 'index.html'), path.join(out, 'classic.html'));
console.log('assets copied into frontend/public');
