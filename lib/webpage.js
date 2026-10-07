// Reads "digital content" from a link: an e-bill page, a government notice, a PDF.
// Guards against links that point inside private networks (SSRF), oversized pages and slow sites.
import dns from 'node:dns/promises';
import net from 'node:net';
import { HttpError } from './http.js';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'BAD_URL', 'That is not a valid link');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpError(400, 'BAD_URL', 'Only http and https links are allowed');
  if (url.port && !['80', '443'].includes(url.port)) throw new HttpError(400, 'BAD_URL', 'Links with unusual ports are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new HttpError(400, 'BAD_URL', 'Could not find that website');
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new HttpError(400, 'BAD_URL', 'That link is not allowed');
  return url;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rupee: '₹' };

// Visible text of an HTML page, with line breaks where blocks end.
export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/th|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n[\s\n]*/g, '\n')
    .trim()
    .slice(0, 30_000);
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'TOO_LARGE', 'That page is too big to read');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// → { kind: 'text', text, url } for web pages, { kind: 'file', bytes, mimeType, url } for PDFs/images.
export async function fetchDocument(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Vaachak accessibility reader)', Accept: 'text/html,application/pdf,image/*;q=0.9,*/*;q=0.5' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new HttpError(504, 'URL_UNREACHABLE', `Could not open that link (${e.name})`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url).href);
      continue;
    }
    if (!res.ok) throw new HttpError(502, 'URL_ERROR', `That website answered ${res.status}`);

    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const body = await readCapped(res);
    if (type === 'application/pdf' || type.startsWith('image/')) return { kind: 'file', bytes: body, mimeType: type, url: url.href };
    if (type.includes('html') || type.startsWith('text/')) {
      const raw = body.toString('utf8');
      const text = type.includes('html') ? htmlToText(raw) : raw.slice(0, 30_000);
      if (text.replace(/\s/g, '').length < 20) throw new HttpError(422, 'URL_EMPTY', 'That page has no readable text (it may need a login)');
      return { kind: 'text', text, url: url.href };
    }
    throw new HttpError(415, 'BAD_TYPE', 'That link is not a web page, PDF or image');
  }
  throw new HttpError(508, 'URL_LOOP', 'That link redirects too many times');
}
