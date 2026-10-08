import { useEffect, useRef, useState } from 'react';
import { ask, warmApi } from './api';
import { makeT } from './i18n';
import { speak, stopVoice, offlineClip } from './voice';
import { rememberBill } from './storage';
import { savePaper } from './papers';
import { doseEvents, encodeReminders, googleCalendarUrl } from '../../lib/reminders.js';
import Icon from './Icons';
import { listen as hearQuestion } from './listen';
import { quickAnswer } from '../../lib/quick-answer.js';

// Only what /api/ask needs, so the question uploads fast (the full card also carries links and the raw extraction).
const askCard = (c) => ({
  lang: c.lang, docType: c.docType, rawText: c.rawText, fields: c.fields, dates: c.dates, flags: c.flags,
  pills: c.pills, medicines: c.medicines, checklist: c.checklist, payment: c.payment,
});

// Severity decides the colour of the verdict slab.
const VERDICT = {
  SCAM: { slab: 'bg-postred text-paper', shake: true },
  EXPIRED: { slab: 'bg-postred text-paper', shake: true },
  URGENT: { slab: 'bg-turmeric text-ink' },
  BILL_SPIKE: { slab: 'bg-turmeric text-ink' },
  LOW_CONFIDENCE: { slab: 'bg-ink text-paper' },
};
const ROWS = ['what', 'action', 'deadline', 'amount', 'warning'];
// iPhone/iPad Safari opens a calendar file with "Add All"; elsewhere we add each dose time on Google Calendar.
const isApple = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

function Action({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`press min-h-[96px] rounded-[22px] flex flex-col items-start justify-between gap-2 p-4 text-left text-[20px] font-bold leading-tight ${
        primary ? 'bg-leaf text-paper' : 'bg-paper text-ink border-2 border-ink'
      }`}
    >
      <Icon name={icon} size={34} className={primary ? '' : 'text-stamp'} />
      {label}
    </button>
  );
}

