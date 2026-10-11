import { Subscription } from "../../src/models/Subscription.model.js";
import { getOrCreateSubscription } from "../../src/services/subscription.service.js";

// An answer of the right kind for a question, so any template can be rendered in a test
const sampleFor = (question) => {
  switch (question.type) {
    case "text":
      return /name/.test(question.id) ? `Sample ${question.id.replace(/_/g, " ")}` : "Pune";
    case "longtext":
      return "A sample description that is long enough to wrap onto a second line of the page when it is printed.";
    case "number":
      return question.default ?? Math.max(question.min ?? 1, 2);
    case "money":
      return 15000;
    case "date":
      return "2026-11-01";
    case "select":
      return question.options[0].value;
    case "boolean":
      return true;
    case "email":
      return "sample@example.test";
    case "phone":
      return "+919876543210";
    default:
      return "";
  }
};

export const sampleAnswers = (definition, overrides = {}) => ({
  ...Object.fromEntries(definition.questions.map((question) => [question.id, sampleFor(question)])),
  ...overrides,
});

export const setPlan = async (userId, plan) => {
  await getOrCreateSubscription(userId);
  await Subscription.updateOne(
    { userId },
    {
      plan,
      status: plan === "free" ? "free" : "active",
      currentPeriodEnd: plan === "free" ? null : new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    }
  );
};

// A two-page rent agreement in Hindi, used to measure the renderer (plan task P4-02).
// Test wording only: the Hindi packs are written with a translator in P4-12.
const HINDI_CLAUSES = [
  ["अवधि", "यह किरायानामा ग्यारह महीने की अवधि के लिए है, जो {{start_date|date}} से शुरू होकर {{start_date|addMonths:11|addDays:-1|date}} को समाप्त होगी। दोनों पक्षों की लिखित सहमति से इसे नए अनुबंध द्वारा आगे बढ़ाया जा सकता है।"],
  ["किराया", "किरायेदार हर महीने की {{rent_day}} तारीख तक या उससे पहले {{rent|money}} मासिक किराया अग्रिम रूप से मकान मालिक को देगा। किराया बैंक अंतरण, यूपीआई या चेक द्वारा दिया जा सकता है।"],
  ["सुरक्षा जमा", "किरायेदार ने मकान मालिक को {{deposit|money}} की ब्याज-रहित सुरक्षा राशि दी है। परिसर खाली करने पर बकाया किराया, बिल और सामान्य टूट-फूट से अधिक हुए नुकसान की मरम्मत का खर्च काटकर यह राशि लौटा दी जाएगी।"],
  ["बिल और रखरखाव", "किरायेदारी की अवधि में बिजली, पानी, गैस और सोसाइटी के रखरखाव शुल्क का भुगतान किरायेदार करेगा। बड़ी और ढाँचागत मरम्मत मकान मालिक कराएगा।"],
  ["परिसर का उपयोग", "किरायेदार परिसर का उपयोग केवल निजी आवास के रूप में करेगा, उसे अच्छी हालत में रखेगा, मकान मालिक की लिखित अनुमति के बिना किसी और को किराये पर नहीं देगा और न ही कोई ढाँचागत बदलाव करेगा।"],
  ["निरीक्षण", "मकान मालिक उचित सूचना देकर किसी उचित समय पर परिसर का निरीक्षण कर सकता है।"],
  ["किरायेदारी की समाप्ति", "कोई भी पक्ष दूसरे पक्ष को एक महीने की लिखित सूचना देकर किरायेदारी समाप्त कर सकता है। यदि दो महीने का किराया बकाया रहे या किरायेदार इस अनुबंध का गंभीर उल्लंघन करे, तो मकान मालिक इसे पहले भी समाप्त कर सकता है।"],
  ["सोसाइटी के नियम", "किरायेदार भवन या हाउसिंग सोसाइटी के सभी नियमों का पालन करेगा और पड़ोसियों को किसी प्रकार की असुविधा नहीं पहुँचाएगा।"],
  ["कानून और विवाद", "यह अनुबंध भारत के कानूनों के अधीन है। इससे उत्पन्न किसी भी विवाद की सुनवाई {{city}} के न्यायालयों में होगी।"],
];

export const hindiRentAgreement = {
  key: "test-hindi-rent-agreement",
  version: 1,
  language: "hi",
  pack: "starter",
  title: "किरायानामा",
  summary: "ग्यारह महीने का किरायानामा",
  signatureHint: { level: "stamp_duty", text: "" },
  stateNotes: [],
  reviewer: null,
  roles: [
    { id: "landlord", name: "मकान मालिक", nameFrom: "landlord_name", signingOrder: 1 },
    { id: "tenant", name: "किरायेदार", nameFrom: "tenant_name", signingOrder: 2 },
  ],
  questions: [
    { id: "agreement_date", label: "अनुबंध की तारीख", type: "date", required: true },
    { id: "landlord_name", label: "मकान मालिक का नाम", type: "text", required: true },
    { id: "tenant_name", label: "किरायेदार का नाम", type: "text", required: true },
    { id: "property_address", label: "संपत्ति का पता", type: "text", required: true },
    { id: "city", label: "शहर", type: "text", required: true },
    { id: "start_date", label: "शुरू होने की तारीख", type: "date", required: true },
    { id: "rent", label: "मासिक किराया", type: "money", required: true },
    { id: "rent_day", label: "किराये की तारीख", type: "number", required: true },
    { id: "deposit", label: "सुरक्षा जमा", type: "money", required: true },
  ],
  body: [
    { type: "title", text: "किरायानामा" },
    {
      type: "paragraph",
      text: "यह किरायानामा {{city}} में {{agreement_date|date}} को **{{landlord_name}}** (\"मकान मालिक\") और **{{tenant_name}}** (\"किरायेदार\") के बीच किया गया है। मकान मालिक {{property_address}} स्थित संपत्ति का स्वामी है और उसे नीचे लिखी शर्तों पर किरायेदार को आवास के लिए किराये पर देने को सहमत है।",
    },
    // Each clause appears three times so the document runs onto a second page
    ...[0, 1, 2].flatMap(() => HINDI_CLAUSES.map(([heading, text]) => ({ type: "clause", heading, text }))),
    { type: "signatures" },
  ],
};

export const hindiAnswers = {
  agreement_date: "2026-10-11",
  landlord_name: "रमेश कुमार शर्मा",
  tenant_name: "आशा राव",
  property_address: "फ्लैट 302, श्री गणेश अपार्टमेंट, कोथरूड, पुणे 411038",
  city: "पुणे",
  start_date: "2026-11-01",
  rent: 18500,
  rent_day: 5,
  deposit: 55000,
};
