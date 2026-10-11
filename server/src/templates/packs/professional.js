// The Professional firms pack: eight documents for accountants, consultants and other
// practices (plan task P5-10).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
// Regulated professions have their own rules about engagement terms, fees and advertising,
// set by their institutes and councils. These drafts do not know those rules.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, PURPLE, pack, role, hint, title, p, c, note, table, list, sign, when, cityQuestion, law } from "./_helpers.js";

const common = { ...pack("professional"), industry: "Professional firms" };

const firm = [text("firm_name", "Firm: name"), text("firm_address", "Firm: address"), text("partner_name", "Signing for the firm: name"), text("partner_title", "Their designation, for example Partner")];
const client = [text("client_name", "Client: name of the person or business"), text("client_address", "Client: address")];
const forFirm = role("firm", "For the Firm", "partner_name", BLUE, 1);
const theClient = role("client", "Client", "client_signatory", GREEN, 2);
const clientSignatory = text("client_signatory", "Signing for the client: name");
const signedFor = p("For {{firm_name}}: {{partner_name}}, {{partner_title}}");

const engagement = {
  ...common,
  key: "professional-engagement-letter",
  title: "Engagement Letter",
  summary: "A firm sets out the work it will do for a client, what the client must provide, the fee and the limits of the engagement.",
  signatureHint: hint.esign("an engagement letter"),
  roles: [forFirm, theClient],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...firm,
    ...client,
    clientSignatory,
    longtext("scope", "The work the firm will do", { maxLength: 1200 }),
    optional(longtext("exclusions", "What is not included", { maxLength: 600 })),
    text("period", "Period it covers, for example the financial year 2026-27"),
    choice("fee_basis", "The fee is", [["fixed", "a fixed fee"], ["monthly", "a monthly retainer"], ["hourly", "charged by the hour"]]),
    money("fee", "Fee, in rupees (the fixed fee, the monthly retainer or the hourly rate)"),
    number("payment_days", "Days within which invoices must be paid", { default: 15, min: 0, max: 90 }),
    cityQuestion,
  ],
  body: [
    title("Engagement Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{client_name}}**, {{client_address}}"),
    p("Thank you for asking {{firm_name}} to act for you. This letter sets out the terms on which we will do so for {{period}}."),
    c("Our work", "{{scope}}"),
    c("Not included", "{{exclusions}}", { showIf: { question: "exclusions", answered: true } }),
    c("What we need from you", "You will give us complete and accurate information and records in good time, and tell us promptly of anything that may affect the work. We rely on what you give us and do not check it unless that is part of the work described above. You remain responsible for your own records and for decisions made on our advice."),
    c("Fee", "Our fee is a fixed fee of {{fee|money}} ({{fee|words}}), plus tax and out-of-pocket expenses.", { showIf: when("fee_basis", "fixed") }),
    c("Fee", "Our fee is a retainer of {{fee|money}} ({{fee|words}}) a month, plus tax and out-of-pocket expenses.", { showIf: when("fee_basis", "monthly") }),
    c("Fee", "Our fee is {{fee|money}} for each hour worked, plus tax and out-of-pocket expenses. We will tell you before the fee is likely to pass any estimate we have given.", { showIf: when("fee_basis", "hourly") }),
    c("Payment", "Invoices are payable within {{payment_days}} days. We may pause work while an invoice is overdue."),
    c("Confidentiality", "We keep your information confidential and use it only for this engagement, except where the law or our professional rules require us to disclose it."),
    c("Ending the engagement", "Either of us may end this engagement by written notice. You will pay for work done up to that date."),
    law,
    signedFor,
    sign(),
  ],
};

const retainer = {
  ...common,
  key: "retainer-agreement",
  title: "Retainer Agreement",
  summary: "A consultant or firm is retained for a number of hours or a defined service each month, for a monthly fee.",
  signatureHint: hint.esign("a retainer agreement"),
  roles: [forFirm, theClient],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    ...firm,
    ...client,
    clientSignatory,
    longtext("services", "Services covered by the retainer", { maxLength: 1000 }),
    number("hours", "Hours included each month", { default: 20, min: 1, max: 400 }),
    money("monthly_fee", "Monthly retainer, in rupees"),
    money("extra_rate", "Rate for each hour beyond those included, in rupees"),
    date("start_date", "Starts on"),
    number("term_months", "Initial period, in months", { default: 12, min: 1, max: 60 }),
    number("notice_days", "Days of notice to end it", { default: 30, min: 7, max: 180 }),
    cityQuestion,
  ],
  body: [
    title("Retainer Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{firm_name}}**, of {{firm_address}} (the "Firm"), and **{{client_name}}**, of {{client_address}} (the "Client").'),
    c("Services", "From {{start_date|date}} the Firm shall provide these services to the Client: {{services}}"),
    c("Retainer", "The Client shall pay {{monthly_fee|money}} ({{monthly_fee|words}}) a month in advance, plus tax. This covers up to {{hours}} hours of work in the month. Hours not used in a month are not carried forward."),
    c("Further work", "Work beyond the included hours is charged at {{extra_rate|money}} an hour and is done only after the Client agrees to it in writing."),
    c("Period", "This agreement runs for {{term_months}} month(s) and then continues month to month until ended. Either side may end it with {{notice_days}} days of written notice."),
    c("Confidentiality and ownership", "Each side keeps the other's information confidential. On payment, what the Firm produces specifically for the Client belongs to the Client; the Firm keeps its own methods, tools and know-how."),
    law,
    sign(),
  ],
};

