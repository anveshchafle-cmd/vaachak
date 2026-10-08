// Local dev server: runs the same handlers as Vercel's /api functions.
// Usage: npm run dev  (reads GEMINI_API_KEY etc. from .env)
import http from 'node:http';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');

function loadEnv(file = '.env') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

// Import after .env is loaded, because these modules read process.env at load time.
const routes = {
  '/api/read': await import('./api/read.js'),
  '/api/ask': await import('./api/ask.js'),
  '/api/tts': await import('./api/tts.js'),
  '/api/health': await import('./api/health.js'),
  '/api/reminders': await import('./api/reminders.js'),
};

const PORT = Number(process.env.PORT) || 3000;

// Serves public/ the way Vercel does, so the demo page works locally too.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const handler = routes[url.pathname]?.[req.method];
    if (!handler && req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveStatic(url.pathname, res);
    if (!handler) {
      res.writeHead(routes[url.pathname] ? 405 : 404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }));
    }

    const headers = Object.entries(req.headers).filter(([, v]) => typeof v === 'string');
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const request = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: 'half',
    });

    const started = Date.now();
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(`${req.method} ${url.pathname} → ${response.status} (${Date.now() - started} ms)`);
  })
  .listen(PORT, () => {
    console.log(`Vaachak backend on http://localhost:${PORT}`);
    if (!process.env.GEMINI_API_KEY) console.warn('⚠️  GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.');
  });
