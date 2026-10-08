import { createWorker } from 'tesseract.js';

// On-device text reader (the second engine, and the offline fallback). Starting it downloads
// its model and takes a few seconds, so one reader is kept for the whole visit and warmed up
// as soon as the camera opens; after that each photo reads much faster.
let worker = null;

export function warmOcr() {
  worker ||= createWorker('eng').catch(() => {
    worker = null;
    return null;
  });
  return worker;
}

// Resolves to the text, or '' if the reader could not run.
export async function recognize(image) {
  const w = await warmOcr();
  if (!w) return '';
  try {
    return (await w.recognize(image)).data.text || '';
  } catch {
    return '';
  }
}
