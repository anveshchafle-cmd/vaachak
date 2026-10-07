import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, isPrivateAddress, fetchDocument } from '../lib/webpage.js';
import { extractPrompt } from '../lib/prompts.js';

test('htmlToText keeps the visible words and drops scripts, styles and tags', () => {
  const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
    <body><h1>MSEDCL e-Bill</h1><p>Consumer No: 000123456789</p>
    <table><tr><td>Net Amount</td><td>&#8377; 1,240.00</td></tr><tr><td>Due&nbsp;Date</td><td>12/10/2026</td></tr></table>
    <!-- hidden --></body></html>`;
  const text = htmlToText(html);
  assert.match(text, /MSEDCL e-Bill/);
  assert.match(text, /₹ 1,240.00/);
  assert.match(text, /Due Date/);
  assert.ok(!/alert|color:red|hidden/.test(text));
});

test('private and local addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.5', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '142.250.183.14', '2404:6800:4009::200e']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('fetchDocument rejects dangerous links before connecting', async () => {
  for (const url of ['file:///etc/passwd', 'http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'ftp://x.com', 'http://example.com:8080/', 'not a url']) {
    await assert.rejects(fetchDocument(url), (e) => e.code === 'BAD_URL', url);
  }
});

test('extraction prompt only asks for highlight boxes on photos', () => {
  assert.match(extractPrompt('mr', 'image'), /\[ymin, xmin, ymax, xmax\]/);
  assert.match(extractPrompt('mr', 'text'), /set every "box" to null/);
  assert.match(extractPrompt('mr', true), /set every "box" to null/, 'old boolean isPdf still works');
});
