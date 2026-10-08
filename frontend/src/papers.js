// "My papers": every card the person has read, kept on this phone only, so the home screen can
// say what is due soon ("MSEDCL bill: 2 days left", "Dolo course: 3 more days").
import { load, save } from './storage';
import { todayIST, daysBetween, addDays } from '../../lib/rules.js';

const KEY = 'vaachak.papers';
const MAX = 12;

function paperId(card) {
  const f = card.fields || {};
  return [card.docType, f.what?.text, f.amount?.value, card.dates?.deadline, card.dates?.expiry].join('|');
}

export function savePaper(card) {
  if (!card?.fields?.what?.text) return;
  const id = paperId(card);
  const { extraction, ...slim } = card;
  const old = loadPapers();
  const prev = old.find((p) => p.id === id);
  const paper = { id, savedOn: prev?.savedOn || todayIST(), card: slim };
  save(KEY, [paper, ...old.filter((p) => p.id !== id)].slice(0, MAX));
}

export function loadPapers() {
  const list = load(KEY, []);
  return Array.isArray(list) ? list.filter((p) => p?.card?.fields) : [];
}

export function removePaper(id) {
  save(KEY, loadPapers().filter((p) => p.id !== id));
}

// What needs attention, soonest first: bill deadlines (and up to a week overdue) and running medicine courses.
export function upcoming(papers, today = todayIST()) {
  const items = [];
  for (const p of papers) {
    const c = p.card;
    if (c.flags?.includes('SCAM') || c.flags?.includes('EXPIRED')) continue;
    if (c.dates?.deadline) {
      const days = daysBetween(today, c.dates.deadline);
      if (days >= -7) items.push({ paper: p, kind: 'due', days, amount: c.fields.amount?.text });
    } else if (c.reminders?.length) {
      const longest = Math.max(...c.reminders.map((r) => r.days || 30));
      const days = daysBetween(today, addDays(p.savedOn, longest - 1));
      if (days >= 0) items.push({ paper: p, kind: 'course', days });
    }
  }
  return items.sort((a, b) => a.days - b.days);
}

export function scamsCaught(papers) {
  return papers.filter((p) => p.card.flags?.includes('SCAM')).length;
}