const boardResolution = {
  ...common,
  key: "board-resolution",
  title: "Board Resolution (Certified Copy)",
  summary: "A certified copy of a resolution passed by a company's board, for a bank, an authority or a counterparty.",
  signatureHint: hint.check("Signed by a director or the company secretary. Some authorities and banks ask for a digital signature certificate or a signature on letterhead; check what the recipient accepts."),
  roles: [role("certifier", "Director or Company Secretary", "certifier_name")],
  questions: [
    text("company_name", "Company: name"),
    text("company_address", "Company: registered office"),
    optional(text("cin", "Company identification number")),
    date("meeting_date", "Date of the board meeting"),
    text("meeting_place", "Where it was held"),
    text("subject", "Subject of the resolution"),
    longtext("resolution_text", "The resolution, in full", { maxLength: 2500 }),
    text("certifier_name", "Certified by: name"),
    choice("certifier_title", "Their position", [["Director", "Director"], ["Managing Director", "Managing Director"], ["Company Secretary", "Company Secretary"]]),
  ],
  body: [
    title("Certified True Copy of Board Resolution"),
    p("**{{company_name}}**, registered office {{company_address}}. CIN: {{cin}}"),
    p("Certified true copy of the resolution passed at the meeting of the board of directors held on {{meeting_date|date}} at {{meeting_place}}."),
    c("{{subject}}", "{{resolution_text}}"),
    p("Certified to be true: {{certifier_name}}, {{certifier_title}}"),
    sign(),
  ],
};

const authorisation = {
  ...common,
  key: "authorisation-letter",
  title: "Authorisation Letter",
  summary: "A person or business authorises someone to act for them in a named matter before a named office.",
  signatureHint: hint.check("An ordinary electronic signature is often accepted, but the office that receives the letter decides. Some matters need a power of attorney on stamp paper instead."),
  roles: [role("authoriser", "Authoriser", "authoriser_name")],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    text("authoriser_name", "Who is giving the authority: full name"),
    text("authoriser_address", "Their address"),
    optional(text("authoriser_capacity", "Their capacity, for example Proprietor of Asha Traders")),
    text("representative_name", "Who is being authorised: full name"),
    optional(text("representative_firm", "Their firm")),
    text("addressed_to", "To whom the letter is addressed, for example The Assessing Officer"),
    longtext("matter", "What they are authorised to do", { maxLength: 800 }),
    date("valid_until", "Valid until"),
  ],
  body: [
    title("Authorisation Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: {{addressed_to}}"),
    p("I, **{{authoriser_name}}**, {{authoriser_capacity}}, of {{authoriser_address}}, authorise **{{representative_name}}** {{representative_firm}} to act for me in the following matter: {{matter}}"),
    p("They may appear, file and collect documents, and give explanations on my behalf in that matter. What they do within this authority is to be treated as done by me."),
    p("This authority is valid until {{valid_until|date}} unless I withdraw it earlier in writing."),
    sign(),
  ],
};

const dataConsent = {
  ...common,
  key: "client-data-consent",
  title: "Client Consent to Use of Personal Data",
  summary: "A client consents to a firm collecting and using their personal data for stated purposes, and is told how to withdraw.",
  signatureHint: hint.esign("a consent form"),
  roles: [role("client", "Client", "client_name")],
  questions: [
    date("consent_date", "Date", { default: "today" }),
    text("firm_name", "Firm: name"),
    text("firm_contact", "Email or address for questions and withdrawal"),
    text("client_name", "Client: full name"),
    longtext("data_collected", "What personal data is collected", { help: "For example: name, PAN, bank statements, contact details", maxLength: 600 }),
    longtext("purposes", "What it is used for", { maxLength: 600 }),
    optional(longtext("shared_with", "Whom it may be shared with", { maxLength: 400 })),
    text("retention", "How long it is kept, for example 8 years after the engagement ends"),
  ],
  body: [
    title("Consent to Use of Personal Data"),
    p("I, **{{client_name}}**, give {{firm_name}} my consent to collect and use my personal data as set out below."),
    c("Data", "{{data_collected}}"),
    c("Purposes", "{{purposes}}"),
    c("Sharing", "{{shared_with}}", { showIf: { question: "shared_with", answered: true } }),
    c("How long it is kept", "{{retention}}"),
    list(["The data will be used only for the purposes above.", "I can ask to see, correct or erase my data, where the law allows.", "I can withdraw this consent at any time by writing to {{firm_contact}}. Withdrawing it does not affect what was done before, and some work may not be possible without the data."]),
    p("Date: {{consent_date|date}}"),
    sign(),
  ],
};

