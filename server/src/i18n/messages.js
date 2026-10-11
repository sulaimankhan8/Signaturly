/**
 * Wording of everything a signer receives: emails, SMS and WhatsApp messages, and the headings
 * of the signing record.
 *
 * English is complete. Hindi was written by the development team and must be reviewed by a native
 * speaker before launch. A language with no entry for a key falls back to English, so further
 * languages (Marathi, Tamil, Telugu, Kannada, Gujarati, Bengali) can be added one key at a time.
 */

export const SUPPORTED_LANGUAGES = ["en", "hi", "mr", "ta", "te", "kn", "gu", "bn"];
export const DEFAULT_LANGUAGE = "en";

export const normalizeLanguage = (value) =>
  typeof value === "string" && SUPPORTED_LANGUAGES.includes(value.toLowerCase()) ? value.toLowerCase() : DEFAULT_LANGUAGE;

const MESSAGES = {
  en: {
    "label.documentTitle": "Document Title",
    "label.pages": "Total Pages: {count}",
    "label.deadline": "Deadline: {date}",
    "label.linkFallback": "If the button above does not work, copy and paste this link in your browser:",

    "request.subject": 'Signature Requested: "{document}" from {sender}',
    "request.heading": "Signature Requested",
    "request.body": "{sender} has sent you a document to review and electronically sign.",
    "request.button": "Review & Sign Document",
    "request.text": 'Signature Requested: "{document}". Please sign here: {link}',
    "request.sms": '{sender} has sent you "{document}" to sign on {app}: {link}',

    "reminder.subject": 'Reminder: Please sign "{document}" from {sender}',
    "reminder.heading": "Friendly Reminder: Signature Pending",
    "reminder.body": '{sender} is awaiting your review and electronic signature on "{document}".',
    "reminder.button": "Review & Sign Now",
    "reminder.text": 'Reminder: Please sign "{document}". Link: {link}',
    "reminder.sms": 'Reminder from {app}: "{document}" from {sender} is waiting for your signature: {link}',

    "otp.subject": '[{code}] Your Identity Verification Code for "{document}"',
    "otp.heading": "Identity Verification Code",
    "otp.body": 'You are accessing and signing "{document}". Use the 6-digit verification code below:',
    "otp.label": "Security Verification Code",
    "otp.note": "Valid for 10 minutes. Do not share this code.",
    "otp.text": 'Your {app} identity verification code for "{document}" is: {code} (Valid for 10 minutes).',
    "otp.sms": '{code} is your {app} verification code for "{document}". Valid for 10 minutes. Do not share it.',

    "completed.subject": 'Completed & Signed: "{document}"',
    "completed.heading": "Document Completed",
    "completed.body": 'All parties have completed and signed "{document}".',
    "completed.status": "Status: Completed by all parties",
    "completed.button": "Download Signed PDF",
    "completed.note": "An audit record of every signing event is kept with this document.",
    "completed.text": 'All parties have completed signing "{document}". Download here: {link}',
    "completed.sms": '"{document}" has been signed by everyone. Download your copy from {app}: {link}',

    "badge.line": "Signed with {app}.",
    "badge.cta": "Send your own documents for signature, free.",

    "cancelled.subject": 'Document Cancelled: "{document}"',
    "cancelled.sms": '"{document}" on {app} has been cancelled. Any signatures already given on it are void.',

    // Headings and labels of the signing record
    "record.title.completed": "Certificate of Completion",
    "record.title.pending": "Signing Record",
    "record.scan": "Scan to verify",
    "record.note": "This record is written in English. Its headings are repeated in {language} for the signer's convenience; the English text is the record.",
    "record.section.document": "Document",
    "record.section.recipients": "Recipients",
    "record.section.auditLog": "Audit log",
    "record.label.title": "Title",
    "record.label.sentBy": "Sent by",
    "record.label.status": "Status",
    "record.label.originalHash": "Original SHA-256",
    "record.label.signedHash": "Signed copy SHA-256",
    "record.label.verifyOnline": "Verify online",
    "record.label.signedBy": "Signed by",
    "record.label.roleStatus": "Role / status",
    "record.label.identityCheck": "Identity check",
    "record.label.signedAt": "Signed at",
    "record.label.consent": "Consent",
    "record.label.declineReason": "Decline reason",
    "record.label.ipAddress": "IP address",
    "record.event.created": "Uploaded",
    "record.event.sent": "Sent",
    "record.event.viewed": "Opened",
    "record.event.identity_verified": "Identity checked",
    "record.event.signed": "Signed",
    "record.event.completed": "Completed",
    "record.event.sealed": "Sealed",
    "record.event.declined": "Declined",
    "record.event.voided": "Voided",
    "record.event.downloaded": "Downloaded",
    "record.event.expired": "Expired",
    "record.event.reminder_sent": "Reminder",
    "record.event.automated_reminder": "Reminder",
    "record.event.recipient_updated": "Signer updated",
    "record.event.deleted": "Deleted",
    "record.integrity.ok": "Audit log integrity: every entry is linked to the one before it and none has been altered.",
    "record.integrity.failed": "Audit log integrity: could not be confirmed ({reason}).",
  },

  hi: {
    "label.documentTitle": "दस्तावेज़ का शीर्षक",
    "label.pages": "कुल पृष्ठ: {count}",
    "label.deadline": "अंतिम तिथि: {date}",
    "label.linkFallback": "यदि ऊपर का बटन काम न करे, तो यह लिंक अपने ब्राउज़र में खोलें:",

    "request.subject": 'हस्ताक्षर का अनुरोध: "{document}" — {sender} की ओर से',
    "request.heading": "हस्ताक्षर का अनुरोध",
    "request.body": "{sender} ने आपको एक दस्तावेज़ देखने और इलेक्ट्रॉनिक रूप से हस्ताक्षर करने के लिए भेजा है।",
    "request.button": "दस्तावेज़ देखें और हस्ताक्षर करें",
    "request.text": 'हस्ताक्षर का अनुरोध: "{document}"। कृपया यहाँ हस्ताक्षर करें: {link}',
    "request.sms": '{sender} ने आपको "{document}" हस्ताक्षर के लिए भेजा है ({app}): {link}',

    "reminder.subject": 'याद दिलाना: कृपया "{document}" पर हस्ताक्षर करें — {sender}',
    "reminder.heading": "हस्ताक्षर बाकी है",
    "reminder.body": '{sender} को "{document}" पर आपके हस्ताक्षर की प्रतीक्षा है।',
    "reminder.button": "अभी देखें और हस्ताक्षर करें",
    "reminder.text": 'याद दिलाना: कृपया "{document}" पर हस्ताक्षर करें। लिंक: {link}',
    "reminder.sms": '{app} से याद दिलाना: {sender} का "{document}" आपके हस्ताक्षर की प्रतीक्षा में है: {link}',

    "otp.subject": '[{code}] "{document}" के लिए आपका सत्यापन कोड',
    "otp.heading": "पहचान सत्यापन कोड",
    "otp.body": 'आप "{document}" खोलकर उस पर हस्ताक्षर करने जा रहे हैं। नीचे दिया गया 6 अंकों का कोड दर्ज करें:',
    "otp.label": "सुरक्षा सत्यापन कोड",
    "otp.note": "यह कोड 10 मिनट तक मान्य है। इसे किसी के साथ साझा न करें।",
    "otp.text": '"{document}" के लिए आपका {app} सत्यापन कोड है: {code} (10 मिनट तक मान्य)।',
    "otp.sms": '{code} "{document}" के लिए आपका {app} सत्यापन कोड है। 10 मिनट तक मान्य। इसे किसी को न बताएँ।',

    "completed.subject": 'पूर्ण और हस्ताक्षरित: "{document}"',
    "completed.heading": "दस्तावेज़ पूरा हुआ",
    "completed.body": 'सभी पक्षों ने "{document}" पर हस्ताक्षर कर दिए हैं।',
    "completed.status": "स्थिति: सभी पक्षों द्वारा पूर्ण",
    "completed.button": "हस्ताक्षरित दस्तावेज़ डाउनलोड करें",
    "completed.note": "हस्ताक्षर की हर घटना का रिकॉर्ड इस दस्तावेज़ के साथ रखा गया है।",
    "completed.text": 'सभी पक्षों ने "{document}" पर हस्ताक्षर कर दिए हैं। यहाँ से डाउनलोड करें: {link}',
    "completed.sms": '"{document}" पर सभी ने हस्ताक्षर कर दिए हैं। अपनी प्रति {app} से डाउनलोड करें: {link}',

    "badge.line": "{app} के साथ हस्ताक्षरित।",
    "badge.cta": "अपने दस्तावेज़ हस्ताक्षर के लिए मुफ़्त भेजें।",

    "cancelled.subject": 'दस्तावेज़ रद्द: "{document}"',
    "cancelled.sms": '{app} पर "{document}" रद्द कर दिया गया है। इस पर पहले दिए गए हस्ताक्षर अब मान्य नहीं हैं।',

    "record.title.completed": "पूर्णता प्रमाणपत्र",
    "record.title.pending": "हस्ताक्षर रिकॉर्ड",
    "record.scan": "सत्यापन के लिए स्कैन करें",
    "record.note": "यह रिकॉर्ड अंग्रेज़ी में लिखा गया है। हस्ताक्षरकर्ता की सुविधा के लिए इसके शीर्षक {language} में भी दिए गए हैं; मान्य पाठ अंग्रेज़ी का है।",
    "record.section.document": "दस्तावेज़",
    "record.section.recipients": "प्राप्तकर्ता",
    "record.section.auditLog": "घटनाओं का लेखा",
    "record.label.title": "शीर्षक",
    "record.label.sentBy": "भेजने वाला",
    "record.label.status": "स्थिति",
    "record.label.originalHash": "मूल फ़ाइल SHA-256",
    "record.label.signedHash": "हस्ताक्षरित प्रति SHA-256",
    "record.label.verifyOnline": "ऑनलाइन सत्यापन",
    "record.label.signedBy": "हस्ताक्षरकर्ता",
    "record.label.roleStatus": "भूमिका / स्थिति",
    "record.label.identityCheck": "पहचान की जाँच",
    "record.label.signedAt": "हस्ताक्षर का समय",
    "record.label.consent": "सहमति",
    "record.label.declineReason": "अस्वीकार का कारण",
    "record.label.ipAddress": "IP पता",
    "record.event.created": "अपलोड किया गया",
    "record.event.sent": "भेजा गया",
    "record.event.viewed": "खोला गया",
    "record.event.identity_verified": "पहचान जाँची गई",
    "record.event.signed": "हस्ताक्षर किया गया",
    "record.event.completed": "पूर्ण",
    "record.event.sealed": "सील किया गया",
    "record.event.declined": "अस्वीकार किया गया",
    "record.event.voided": "रद्द किया गया",
    "record.event.downloaded": "डाउनलोड किया गया",
    "record.event.expired": "अवधि समाप्त",
    "record.event.reminder_sent": "याद दिलाया गया",
    "record.event.automated_reminder": "याद दिलाया गया",
    "record.event.recipient_updated": "हस्ताक्षरकर्ता बदला गया",
    "record.event.deleted": "हटाया गया",
    "record.integrity.ok": "लेखे की अखंडता: हर प्रविष्टि अपने से पहले वाली प्रविष्टि से जुड़ी है और किसी में बदलाव नहीं हुआ है।",
    "record.integrity.failed": "लेखे की अखंडता: पुष्टि नहीं हो सकी ({reason})।",
  },
};

const fill = (template, params) =>
  template.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? String(params[name]) : match));

/**
 * Looks up a message in the given language, falling back to English, and fills in {placeholders}.
 */
export const t = (language, key, params = {}) => {
  const template = MESSAGES[normalizeLanguage(language)]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE][key];
  if (template === undefined) throw new Error(`Unknown message key: ${key}`);
  return fill(template, params);
};

/**
 * A message in the given language only: undefined when that language has no wording of its own
 * for the key. Used where falling back would print the English text twice.
 */
export const own = (language, key, params = {}) => {
  const template = MESSAGES[normalizeLanguage(language)]?.[key];
  return template === undefined ? undefined : fill(template, params);
};

// What each language calls itself
export const LANGUAGE_NAMES = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  gu: "ગુજરાતી",
  bn: "বাংলা",
};

// Languages that have their own wording for a key (used by tests to track translation coverage)
export const languagesWith = (key) => Object.keys(MESSAGES).filter((lang) => MESSAGES[lang][key] !== undefined);
export const messageKeys = () => Object.keys(MESSAGES[DEFAULT_LANGUAGE]);
