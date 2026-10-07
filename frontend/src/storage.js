// localStorage that never throws (private windows and blocked storage just fall back to defaults).
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return key === 'vaachak.lang' || key === 'vaachak.userName' || key === 'vaachak.familyPhone' ? v : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {}
}

export function settings() {
  return {
    lang: load('vaachak.lang', 'mr'),
    userName: load('vaachak.userName', ''),
    familyPhone: load('vaachak.familyPhone', ''),
    history: load('vaachak.history', {}),
  };
}

// Remember each biller's last amount so the backend can flag a sudden bill spike.
export function rememberBill(card) {
  if (!card?.billerKey || !card.fields?.amount?.value) return;
  const h = load('vaachak.history', {});
  h[card.billerKey] = card.fields.amount.value;
  save('vaachak.history', h);
}
