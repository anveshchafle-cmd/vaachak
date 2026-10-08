// Real numbers to call instead of the one in a scam message. Only numbers we have checked.
// 1930 is the national cyber-fraud helpline: called quickly, it can freeze money that was sent.
export const CYBER_HELPLINE = '1930';

const ORGS = [
  { id: 'msedcl', name: 'MSEDCL (Mahavitaran)', number: '1912', match: /msedcl|mahadiscom|mahavitaran|महावितरण/i },
  { id: 'sbi', name: 'SBI', number: '1800 1234', match: /\bSBI\b|state\s*bank|\byono\b/i },
];

// Which real organisation a scam message is pretending to be, if we know its official helpline.
export function impersonatedOrg(rawText) {
  return ORGS.find((o) => o.match.test(String(rawText || ''))) || null;
}

export function scamHelplines(rawText, t) {
  const org = impersonatedOrg(rawText);
  const list = [{ kind: 'cyber', number: CYBER_HELPLINE, label: t.helpCyber }];
  if (org) list.push({ kind: 'org', number: org.number, label: t.helpOrg(org.name) });
  return list;
}
