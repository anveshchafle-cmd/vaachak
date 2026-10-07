// Small string helpers shared by the server and the browser (no Node APIs here).

export function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Fixes the usual OCR mix-ups inside numbers: O→0, l/I/|→1, S→5, B→8 (only next to digits).
export function fixOcrDigits(text) {
  return String(text || '')
    .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1')
    .replace(/(?<=\d)S(?=\d)/g, '5')
    .replace(/(?<=\d)B(?=\d)/g, '8');
}

// Lowercase word tokens, letters and digits only.
export function words(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

// Real OCR output has a reasonable amount of letters and digits; junk from a blurry photo does not.
export function isUsableOcr(text) {
  return (String(text || '').match(/[A-Za-z0-9]/g) || []).length >= 25;
}