const representation = {
  ...common,
  key: "management-representation-letter",
  title: "Management Representation Letter",
  summary: "A client's management confirms in writing the statements it has made to its accountants or auditors.",
  signatureHint: hint.esign("a representation letter"),
  roles: [role("management", "For the Client", "signatory_name")],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    text("client_name", "Client: name of the business"),
    text("firm_name", "Addressed to: name of the firm"),
    text("period", "Period, for example the year ended 31 March 2026"),
    text("engagement", "The work it relates to, for example the audit of the financial statements"),
    optional(longtext("specific", "Any further specific representation", { maxLength: 1000 })),
    text("signatory_name", "Signed by: name"),
    text("signatory_title", "Their designation"),
  ],
  body: [
    title("Management Representation Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: {{firm_name}}"),
    p("This letter is given in connection with {{engagement}} of **{{client_name}}** for {{period}}. We confirm, to the best of our knowledge and belief, that:"),
    list(["we are responsible for the accounting records and for the financial statements prepared from them;", "we have given you all the records, information and explanations you asked for, and they are complete;", "all transactions have been recorded and are reflected in the financial statements;", "we have told you of all known or suspected fraud, and of all known breaches of law, that could affect the financial statements;", "we have told you of all liabilities, claims and related-party dealings we know of; and", "nothing has happened since the end of the period that would require the financial statements to be changed, other than what we have told you."]),
    c("Further representations", "{{specific}}", { showIf: { question: "specific", answered: true } }),
    p("For {{client_name}}: {{signatory_name}}, {{signatory_title}}"),
    sign(),
  ],
};

const scopeChange = {
  ...common,
  key: "change-of-scope-letter",
  title: "Change of Scope Letter",
  summary: "A firm and its client record an agreed change to the work and to the fee under an existing engagement.",
  signatureHint: hint.esign("a change-of-scope letter"),
  roles: [forFirm, theClient],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...firm,
    ...client,
    clientSignatory,
    date("original_date", "Date of the original engagement letter"),
    longtext("change", "What is changing", { maxLength: 1000 }),
    money("additional_fee", "Additional fee, in rupees (0 if none)", { min: 0 }),
    optional(date("new_deadline", "New completion date, if it changes")),
  ],
  body: [
    title("Change of Scope"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{client_name}}**, {{client_address}}"),
    p("This letter changes our engagement letter dated {{original_date|date}}."),
    c("The change", "{{change}}"),
    c("Fee", "The additional fee for this change is {{additional_fee|money}} ({{additional_fee|words}}), plus tax, on the same payment terms."),
    c("Timing", "The work will now be completed by {{new_deadline|date}}.", { showIf: { question: "new_deadline", answered: true } }),
    p("Every other term of the engagement letter stays as it is."),
    signedFor,
    sign(),
  ],
};

const documentReceipt = {
  ...common,
  key: "client-document-handover",
  title: "Record of Documents Handed Over",
  summary: "A firm and its client record which original documents were handed over, by whom and when.",
  signatureHint: hint.esign("a handover record"),
  roles: [role("giver", "Handed over by", "giver_name", BLUE, 1), role("receiver", "Received by", "receiver_name", GREEN, 2)],
  questions: [
    date("handover_date", "Date of handing over", { default: "today" }),
    text("giver_name", "Handed over by: name"),
    text("giver_of", "Of, for example the firm's or the client's name"),
    text("receiver_name", "Received by: name"),
    text("receiver_of", "Of"),
    longtext("documents", "Documents handed over, one per line", { help: "For example: Original sale deed dated 4 March 2019, 12 pages", maxLength: 2000 }),
    choice("kind", "They are", [["originals", "originals"], ["copies", "copies"], ["originals and copies", "originals and copies"]]),
    optional(text("purpose", "Purpose")),
  ],
  body: [
    title("Record of Documents Handed Over"),
    p("On {{handover_date|date}}, **{{giver_name}}** of {{giver_of}} handed the documents listed below, being {{kind}}, to **{{receiver_name}}** of {{receiver_of}}."),
    c("Documents", "{{documents}}"),
    p("Purpose: {{purpose}}", { question: "purpose", answered: true }),
    p("The person receiving them confirms that they have received every document listed, in the condition in which it was handed over."),
    sign(),
  ],
};

export default [engagement, retainer, boardResolution, authorisation, dataConsent, representation, scopeChange, documentReceipt];
