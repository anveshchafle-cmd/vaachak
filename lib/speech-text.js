// Turns card text into what a voice should actually say. Shared by the server voice and the
// phone's own voice (no Node APIs here).
// "₹1,740.00" became "pounds" or was skipped by some voices, and emojis/ticks were read out as names.

const RUPEES = { mr: 'रुपये', hi: 'रुपये', en: 'rupees' };

export function forSpeech(text, lang = 'mr') {
  const rupees = RUPEES[lang] || RUPEES.mr;
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(?:₹|\bRs\.?|\bINR)\s*([\d,]+(?:\.\d+)?)(?:\s*\/-)?/gi, (_, n) => `${n.replace(/\.0+$/, '')} ${rupees}`)
    .replace(/([\d,]+)\s*\/-/g, `$1 ${rupees}`)
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️✓✔•*_#]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?।])/g, '$1')
    .trim();
}
