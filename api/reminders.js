// GET /api/reminders?d=<reminders>&lang=mr → a calendar file with every dose of the course.
// On iPhone, opening this link shows "Add All" to the Calendar app; the reminders ride in the link.
import { handle, preflight, binary, HttpError } from '../lib/http.js';
import { decodeReminders, doseEvents, toIcs } from '../lib/reminders.js';
import { normalizeLang } from '../lib/i18n.js';

export const GET = handle(async (req) => {
  const params = new URL(req.url).searchParams;
  const events = doseEvents(decodeReminders(params.get('d')), { lang: normalizeLang(params.get('lang')) });
  if (!events.length) throw new HttpError(400, 'NO_DOSES', 'No medicine doses in this link');
  return binary(toIcs(events), 'text/calendar; charset=utf-8', {
    'Content-Disposition': 'inline; filename="vaachak-medicines.ics"',
  });
});

export const OPTIONS = preflight;
