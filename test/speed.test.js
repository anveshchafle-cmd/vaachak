import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJson } from '../lib/gemini.js';
import { analyzeFrame, assessFrame, frameMotion, THRESHOLDS } from '../lib/viewfinder.js';

process.env.GEMINI_API_KEY ||= 'test-key';

const reply = (obj) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

// Fake Gemini: each model either answers after `ms`, or fails with `status`.
function fakeGemini(models) {
  const calls = [];
  globalThis.fetch = (url, { signal }) => {
    const model = /models\/([^:]+):/.exec(url)[1];
    calls.push(model);
    const m = models[model];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(m.status ? new Response('{}', { status: m.status }) : reply({ model })), m.ms ?? 0);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  };
  return calls;
}

test('gemini: a model out of quota hands over to the next one at once', async () => {
  const calls = fakeGemini({ q1: { status: 429 }, ok1: { ms: 10 } });
  const start = Date.now();
  const res = await generateJson({ system: '', parts: [], schema: {}, models: ['q1', 'ok1'], hedgeMs: 5000 });
  assert.equal(res.model, 'ok1');
  assert.ok(Date.now() - start < 1000);
  assert.deepEqual(calls, ['q1', 'ok1']);
});

test('gemini: a slow model is raced by the next one and the first answer wins', async () => {
  fakeGemini({ slow1: { ms: 3000 }, fast1: { ms: 20 } });
  const start = Date.now();
  const res = await generateJson({ system: '', parts: [], schema: {}, models: ['slow1', 'fast1'], hedgeMs: 100 });
  assert.equal(res.model, 'fast1');
  assert.ok(Date.now() - start < 1000);
});

test('gemini: every model failing gives one clear error', async () => {
  fakeGemini({ q2: { status: 429 }, q3: { status: 429 } });
  await assert.rejects(generateJson({ system: '', parts: [], schema: {}, models: ['q2', 'q3'], hedgeMs: 100 }), { code: 'QUOTA' });
});

const frame = (fn, width = 320, height = 240) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = fn(x, y);
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

test('viewfinder: a moving phone is not "ready" even when the frame looks sharp', () => {
  const a = frame((x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 230 : 60));
  const b = frame((x, y) => ((Math.floor((x + 4) / 4) + Math.floor(y / 4)) % 2 ? 230 : 60));
  const still = { ...analyzeFrame(a), motion: frameMotion(a, a) };
  const moving = { ...analyzeFrame(b), motion: frameMotion(a, b) };
  assert.equal(assessFrame(still), 'ok');
  assert.equal(assessFrame(moving), 'blurry');
});

test('viewfinder: a frame much softer than the sharpest one seen is still "blurry"', () => {
  const stats = { brightness: 200, sharpness: 900, motion: 0 };
  assert.equal(assessFrame(stats), 'ok');
  assert.equal(assessFrame(stats, THRESHOLDS, 3000 * THRESHOLDS.peakShare), 'blurry');
});

test('quick answer: common questions are answered from the card when the server is slow', async () => {
  const { quickAnswer } = await import('../lib/quick-answer.js');
  const card = JSON.parse((await import('node:fs')).readFileSync(new URL('../samples/electricity-bill.json', import.meta.url), 'utf8'));
  assert.match(quickAnswer('किती पैसे भरायचे आहेत?', card, 'mr'), /₹840/);
  assert.match(quickAnswer('शेवटची तारीख कधी आहे?', card, 'mr'), /10 ऑक्टोबर/);
  assert.match(quickAnswer('ग्राहक क्रमांक काय आहे?', card, 'mr'), /\d{6,}/);
  assert.match(quickAnswer('How much do I pay?', card, 'en'), /₹840/);
  assert.equal(quickAnswer('UPI ने भरू शकतो का?', card, 'mr'), null);
  assert.equal(quickAnswer('Can I pay by UPI?', card, 'en'), null);
});
