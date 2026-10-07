export const LANGS = ['mr', 'hi', 'en'];

export const LANG_NAMES = { mr: 'Marathi', hi: 'Hindi', en: 'English' };

export function normalizeLang(lang) {
  return LANGS.includes(lang) ? lang : 'mr';
}

// Everything the rule engine says on its own, without asking the AI.
const MESSAGES = {
  en: {
    lowConfidence: "I can't read this clearly. Please ask someone to check it.",
    expired: 'This medicine has expired. Do not take it.',
    expiredAction: 'Do not take this. Show it to the chemist.',
    overdue: 'The last date has already passed. Pay soon to avoid more fine.',
    urgent: (d) => (d === 0 ? 'Today is the last day.' : d === 1 ? 'Only 1 day left.' : `Only ${d} days left.`),
    scam: 'Warning! This looks like a fraud message.',
    scamAction: "Do not call, do not pay, do not share any OTP. Ask your family first.",
    spike: (r) => `This bill is ${r} times bigger than last time. Ask someone before paying.`,
    lastDate: 'Last date',
    amountIs: 'Amount',
    waHeader: '📄 Vaachak read this document for me:',
    waAsk: 'Should I pay / do this? Please reply YES or NO.',
    reminder: 'Reminder from Vaachak',
    pills: ({ morning, noon, night, food }) =>
      `Morning ${morning}, afternoon ${noon}, night ${night}` +
      (food === 'before' ? ', before food.' : food === 'after' ? ', after food.' : '.'),
    notInDocument: 'This is not written in the document. Please ask your family.',
    reasons: {
      OTP_REQUEST: 'It asks for an OTP or PIN. Real companies never ask for an OTP.',
      REMOTE_APP: 'It asks you to install an app. Do not do this.',
      PERSONAL_NUMBER: 'It asks you to call a private mobile number, not an official helpline.',
      UNOFFICIAL_LINK: 'The link is not an official website.',
      THREAT_URGENCY: 'It threatens to cut your service today. This hurry is a sign of fraud.',
      KYC: 'It asks you to update KYC. This is usually a fraud.',
      PERSONAL_UPI: 'It asks you to pay to a personal UPI ID.',
      PRIZE: 'It promises a prize or lottery.',
    },
  },
  mr: {
    lowConfidence: 'मला हे नीट वाचता येत नाही. कृपया कोणालातरी विचारा.',
    expired: 'या औषधाची मुदत संपली आहे. हे औषध घेऊ नका.',
    expiredAction: 'हे औषध घेऊ नका. केमिस्टला दाखवा.',
    overdue: 'शेवटची तारीख निघून गेली आहे. जास्त दंड टाळण्यासाठी लवकर भरा.',
    urgent: (d) => (d === 0 ? 'आज शेवटचा दिवस आहे.' : d === 1 ? 'फक्त 1 दिवस बाकी आहे.' : `फक्त ${d} दिवस बाकी आहेत.`),
    scam: 'सावधान! हा फसवणुकीचा मेसेज वाटतो.',
    scamAction: 'फोन करू नका, पैसे भरू नका, कोणालाही OTP सांगू नका. आधी घरच्यांना विचारा.',
    spike: (r) => `हे बिल मागच्या वेळेपेक्षा ${r} पट जास्त आहे. भरण्याआधी कोणालातरी विचारा.`,
    lastDate: 'शेवटची तारीख',
    amountIs: 'रक्कम',
    waHeader: '📄 वाचकने माझ्यासाठी हे कागद वाचले:',
    waAsk: 'हे भरू / करू का? कृपया YES किंवा NO लिहून उत्तर द्या.',
    reminder: 'वाचक आठवण',
    pills: ({ morning, noon, night, food }) =>
      `सकाळी ${morning}, दुपारी ${noon}, रात्री ${night}` +
      (food === 'before' ? ', जेवणाआधी.' : food === 'after' ? ', जेवणानंतर.' : '.'),
    notInDocument: 'हे या कागदात लिहिलेले नाही. कृपया घरच्यांना विचारा.',
    reasons: {
      OTP_REQUEST: 'OTP किंवा PIN मागितला आहे. खरी कंपनी कधीही OTP मागत नाही.',
      REMOTE_APP: 'फोनवर अ‍ॅप डाउनलोड करायला सांगितले आहे. असे करू नका.',
      PERSONAL_NUMBER: 'खाजगी मोबाईल नंबरवर फोन करायला सांगितले आहे. हा अधिकृत हेल्पलाइन नंबर नाही.',
      UNOFFICIAL_LINK: 'ही लिंक अधिकृत वेबसाइटची नाही.',
      THREAT_URGENCY: 'आजच सेवा बंद करण्याची धमकी आहे. अशी घाई फसवणुकीचे लक्षण आहे.',
      KYC: 'KYC अपडेट करायला सांगितले आहे. हे बहुतेक वेळा फसवणूक असते.',
      PERSONAL_UPI: 'पैसे खाजगी UPI आयडीवर भरायला सांगितले आहे.',
      PRIZE: 'बक्षीस किंवा लॉटरीचे आमिष दाखवले आहे.',
    },
  },
  hi: {
    lowConfidence: 'मैं इसे ठीक से नहीं पढ़ पा रहा हूँ. कृपया किसी से पूछ लीजिए.',
    expired: 'इस दवाई की तारीख निकल चुकी है. यह दवाई मत लीजिए.',
    expiredAction: 'यह दवाई मत लीजिए. केमिस्ट को दिखाइए.',
    overdue: 'आखिरी तारीख निकल चुकी है. ज़्यादा जुर्माने से बचने के लिए जल्दी भरिए.',
    urgent: (d) => (d === 0 ? 'आज आखिरी दिन है.' : d === 1 ? 'सिर्फ़ 1 दिन बचा है.' : `सिर्फ़ ${d} दिन बचे हैं.`),
    scam: 'सावधान! यह धोखाधड़ी का मैसेज लगता है.',
    scamAction: 'फ़ोन मत कीजिए, पैसे मत भरिए, किसी को OTP मत बताइए. पहले घरवालों से पूछिए.',
    spike: (r) => `यह बिल पिछली बार से ${r} गुना ज़्यादा है. भरने से पहले किसी से पूछिए.`,
    lastDate: 'आखिरी तारीख',
    amountIs: 'रकम',
    waHeader: '📄 वाचक ने मेरे लिए यह कागज़ पढ़ा:',
    waAsk: 'क्या मैं इसे भरूँ / करूँ? कृपया YES या NO लिखकर जवाब दीजिए.',
    reminder: 'वाचक रिमाइंडर',
    pills: ({ morning, noon, night, food }) =>
      `सुबह ${morning}, दोपहर ${noon}, रात ${night}` +
      (food === 'before' ? ', खाने से पहले.' : food === 'after' ? ', खाने के बाद.' : '.'),
    notInDocument: 'यह इस कागज़ में नहीं लिखा है. कृपया घरवालों से पूछिए.',
    reasons: {
      OTP_REQUEST: 'OTP या PIN माँगा गया है. असली कंपनी कभी OTP नहीं माँगती.',
      REMOTE_APP: 'फ़ोन पर ऐप डाउनलोड करने को कहा गया है. ऐसा मत कीजिए.',
      PERSONAL_NUMBER: 'किसी निजी मोबाइल नंबर पर फ़ोन करने को कहा गया है. यह सरकारी हेल्पलाइन नहीं है.',
      UNOFFICIAL_LINK: 'यह लिंक किसी आधिकारिक वेबसाइट की नहीं है.',
      THREAT_URGENCY: 'आज ही सेवा बंद करने की धमकी दी गई है. ऐसी जल्दबाज़ी धोखाधड़ी का संकेत है.',
      KYC: 'KYC अपडेट करने को कहा गया है. यह अक्सर धोखाधड़ी होती है.',
      PERSONAL_UPI: 'पैसे किसी निजी UPI आईडी पर भरने को कहा गया है.',
      PRIZE: 'इनाम या लॉटरी का लालच दिया गया है.',
    },
  },
};

export function messages(lang) {
  return MESSAGES[normalizeLang(lang)];
}
