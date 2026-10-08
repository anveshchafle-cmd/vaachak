import { useEffect, useLayoutEffect, useState } from 'react';
import { makeT } from './i18n';
import { speak, stopVoice } from './voice';
import Icon from './Icons';

const LANGS = [['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'English']];

// Each step points at one part of the home screen (by id) and is read aloud in the chosen language.
const STEPS = {
  mr: [
    [null, 'नमस्कार! मी वाचक.', 'मी तुमची बिले, औषधे आणि मेसेज वाचून सांगतो की नक्की काय करायचं. चला, एक छोटी फेरी मारूया.'],
    ['tour-snap', 'फोटो काढा', 'कोणतेही बिल, औषधाची पट्टी किंवा सरकारी कागद कॅमेऱ्यासमोर धरा. प्रकाश कमी असेल तर मी सांगेन, आणि फोटो आपोआप काढेन.'],
    ['tour-call', 'फोन कॉल तपासा', 'कोणी फोन करून पोलीस, बँक किंवा लॉटरीच्या नावाने पैसे किंवा OTP मागितले? इथे दाबा आणि त्याने काय सांगितले ते बोला. फसवणूक असेल तर मी लगेच सांगेन आणि घरच्यांना कळवेन.'],
    ['tour-upload', 'स्क्रीनशॉट किंवा PDF', 'फोनमधला स्क्रीनशॉट, ई-बिल किंवा PDF इथून निवडा.'],
    ['tour-paste', 'मेसेज किंवा लिंक', 'संशयास्पद SMS, WhatsApp मेसेज किंवा लिंक इथे पेस्ट करा. फसवणूक असेल तर मी लगेच लाल रंगात सावध करेन, आणि खरा हेल्पलाइन नंबर देईन.'],
    ['tour-samples', 'नमुना पाहा', 'एखादा नमुना दाबून पाहा. मी कागद मोठ्याने वाचेन: काय आहे, काय करायचं, कधीपर्यंत आणि किती पैसे. तुम्ही बोलून प्रश्नही विचारू शकता.'],
    ['tour-papers', 'माझे कागद', 'तुम्ही वाचलेली बिले आणि औषधे इथे राहतात. शेवटची तारीख जवळ आली, की इथे दिसेल. औषधांची रोजची आठवणही लावता येते.'],
    ['tour-settings', 'नाव आणि घरच्यांचा नंबर', 'इथे तुमचे नाव आणि घरच्यांचा WhatsApp नंबर टाका. मग एका बटणाने कागद त्यांना पाठवून विचारता येईल.'],
    ['tour-help', 'मदत', 'ही माहिती पुन्हा ऐकायची असेल, तर हे बटण दाबा. चला, सुरू करूया!'],
  ],
  hi: [
    [null, 'नमस्ते! मैं वाचक हूँ.', 'मैं आपके बिल, दवाइयाँ और मैसेज पढ़कर बताता हूँ कि ठीक क्या करना है. चलिए, एक छोटा सा परिचय देखते हैं.'],
    ['tour-snap', 'फ़ोटो लें', 'कोई भी बिल, दवा की पट्टी या सरकारी कागज़ कैमरे के सामने रखिए. रोशनी कम हो तो मैं बताऊँगा, और फ़ोटो अपने आप ले लूँगा.'],
    ['tour-call', 'फ़ोन कॉल जाँचें', 'किसी ने पुलिस, बैंक या लॉटरी के नाम पर फ़ोन करके पैसे या OTP माँगे? यहाँ दबाइए और बताइए उसने क्या कहा. धोखा हो तो मैं तुरंत बताऊँगा और घरवालों को खबर कर दूँगा.'],
    ['tour-upload', 'स्क्रीनशॉट या PDF', 'फ़ोन में रखा स्क्रीनशॉट, ई-बिल या PDF यहाँ से चुनिए.'],
    ['tour-paste', 'मैसेज या लिंक', 'शक वाला SMS, WhatsApp मैसेज या लिंक यहाँ पेस्ट कीजिए. धोखा हो तो मैं तुरंत लाल रंग में सावधान करूँगा, और असली हेल्पलाइन नंबर दूँगा.'],
    ['tour-samples', 'नमूना देखें', 'कोई नमूना दबाकर देखिए. मैं कागज़ ज़ोर से पढ़ूँगा: क्या है, क्या करना है, कब तक और कितने पैसे. आप बोलकर सवाल भी पूछ सकते हैं.'],
    ['tour-papers', 'मेरे कागज़', 'आपके पढ़े हुए बिल और दवाइयाँ यहाँ रहती हैं. आखिरी तारीख पास आए तो यहाँ दिखेगा. दवा की रोज़ की याद भी लगा सकते हैं.'],
    ['tour-settings', 'नाम और घरवालों का नंबर', 'यहाँ अपना नाम और घरवालों का WhatsApp नंबर डालिए. फिर एक बटन से कागज़ उन्हें भेजकर पूछ सकते हैं.'],
    ['tour-help', 'मदद', 'यह जानकारी फिर से सुननी हो तो यह बटन दबाइए. चलिए, शुरू करते हैं!'],
  ],
  en: [
    [null, 'Hello! I am Vaachak.', 'I read your bills, medicines and messages, and tell you exactly what to do. Let me show you around.'],
    ['tour-snap', 'Take a photo', 'Hold any bill, medicine strip or government letter in front of the camera. I will tell you if the light is low, and take the photo by myself.'],
    ['tour-call', 'Check a phone call', 'Did someone call in the name of police, a bank or a lottery and ask for money or an OTP? Tap here and tell me what they said. If it is a fraud, I tell you at once and help you alert your family.'],
    ['tour-upload', 'Screenshot or PDF', 'Pick a screenshot, an e-bill or a PDF from your phone here.'],
    ['tour-paste', 'Message or link', 'Paste a suspicious SMS, WhatsApp message or link here. If it is a scam, I warn you in red right away and give you the real helpline number.'],
    ['tour-samples', 'Try a sample', 'Tap a sample to see me work. I read it aloud: what it is, what to do, by when and how much. You can also ask me questions by voice.'],
    ['tour-papers', 'My papers', 'Bills and medicines you read stay here. When a last date comes close, you will see it here. You can also set daily medicine reminders.'],
    ['tour-settings', 'Your name and family number', "Add your name and a family member's WhatsApp number here. Then one button sends them the document to check."],
    ['tour-help', 'Help', 'Tap this button any time to hear this again. Let us begin!'],
  ],
};

export default function Tour({ lang, onLang, onDone }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const t = makeT(lang);
  const steps = STEPS[lang] || STEPS.en;
  const [target, title, body] = steps[i];
  const last = i === steps.length - 1;

  // Follow the highlighted button while the page scrolls it into view.
  useLayoutEffect(() => {
    const el = target && document.getElementById(target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let frame;
    const started = performance.now();
    const track = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      if (performance.now() - started < 900) frame = requestAnimationFrame(track);
    };
    track();
    const onResize = () => track();
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', onResize);
    };
  }, [target]);

  // Read every step aloud. The welcome waits for the first tap (phones block sound before it).
  useEffect(() => {
    if (i > 0) speak(`${title} ${body}`, lang);
  }, [i, lang, title, body]);

  const chooseLang = (code) => {
    onLang(code);
    const [, ttl, txt] = (STEPS[code] || STEPS.en)[0];
    speak(`${ttl} ${txt}`, code);
  };

  const finish = () => {
    stopVoice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onDone();
  };
  const next = () => (last ? finish() : setI(i + 1));

  const pad = 8;
  const below = !rect || rect.top + rect.height / 2 < innerHeight * 0.5;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      {rect ? (
        <div
          className="absolute rounded-[28px] ring-4 ring-turmeric pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(20,33,61,.74)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/75" />
      )}

      <div
        className={`absolute inset-x-0 mx-auto max-w-[460px] px-4 ${rect ? (below ? 'bottom-4' : 'top-4') : 'top-1/2 -translate-y-1/2'}`}
      >
        <div className="slip px-5 pb-5 shadow-2xl">
          <div className="flex gap-1.5 pt-3" aria-hidden="true">
            {steps.map((_, k) => (
              <span key={k} className={`h-2 rounded-full ${k === i ? 'w-7 bg-stamp' : 'w-2 bg-ink/20'}`} />
            ))}
          </div>
          <h2 className="font-display text-[30px] leading-tight text-stamp mt-3">{title}</h2>
          <p className="text-[20px] leading-snug mt-2">{body}</p>

          {i === 0 && (
            <div className="mt-4">
              <p className="text-[18px] font-bold text-ink-soft mb-2">{t('tourChoose')}</p>
              <div role="radiogroup" className="grid grid-cols-3 gap-2">
                {LANGS.map(([code, label]) => (
                  <button
                    key={code}
                    role="radio"
                    aria-checked={lang === code}
                    onClick={() => chooseLang(code)}
                    className={`min-h-[56px] rounded-2xl text-[20px] font-bold border-2 ${lang === code ? 'bg-stamp text-paper border-stamp' : 'bg-paper text-ink border-ink/25'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button onClick={finish} className="text-[19px] font-bold text-ink-soft px-2 py-3">
              {t('tourSkip')}
            </button>
            <button
              onClick={() => speak(`${title} ${body}`, lang)}
              aria-label={t('listen')}
              className="ml-auto w-14 h-14 rounded-full border-2 border-ink/20 grid place-items-center text-stamp"
            >
              <Icon name="speaker" size={28} />
            </button>
            <button onClick={next} className="press bg-stamp text-paper text-[22px] font-bold rounded-2xl px-7 min-h-[56px]">
              {last ? t('tourStart') : t('tourNext')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