export default function Card({ card, lang, photoUrl, photoBlob, onAgain }) {
  const t = makeT(lang);
  const flag = card.flags[0];
  const [box, setBox] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const [doseSheet, setDoseSheet] = useState(null);
  const [heard, setHeard] = useState('');
  const listenRef = useRef(null);
  // Every question gets a number; an answer that arrives after a newer question was asked is
  // dropped, so an old answer is never shown or spoken for the new question.
  const askSeq = useRef(0);
  const photoRef = useRef(null);

  // On arrival: remember the bill amount, buzz for danger, and read the card aloud.
  useEffect(() => {
    rememberBill(card);
    if (card.mode !== 'offline') warmApi('ask');
    savePaper(card);
    if (card.alert?.vibrate) navigator.vibrate?.(card.alert.vibrate);
    const clip = card.mode === 'offline' || !photoUrl ? offlineClip(card, lang) : null;
    speak(card.speak, lang, clip);
    return () => stopVoice();
  }, [card, lang, photoUrl]);

  // Leaving the card: stop listening and forget any answer still on its way.
  useEffect(
    () => () => {
      askSeq.current++;
      listenRef.current?.stop();
    },
    [],
  );

  const listen = () => speak(card.speak, lang, offlineClip(card, lang));

  const showWhere = (b) => {
    setBox(b);
    setTimeout(() => photoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const pay = () => {
    setConfirm(card.payment.confirmText);
    speak(card.payment.confirmText, lang);
  };
  const confirmPay = async () => {
    const p = card.payment;
    setConfirm(null);
    if (p.upiUrl) {
      location.href = p.upiUrl;
      return;
    }
    // No await before window.open: iPhone Safari blocks a new tab that isn't opened right in the tap.
    if (p.copyText) navigator.clipboard?.writeText(p.copyText).catch(() => {});
    if (p.officialUrl) window.open(p.officialUrl, '_blank', 'noopener');
    if (p.copyText && p.copiedText) speak(p.copiedText, lang);
  };

  // Photo + summary through the phone's share sheet (WhatsApp); a wa.me link when files can't be shared.
  const sendFamily = async () => {
    const text = card.actions.whatsappText;
    if (photoBlob && navigator.canShare) {
      const file = new File([photoBlob], photoBlob.type === 'application/pdf' ? 'document.pdf' : 'document.jpg', { type: photoBlob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return; // they closed the share sheet
        }
      }
    }
    window.open(card.actions.whatsappUrl, '_blank', 'noopener');
  };

  const sendQuestion = async ({ question: q, audio }) => {
    const mine = ++askSeq.current;
    stopVoice();
    setHeard(q || '');
    setAnswer(t('thinking'));
    try {
      const slim = askCard(card);
      const res = audio ? await ask({ audio, card: JSON.stringify(slim), lang }, true) : await ask({ question: q, card: slim, lang });
      if (mine !== askSeq.current) return;
      if (res.heard) setHeard(res.heard);
      setAnswer(res.answer);
      speak(res.speak, lang);
    } catch {
      if (mine !== askSeq.current) return;
      // Server busy or slow: the common questions (amount, last date, number) are answered from the card itself.
      const local = quickAnswer(q, card, lang);
      setAnswer(local || t('error'));
      if (local) speak(local, lang);
    }
  };

  const toggleMic = async () => {
    if (listenRef.current) {
      listenRef.current.stop();
      return;
    }
    stopVoice();
    askSeq.current++;
    const session = hearQuestion({ lang, onWords: setHeard });
    listenRef.current = session;
    setRecording(true);
    setHeard('');
    setAnswer(t('listening'));
    try {
      const { text, audio } = await session.result;
      if (text) sendQuestion({ question: text });
      else if (audio?.size > 2000) sendQuestion({ audio });
      else setAnswer(t('notHeard'));
    } catch {
      setAnswer(t('error'));
    } finally {
      listenRef.current = null;
      setRecording(false);
    }
  };

  const typeQuestion = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    sendQuestion({ question: q });
  };

  const setReminders = () => {
    if (isApple()) {
      location.href = `/api/reminders?lang=${card.lang}&d=${encodeReminders(card.reminders)}`;
      return;
    }
    setDoseSheet(doseEvents(card.reminders, { lang: card.lang }));
  };
  const dosesPerDay = (card.reminders || []).reduce((n, r) => n + [r.morning, r.noon, r.night].filter((x) => x > 0).length, 0);

  const consensus = card.consensus;

  const verdict = flag && VERDICT[flag];

  return (
    <div className="inland min-h-screen px-4 pt-5 pb-10" aria-live="polite">
      {verdict && (
        <section className={`${verdict.slab} rounded-[26px] px-5 pt-6 pb-5 mb-5 ${verdict.shake ? 'shake' : ''}`} role="alert">
          <h2 className="thump stamp text-[40px] origin-left">{t(`b_${flag}`)}</h2>
          {flag !== 'LOW_CONFIDENCE' && card.fields.warning?.text && <p className="text-[22px] font-bold mt-4 leading-snug">{card.fields.warning.text}</p>}
          {flag === 'LOW_CONFIDENCE' && <p className="text-[22px] font-bold mt-4 leading-snug">{card.speak}</p>}
          {flag === 'SCAM' && card.scam.reasons.length > 0 && (
            <ul className="mt-3 space-y-2 text-[19px] leading-snug">
              {card.scam.reasons.map((r) => (
                <li key={r.code} className="flex gap-2"><span aria-hidden="true">✗</span><span>{r.text}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {card.helplines?.length > 0 && (
        <section className="mb-5 bg-paper rounded-[26px] p-4 border-[3px] border-postred">
          <h3 className="font-display text-[24px] text-postred mb-3">{t('callTitle')}</h3>
          <div className="space-y-3">
            {card.helplines.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number.replace(/\s/g, '')}`}
                className={`press flex items-center gap-4 rounded-[20px] px-4 py-4 ${h.kind === 'cyber' ? 'bg-postred text-paper' : 'bg-ink text-paper'}`}
              >
                <Icon name="phone" size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-[30px] leading-none">{h.number}</span>
                  <span className="block text-[17px] font-bold mt-1 leading-snug">{h.label}</span>
                </span>
                <span className="text-[19px] font-bold">{t('call')}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {(card.mode === 'offline' || consensus?.label) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {card.mode === 'offline' && card.offline?.note && (
            <span className="bg-ink text-paper rounded-full px-4 py-1 text-[16px] font-bold">{card.offline.note}</span>
          )}
          {consensus?.label && (
            <span className={`rounded-full px-4 py-1 text-[16px] font-bold ${consensus.badge ? 'bg-leaf text-paper' : 'bg-turmeric text-ink'}`}>
              {consensus.label}
            </span>
          )}
        </div>
      )}

      <article className="slip px-5 pb-2">
        {ROWS.map((key) => {
          const f = card.fields[key];
          if (!f?.text) return null;
          if (key === 'warning' && (flag === 'SCAM' || flag === 'EXPIRED')) return null;
          const canShow = Boolean(f.box && photoUrl);
          const Row = canShow ? 'button' : 'div';
          return (
            <Row
              key={key}
              onClick={canShow ? () => showWhere(f.box) : undefined}
              className="block w-full text-left py-4 border-b-2 border-dashed border-ink/15 last:border-b-0"
            >
              <span className="block text-[17px] font-medium text-ink-soft">{t(key)}</span>
              {key === 'amount' ? (
                <span className="block font-display text-[56px] leading-none text-stamp mt-1">{f.text}</span>
              ) : (
                <span className="block text-[25px] font-bold leading-snug break-words">{f.text}</span>
              )}
              {(f.source === 'rule' || f.confidence < 0.6 || canShow) && (
                <span className="flex flex-wrap items-center gap-3 mt-2">
                  {f.source === 'rule' && <span className="stamp stamp-sm text-leaf">{t('checked')}</span>}
                  {f.confidence < 0.6 && <span className="stamp stamp-sm text-postred">{t('unclear')}</span>}
                  {canShow && (
                    <span className="inline-flex items-center gap-1 text-[16px] font-bold text-stamp underline underline-offset-4">
                      <Icon name="eye" size={20} /> {t('where')}
                    </span>
                  )}
                </span>
              )}
            </Row>
          );
        })}
      </article>

      {card.medicines && (
        <section className="mt-5 space-y-3">
          {card.medicines.map((m, i) => (
            <div key={`${m.name}-${i}`} className="bg-ink rounded-[22px] p-3 text-paper">
              <p className="font-display text-[24px] leading-tight px-1 break-words">{m.name}</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[['sun', m.morning, 'morning'], ['noon', m.noon, 'noon'], ['moon', m.night, 'night']].map(([icon, n, key]) => (
                  <div key={key} className={`rounded-2xl py-2 flex flex-col items-center ${n > 0 ? 'bg-turmeric text-ink' : 'bg-ink-soft/60 text-paper/70'}`}>
                    <Icon name={icon} size={28} />
                    <span className="font-display text-[36px] leading-none mt-1">{n}</span>
                    <span className="text-[16px] font-bold">{t(key)}</span>
                  </div>
                ))}
              </div>
              {m.food !== 'any' && (
                <p className="flex items-center gap-2 text-[19px] font-bold mt-2 px-1">
                  <Icon name="plate" size={26} className="text-turmeric" /> {t(m.food)}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {card.pills && (
        <section className="mt-5">
          <div className="grid grid-cols-3 gap-2 bg-ink p-2 rounded-[22px]">
            {[['sun', card.pills.morning, 'morning'], ['noon', card.pills.noon, 'noon'], ['moon', card.pills.night, 'night']].map(([icon, n, key]) => (
              <div key={key} className={`rounded-2xl py-3 flex flex-col items-center ${n > 0 ? 'bg-turmeric text-ink' : 'bg-ink-soft/60 text-paper/70'}`}>
                <Icon name={icon} size={34} />
                <span className="font-display text-[46px] leading-none mt-1">{n}</span>
                <span className="text-[17px] font-bold">{t(key)}</span>
              </div>
            ))}
          </div>
          {card.pills.food !== 'any' && (
            <p className="flex items-center gap-2 text-[22px] font-bold mt-3">
              <Icon name="plate" size={30} className="text-stamp" /> {t(card.pills.food)}
            </p>
          )}
        </section>
      )}

      {card.checklist && (
        <section className="slip px-5 pb-4 mt-5">
          <h3 className="font-display text-[24px] mt-2 mb-2">{t('carry')}</h3>
          <ul className="space-y-2 text-[21px]">
            {card.checklist.map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span className="mt-1 w-6 h-6 shrink-0 rounded border-[3px] border-ink" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.reminders?.length > 0 && !card.flags.includes('EXPIRED') && (
        <button onClick={setReminders} className="press w-full mt-5 bg-leaf text-paper rounded-[22px] p-4 flex items-center gap-4 text-left">
          <Icon name="alarm" size={40} />
          <span>
            <span className="block text-[23px] font-bold leading-tight">{t('medRemind')}</span>
            <span className="block text-[17px] mt-1">{t('medRemindSub')(dosesPerDay)}</span>
          </span>
        </button>
      )}

      {card.janAushadhi && (
        <section className="mt-5 rounded-[22px] p-4 bg-turmeric/25 border-2 border-turmeric">
          <h3 className="flex items-center gap-2 font-display text-[22px]"><Icon name="pill" size={26} className="text-leaf" /> {t('cheaper')}</h3>
          <p className="text-[19px] font-medium mt-1 leading-snug">{card.janAushadhi}</p>
        </section>
      )}

      {photoUrl && (
        <div ref={photoRef} className="relative mt-5 rounded-[18px] overflow-hidden border-4 border-paper shadow-lg">
          <img src={photoUrl} alt="" className="w-full block" />
          {box && (
            <div
              className="absolute border-4 border-turmeric rounded-md transition-all"
              style={{ top: `${box[0] / 10}%`, left: `${box[1] / 10}%`, height: `${(box[2] - box[0]) / 10}%`, width: `${(box[3] - box[1]) / 10}%`, boxShadow: '0 0 0 9999px rgba(20,33,61,.5)' }}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Action icon="speaker" label={t('listen')} onClick={listen} />
        {card.payment && <Action icon="pay" label={t('pay')} onClick={pay} primary />}
        <Action icon="family" label={t('family')} onClick={sendFamily} />
        {card.actions?.calendarUrl && <Action icon="alarm" label={t('remind')} onClick={() => window.open(card.actions.calendarUrl, '_blank', 'noopener')} />}
      </div>

      {card.mode !== 'offline' && (
        <section className="mt-6 bg-stamp rounded-[26px] p-4 text-paper">
          <button
            onClick={toggleMic}
            className={`w-full min-h-[76px] rounded-[20px] text-[24px] font-bold flex items-center justify-center gap-3 ${recording ? 'bg-postred animate-pulse' : 'bg-paper text-stamp'}`}
          >
            <Icon name="mic" size={32} /> {recording ? t('stop') : t('mic')}
          </button>
          <div className="flex gap-2 mt-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && typeQuestion()}
              placeholder={t('askPh')}
              aria-label={t('askPh')}
              className="flex-1 min-w-0 px-4 py-3 text-[19px] rounded-2xl bg-paper/15 text-paper placeholder:text-paper/70 border-2 border-paper/30 focus:border-paper outline-none"
            />
            <button
              onClick={typeQuestion}
              className="bg-turmeric text-ink text-[19px] font-bold rounded-2xl px-4 min-h-[56px]"
            >
              {t('askBtn')}
            </button>
          </div>
          {heard && (
            <p className="text-[18px] mt-4 leading-snug text-paper/85">
              <span className="font-bold">{t('youAsked')}:</span> {heard}
            </p>
          )}
          {answer && <p className="text-[22px] font-bold mt-3 leading-snug" aria-live="polite">{answer}</p>}
        </section>
      )}

      <button onClick={onAgain} className="w-full mt-7 min-h-[68px] rounded-full border-[3px] border-ink text-[22px] font-bold flex items-center justify-center gap-2 active:bg-paper">
        <Icon name="back" size={26} /> {t('again')}
      </button>

      {doseSheet && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setDoseSheet(null)}>
          <div className="slip px-5 pb-5 w-full max-w-[420px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[24px] leading-snug mb-4 mt-3">{t('pickTimes')}</p>
            <ul className="space-y-3">
              {doseSheet.map((e, i) => (
                <li key={i} className="flex items-center gap-3 border-b-2 border-dashed border-ink/15 pb-3">
                  <Icon name={{ morning: 'sun', noon: 'noon', night: 'moon' }[e.slot]} size={30} className="text-stamp shrink-0" />
                  <span className="flex-1 min-w-0 text-[18px] font-bold leading-snug">
                    {e.title.replace('💊 ', '')}
                    <span className="block text-[16px] font-medium text-ink-soft">{e.time} · {t('days')(e.days)}</span>
                  </span>
                  <a href={googleCalendarUrl(e)} target="_blank" rel="noopener" className="press bg-leaf text-paper text-[18px] font-bold rounded-2xl px-4 py-3">{t('add')}</a>
                </li>
              ))}
            </ul>
            <button onClick={() => setDoseSheet(null)} className="w-full mt-4 min-h-[56px] rounded-full border-[3px] border-ink text-[20px] font-bold">{t('close')}</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="slip px-6 pb-6 w-full max-w-[400px] animate-fade-in">
            <p className="font-display text-[28px] leading-snug mb-6 mt-3">{confirm}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={confirmPay} className="press bg-leaf text-paper text-[26px] font-bold rounded-2xl py-5">{t('yes')}</button>
              <button onClick={() => setConfirm(null)} className="press bg-paper border-[3px] border-ink text-ink text-[26px] font-bold rounded-2xl py-5">{t('no')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
