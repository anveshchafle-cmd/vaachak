// Every label on screen, in Marathi, Hindi and English. Card content itself comes translated from the backend.
const T = {
  mr: {
    tagline: 'कोणताही कागद, बिल, औषध किंवा मेसेज: वाचून सांगतो नक्की काय करायचं.',
    snap: 'फोटो काढा', upload: 'स्क्रीनशॉट / PDF', paste: 'मेसेज किंवा लिंक',
    pasteTitle: 'मेसेज किंवा लिंक पेस्ट करा', pastePh: 'इथे SMS, WhatsApp मेसेज किंवा लिंक पेस्ट करा', clip: '📋 पेस्ट', read: 'वाचा', back: 'मागे',
    demoOn: 'डेमो मोड चालू (इंटरनेटशिवाय)', samples: 'नमुना पाहा',
    sBill: 'वीज बिल', sMed: 'जुने औषध', sScam: 'फसवा SMS', sRx: 'चिठ्ठी',
    name: 'तुमचे नाव', namePh: 'उदा. प्रकाश काका', phone: 'घरच्यांचा WhatsApp नंबर', save: 'सेव्ह करा', settings: 'सेटिंग्ज',
    scanning: 'फोटो स्कॅन करत आहे…', reading: 'वाचत आहे…', wait: 'कृपया थांबा, यात थोडा वेळ लागू शकतो…', slow: 'सर्व्हर व्यस्त आहे, थोडा वेळ लागेल…', cancel: 'रद्द करा',
    camDark: 'प्रकाश कमी आहे', camBlurry: 'फोन स्थिर धरा', camOk: 'छान, स्थिर धरा…', capture: 'फोटो घ्या', close: 'बंद करा',
    what: 'काय आहे', action: 'काय करायचं', deadline: 'कधीपर्यंत', amount: 'किती', warning: 'सावधान',
    unclear: 'साफ दिसत नाही', checked: 'नियमाने तपासले', where: 'कागदावर दाखवा',
    listen: 'पुन्हा ऐका', pay: 'बिल भरा', family: 'घरच्यांना पाठवा', remind: 'आठवण', again: 'नवीन कागद',
    askPh: 'प्रश्न विचारा… उदा. UPI ने भरू शकतो का?', askBtn: 'विचारा', mic: 'बोलून विचारा', stop: 'थांबा', listening: 'बोला… थांबवण्यासाठी पुन्हा दाबा',
    yes: 'हो', no: 'नाही', morning: 'सकाळ', noon: 'दुपार', night: 'रात्र', before: 'जेवणाआधी', after: 'जेवणानंतर', carry: 'सोबत न्या',
    b_SCAM: 'फसवणूक!', b_EXPIRED: 'मुदत संपलेले औषध', b_URGENT: 'लवकर करा', b_BILL_SPIKE: 'बिल खूप जास्त', b_LOW_CONFIDENCE: 'साफ दिसत नाही',
    error: 'काहीतरी चुकले. पुन्हा प्रयत्न करा.', linkError: 'ही लिंक उघडता आली नाही. पानाचा स्क्रीनशॉट घेऊन तो फोटो म्हणून पाठवा.', footer: 'वाचक कधीही पैसे किंवा औषधांबद्दल अंदाज लावत नाही.',
  },
  hi: {
    tagline: 'कोई भी कागज़, बिल, दवा या मैसेज: पढ़कर बताता है कि ठीक क्या करना है.',
    snap: 'फ़ोटो लें', upload: 'स्क्रीनशॉट / PDF', paste: 'मैसेज या लिंक',
    pasteTitle: 'मैसेज या लिंक पेस्ट करें', pastePh: 'यहाँ SMS, WhatsApp मैसेज या लिंक पेस्ट करें', clip: '📋 पेस्ट', read: 'पढ़ो', back: 'पीछे',
    demoOn: 'डेमो मोड चालू (बिना इंटरनेट)', samples: 'नमूना देखें',
    sBill: 'बिजली बिल', sMed: 'पुरानी दवा', sScam: 'धोखे का SMS', sRx: 'पर्ची',
    name: 'आपका नाम', namePh: 'जैसे प्रकाश काका', phone: 'घरवालों का WhatsApp नंबर', save: 'सेव करें', settings: 'सेटिंग्स',
    scanning: 'फ़ोटो स्कैन हो रही है…', reading: 'पढ़ रहे हैं…', wait: 'कृपया रुकिए, थोड़ा समय लग सकता है…', slow: 'सर्वर व्यस्त है, थोड़ा समय लगेगा…', cancel: 'रद्द करें',
    camDark: 'रोशनी कम है', camBlurry: 'फ़ोन स्थिर पकड़िए', camOk: 'बढ़िया, स्थिर रखिए…', capture: 'फ़ोटो लें', close: 'बंद करें',
    what: 'क्या है', action: 'क्या करना है', deadline: 'कब तक', amount: 'कितना', warning: 'सावधान',
    unclear: 'साफ़ नहीं दिख रहा', checked: 'नियम से जाँचा', where: 'कागज़ पर दिखाओ',
    listen: 'फिर से सुनें', pay: 'बिल भरें', family: 'घरवालों को भेजें', remind: 'याद दिलाओ', again: 'नया कागज़',
    askPh: 'सवाल पूछिए… जैसे UPI से भर सकते हैं?', askBtn: 'पूछो', mic: 'बोलकर पूछें', stop: 'रुकें', listening: 'बोलिए… रोकने के लिए फिर दबाइए',
    yes: 'हाँ', no: 'नहीं', morning: 'सुबह', noon: 'दोपहर', night: 'रात', before: 'खाने से पहले', after: 'खाने के बाद', carry: 'साथ ले जाएँ',
    b_SCAM: 'धोखाधड़ी!', b_EXPIRED: 'एक्सपायर दवा', b_URGENT: 'जल्दी कीजिए', b_BILL_SPIKE: 'बिल बहुत ज़्यादा', b_LOW_CONFIDENCE: 'साफ़ नहीं दिख रहा',
    error: 'कुछ गड़बड़ हुई. फिर कोशिश करें.', linkError: 'यह लिंक नहीं खुल सकी. पेज का स्क्रीनशॉट लेकर उसे फोटो की तरह भेजें.', footer: 'वाचक पैसे या दवा के बारे में कभी अंदाज़ा नहीं लगाता.',
  },
  en: {
    tagline: 'Any bill, medicine strip or message: read out, with exactly what to do.',
    snap: 'SNAP', upload: 'Screenshot / PDF', paste: 'Message or link',
    pasteTitle: 'Paste a message or link', pastePh: 'Paste an SMS, WhatsApp message or a link here', clip: '📋 Paste', read: 'Read', back: 'Back',
    demoOn: 'DEMO MODE (works offline)', samples: 'Try a sample',
    sBill: 'Electricity bill', sMed: 'Expired medicine', sScam: 'Scam SMS', sRx: 'Prescription',
    name: 'Your name', namePh: 'e.g. Prakash Kaka', phone: "Family member's WhatsApp", save: 'Save', settings: 'Settings',
    scanning: 'Scanning the photo…', reading: 'Reading…', wait: 'Please wait, this can take a moment…', slow: 'Server is busy, this may take a while…', cancel: 'Cancel',
    camDark: 'Light is low', camBlurry: 'Hold the phone steady', camOk: 'Good, hold still…', capture: 'Take photo', close: 'Close',
    what: 'What is it', action: 'What to do', deadline: 'By when', amount: 'How much', warning: 'Warning',
    unclear: 'Not clear', checked: 'Rule-checked', where: 'Show on paper',
    listen: 'Listen again', pay: 'Pay bill', family: 'Send to family', remind: 'Remind me', again: 'New document',
    askPh: 'Ask a question… e.g. Can I pay by UPI?', askBtn: 'Ask', mic: 'Ask by voice', stop: 'Stop', listening: 'Speak… tap again to stop',
    yes: 'Yes', no: 'No', morning: 'Morning', noon: 'Afternoon', night: 'Night', before: 'Before food', after: 'After food', carry: 'Take with you',
    b_SCAM: 'Scam!', b_EXPIRED: 'Expired medicine', b_URGENT: 'Act soon', b_BILL_SPIKE: 'Bill unusually high', b_LOW_CONFIDENCE: 'Not clear',
    error: 'Something went wrong. Please try again.', linkError: 'Could not open that link. Take a screenshot of the page and send it as a photo.', footer: 'Vaachak never guesses with money or medicine.',
  },
};

export const LANG_TAGS = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN' };

export function makeT(lang) {
  return (key) => T[lang]?.[key] ?? T.en[key] ?? key;
}
