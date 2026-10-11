// The Starter pack: eight everyday documents, open to every plan (plan task P4-09).
//
// These are starting drafts written by the development team. None has been reviewed by a lawyer:
// every one carries `reviewer: null`, which the app shows as "not yet reviewed", and which keeps
// it out of the catalogue in production until a reviewer's name and date are recorded.
// The state notes and signature hints are cautious summaries and need the same review.

const text = (id, label, extra = {}) => ({ id, label, type: "text", required: true, ...extra });
const longtext = (id, label, extra = {}) => ({ id, label, type: "longtext", required: true, ...extra });
const money = (id, label, extra = {}) => ({ id, label, type: "money", required: true, min: 1, ...extra });
const date = (id, label, extra = {}) => ({ id, label, type: "date", required: true, ...extra });
const number = (id, label, extra = {}) => ({ id, label, type: "number", required: true, ...extra });
const choice = (id, label, options, extra = {}) => ({
  id,
  label,
  type: "select",
  required: true,
  options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  ...extra,
});

const BLUE = "#3b82f6";
const GREEN = "#10b981";

const STAMP_CHECK = "Stamp duty depends on the state and on the kind of document. Check what applies before relying on this.";

const common = { version: 1, language: "en", pack: "starter", reviewer: null, stateNotes: [] };

const mutualNda = {
  ...common,
  key: "mutual-nda",
  industry: "General business",
  title: "Mutual Non-Disclosure Agreement",
  summary: "Two parties agree to keep each other's confidential information private while they explore working together.",
  signatureHint: { level: "esign_ok", text: `An ordinary electronic signature is usually used for an NDA. ${STAMP_CHECK}` },
  roles: [
    { id: "first-party", name: "First Party", nameFrom: "first_name", color: BLUE, signingOrder: 1 },
    { id: "second-party", name: "Second Party", nameFrom: "second_name", color: GREEN, signingOrder: 2 },
  ],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    text("first_name", "First party: name of the person or business"),
    text("first_address", "First party: address"),
    text("second_name", "Second party: name of the person or business"),
    text("second_address", "Second party: address"),
    longtext("purpose", "What are the two parties discussing?", { help: "For example: a possible software development project", maxLength: 400 }),
    number("term_years", "For how many years must the information stay confidential?", { default: 2, min: 1, max: 10 }),
    text("city", "City whose courts will hear any dispute"),
  ],
  body: [
    { type: "title", text: "Mutual Non-Disclosure Agreement" },
    {
      type: "paragraph",
      text: 'This agreement is made on {{agreement_date|date}} between **{{first_name}}**, of {{first_address}} (the "First Party"), and **{{second_name}}**, of {{second_address}} (the "Second Party"). Each of them is a "Party" and a Party that shares information is a "Discloser".',
    },
    { type: "clause", heading: "Purpose", text: "The Parties wish to share information with each other in order to discuss the following: {{purpose}}." },
    {
      type: "clause",
      heading: "Confidential information",
      text: "Confidential information is any information a Party shares for that purpose that is marked confidential or that a reasonable person would understand to be confidential. It includes business plans, prices, customer details, designs, software and know-how.",
    },
    {
      type: "clause",
      heading: "What each Party agrees to",
      text: "A Party that receives confidential information shall:",
      items: [
        "use it only for the purpose above;",
        "keep it secret, with at least the care it gives its own confidential information;",
        "share it only with its employees and advisers who need it for that purpose and who are bound to keep it secret; and",
        "return or delete it when the Discloser asks in writing.",
      ],
    },
    {
      type: "clause",
      heading: "What is not covered",
      text: "These duties do not apply to information that is already public, that the receiving Party already knew or develops independently, that it receives lawfully from someone else, or that the law or a court requires it to disclose.",
    },
    { type: "clause", heading: "Duration", text: "The duties in this agreement last for {{term_years}} year(s) from the date of this agreement." },
    {
      type: "clause",
      heading: "No other rights",
      text: "Nothing in this agreement transfers ownership of any information or obliges either Party to enter into a further agreement.",
    },
    {
      type: "clause",
      heading: "Law and disputes",
      text: "This agreement is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it.",
    },
    { type: "signatures" },
  ],
};

const serviceAgreement = {
  ...common,
  key: "service-agreement",
  industry: "General business",
  title: "Simple Service Agreement",
  summary: "A business or individual agrees to provide services to a client for an agreed fee.",
  signatureHint: { level: "esign_ok", text: `An ordinary electronic signature is usually used for a service agreement. ${STAMP_CHECK}` },
  roles: [
    { id: "client", name: "Client", nameFrom: "client_name", color: BLUE, signingOrder: 1 },
    { id: "provider", name: "Service Provider", nameFrom: "provider_name", color: GREEN, signingOrder: 2 },
  ],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    text("client_name", "Client: name of the person or business"),
    text("client_address", "Client: address"),
    text("provider_name", "Service provider: name of the person or business"),
    text("provider_address", "Service provider: address"),
    longtext("services", "What services will be provided?", { maxLength: 800 }),
    date("start_date", "When does the work start?"),
    money("fee", "Fee, in rupees"),
    choice("fee_basis", "The fee is", [
      ["fixed", "a fixed fee for the whole work"],
      ["monthly", "payable every month"],
    ]),
    number("payment_days", "Within how many days of an invoice must the client pay?", { default: 15, min: 0, max: 120 }),
    number("notice_days", "How many days' written notice ends the agreement?", { default: 30, min: 0, max: 180 }),
    text("city", "City whose courts will hear any dispute"),
  ],
  body: [
    { type: "title", text: "Service Agreement" },
    {
      type: "paragraph",
      text: 'This agreement is made on {{agreement_date|date}} between **{{client_name}}**, of {{client_address}} (the "Client"), and **{{provider_name}}**, of {{provider_address}} (the "Service Provider").',
    },
    { type: "clause", heading: "Services", text: "The Service Provider shall provide the following services to the Client from {{start_date|date}}: {{services}}" },
    {
      type: "clause",
      heading: "Fee",
      showIf: { question: "fee_basis", equals: "fixed" },
      text: "The Client shall pay the Service Provider a fixed fee of {{fee|money}} ({{fee|words}}) for the services, exclusive of applicable taxes.",
    },
    {
      type: "clause",
      heading: "Fee",
      showIf: { question: "fee_basis", equals: "monthly" },
      text: "The Client shall pay the Service Provider {{fee|money}} ({{fee|words}}) for each month of service, exclusive of applicable taxes.",
    },
    { type: "clause", heading: "Payment", text: "The Service Provider shall raise invoices for the fee. The Client shall pay each invoice within {{payment_days}} days of receiving it." },
    {
      type: "clause",
      heading: "Standard of work",
      text: "The Service Provider shall perform the services with reasonable skill and care, and shall follow the Client's reasonable instructions.",
    },
    {
      type: "clause",
      heading: "Confidentiality",
      text: "Each party shall keep confidential any non-public information it receives from the other in connection with this agreement, and shall use it only to perform this agreement.",
    },
    {
      type: "clause",
      heading: "Independent contractor",
      text: "The Service Provider is an independent contractor. Nothing in this agreement creates employment, partnership or agency between the parties.",
    },
    {
      type: "clause",
      heading: "Ending the agreement",
      text: "Either party may end this agreement by giving {{notice_days}} days' written notice to the other. The Client shall pay for services provided up to the date the agreement ends.",
    },
    {
      type: "clause",
      heading: "Law and disputes",
      text: "This agreement is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it.",
    },
    { type: "signatures" },
  ],
};

const rentReceipt = {
  ...common,
  key: "rent-receipt",
  industry: "Rentals",
  title: "Rent Receipt",
  summary: "A landlord confirms that rent for a period has been received from a tenant.",
  signatureHint: {
    level: "check",
    text: "A rent receipt is signed by the landlord alone. Receipts for larger cash payments have customarily carried a revenue stamp; check what applies to yours.",
  },
  roles: [{ id: "landlord", name: "Landlord", nameFrom: "landlord_name", color: BLUE, signingOrder: 1 }],
  questions: [
    date("receipt_date", "Date of the receipt", { default: "today" }),
    text("landlord_name", "Landlord's name"),
    text("landlord_pan", "Landlord's PAN, if the tenant needs it for a tax claim", { required: false, maxLength: 10 }),
    text("tenant_name", "Tenant's name"),
    text("property_address", "Address of the rented property"),
    money("amount", "Amount received, in rupees"),
    date("period_from", "Rent is for the period from"),
    date("period_to", "to"),
    choice("payment_mode", "How was it paid?", [
      ["bank", "Bank transfer"],
      ["upi", "UPI"],
      ["cheque", "Cheque"],
      ["cash", "Cash"],
    ]),
  ],
  body: [
    { type: "title", text: "Rent Receipt" },
    { type: "subtitle", text: "Date: {{receipt_date|date}}" },
    {
      type: "paragraph",
      text: "Received from **{{tenant_name}}** the sum of **{{amount|money}}** ({{amount|words}}) as rent for the property at {{property_address}}, for the period from {{period_from|date}} to {{period_to|date}}.",
    },
    {
      type: "table",
      rows: [
        ["Received from", "{{tenant_name}}"],
        ["Property", "{{property_address}}"],
        ["Period", "{{period_from|date}} to {{period_to|date}}"],
        ["Amount", "{{amount|money}}"],
        ["Paid by", "{{payment_mode}}"],
      ],
    },
    { type: "paragraph", showIf: { question: "landlord_pan", answered: true }, text: "Landlord's PAN: {{landlord_pan|upper}}" },
    { type: "signatures" },
  ],
};

const STATES = [
  ["MH", "Maharashtra"],
  ["KA", "Karnataka"],
  ["DL", "Delhi"],
  ["TN", "Tamil Nadu"],
  ["TG", "Telangana"],
  ["OTHER", "Another state or territory"],
];

const rentAgreement = {
  ...common,
  key: "rent-agreement-11-month",
  industry: "Rentals",
  title: "11-Month Rent Agreement (Basic)",
  summary: "A landlord lets a home to a tenant for eleven months at an agreed rent and deposit.",
  signatureHint: {
    level: "stamp_duty",
    text: "Stamp duty applies to rent agreements in every state, at a rate each state sets. Signing here does not pay it. Some states also require registration: see the note for your state.",
  },
  stateNotes: [
    { state: "MH", name: "Maharashtra", note: "Reported to require leave-and-licence agreements to be registered whatever their length. Confirm with the local registration office before relying on an unregistered agreement." },
    { state: "KA", name: "Karnataka", note: "Stamp duty applies. An agreement for less than twelve months is commonly left unregistered; confirm locally." },
    { state: "DL", name: "Delhi", note: "Stamp duty applies. An agreement for less than twelve months is commonly left unregistered; confirm locally." },
    { state: "TN", name: "Tamil Nadu", note: "Reported to require tenancy agreements to be in writing and registered with the rent authority. Confirm locally." },
    { state: "TG", name: "Telangana", note: "Stamp duty applies. An agreement for less than twelve months is commonly left unregistered; confirm locally." },
  ],
  roles: [
    { id: "landlord", name: "Landlord", nameFrom: "landlord_name", color: BLUE, signingOrder: 1 },
    { id: "tenant", name: "Tenant", nameFrom: "tenant_name", color: GREEN, signingOrder: 2 },
  ],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    text("landlord_name", "Landlord's full name"),
    text("landlord_address", "Landlord's address"),
    text("tenant_name", "Tenant's full name"),
    text("tenant_address", "Tenant's permanent address"),
    text("property_address", "Address of the property being let"),
    choice("state", "State where the property is", STATES),
    text("city", "City where the property is"),
    date("start_date", "Date the tenancy starts"),
    money("rent", "Monthly rent, in rupees"),
    number("rent_day", "Day of the month by which rent is due", { default: 5, min: 1, max: 28 }),
    money("deposit", "Security deposit, in rupees", { min: 0 }),
    choice("maintenance_by", "Who pays the society maintenance charges?", [
      ["landlord", "The landlord"],
      ["tenant", "The tenant"],
    ]),
    number("notice_months", "Months of notice either side must give to end the tenancy", { default: 1, min: 1, max: 6 }),
    number("lock_in_months", "Lock-in period in months, if any", { required: false, min: 1, max: 11 }),
  ],
  body: [
    { type: "title", text: "Rent Agreement" },
    {
      type: "paragraph",
      text: 'This rent agreement is made at {{city}} on {{agreement_date|date}} between **{{landlord_name}}**, residing at {{landlord_address}} (the "Landlord"), and **{{tenant_name}}**, permanently residing at {{tenant_address}} (the "Tenant").',
    },
    { type: "paragraph", text: "The Landlord is the owner of the property at {{property_address}} (the \"Premises\") and agrees to let it to the Tenant for residential use on the following terms." },
    {
      type: "clause",
      heading: "Term",
      text: "The tenancy is for eleven months, from {{start_date|date}} to {{start_date|addMonths:11|addDays:-1|date}}. It may be renewed by a fresh written agreement.",
    },
    {
      type: "clause",
      heading: "Rent",
      text: "The Tenant shall pay rent of {{rent|money}} ({{rent|words}}) a month, in advance, on or before day {{rent_day}} of each month.",
    },
    {
      type: "clause",
      heading: "Security deposit",
      text: "The Tenant has paid the Landlord an interest-free security deposit of {{deposit|money}} ({{deposit|words}}). The Landlord shall return it when the Tenant hands back the Premises, after deducting any unpaid rent, unpaid bills and the cost of repairing damage beyond normal wear and tear.",
    },
    {
      type: "clause",
      heading: "Bills and maintenance",
      showIf: { question: "maintenance_by", equals: "tenant" },
      text: "The Tenant shall pay the electricity, water, gas and society maintenance charges for the Premises during the tenancy.",
    },
    {
      type: "clause",
      heading: "Bills and maintenance",
      showIf: { question: "maintenance_by", equals: "landlord" },
      text: "The Tenant shall pay the electricity, water and gas charges for the Premises during the tenancy. The Landlord shall pay the society maintenance charges.",
    },
    {
      type: "clause",
      heading: "Use of the Premises",
      text: "The Tenant shall:",
      items: [
        "use the Premises only as a private home;",
        "keep the Premises and its fittings in good condition;",
        "not sublet or part with possession of the Premises without the Landlord's written consent;",
        "not make structural changes without the Landlord's written consent; and",
        "follow the rules of the housing society or building.",
      ],
    },
    {
      type: "clause",
      heading: "Repairs",
      text: "The Tenant shall carry out minor day-to-day repairs. The Landlord shall carry out major and structural repairs that are not caused by the Tenant's misuse.",
    },
    { type: "clause", heading: "Inspection", text: "The Landlord may inspect the Premises at a reasonable time after giving the Tenant reasonable notice." },
    {
      type: "clause",
      heading: "Lock-in",
      showIf: { question: "lock_in_months", answered: true },
      text: "Neither party may end the tenancy during the first {{lock_in_months}} month(s), except for a serious breach by the other.",
    },
    {
      type: "clause",
      heading: "Ending the tenancy",
      text: "Either party may end the tenancy by giving the other {{notice_months}} month(s)' written notice. The Landlord may end it sooner if rent stays unpaid for two months or the Tenant seriously breaches this agreement. At the end of the tenancy the Tenant shall hand back vacant possession of the Premises.",
    },
    {
      type: "clause",
      heading: "Law and disputes",
      text: "This agreement is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it.",
    },
    { type: "signatures" },
  ],
};

const offerLetter = {
  ...common,
  key: "offer-letter-basic",
  industry: "HR and staffing",
  title: "Offer Letter (Basic)",
  summary: "An employer offers a job to a candidate, who signs to accept.",
  signatureHint: { level: "esign_ok", text: "An ordinary electronic signature is usually used for an offer letter." },
  roles: [
    { id: "employer", name: "For the Employer", nameFrom: "signatory_name", color: BLUE, signingOrder: 1 },
    { id: "candidate", name: "Candidate", nameFrom: "candidate_name", color: GREEN, signingOrder: 2 },
  ],
  questions: [
    date("offer_date", "Date of the letter", { default: "today" }),
    text("employer_name", "Employer: name of the business"),
    text("signatory_name", "Who signs for the employer?"),
    text("signatory_title", "Their job title"),
    text("candidate_name", "Candidate's full name"),
    text("position", "Job title offered"),
    text("location", "Place of work"),
    date("joining_date", "Joining date"),
    money("annual_ctc", "Annual pay (cost to company), in rupees"),
    number("probation_months", "Probation period, in months", { default: 6, min: 0, max: 12 }),
    number("notice_days", "Notice period after probation, in days", { default: 30, min: 0, max: 180 }),
    date("valid_until", "The offer is open until"),
  ],
  body: [
    { type: "title", text: "Offer of Employment" },
    { type: "subtitle", text: "{{employer_name}} - {{offer_date|date}}" },
    { type: "paragraph", text: "Dear **{{candidate_name}}**," },
    { type: "paragraph", text: "We are pleased to offer you the position of **{{position}}** with {{employer_name}}, on the terms below." },
    {
      type: "table",
      rows: [
        ["Position", "{{position}}"],
        ["Place of work", "{{location}}"],
        ["Joining date", "{{joining_date|date}}"],
        ["Annual pay (cost to company)", "{{annual_ctc|money}} ({{annual_ctc|words}})"],
        ["Probation", "{{probation_months}} month(s)"],
        ["Notice period", "{{notice_days}} days after probation"],
      ],
    },
    { type: "clause", heading: "Pay", text: "Your annual pay is stated above. Its break-up, and the deductions the law requires, will be set out in your appointment letter and payslips." },
    { type: "clause", heading: "Probation", text: "During probation either you or the employer may end the employment in accordance with the appointment letter." },
    { type: "clause", heading: "Documents", text: "This offer is subject to satisfactory verification of your identity, qualifications and previous employment." },
    { type: "clause", heading: "Appointment letter", text: "A detailed appointment letter will be issued on or before your joining date. If it differs from this letter, the appointment letter applies." },
    { type: "clause", heading: "Acceptance", text: "This offer is open until {{valid_until|date}}. To accept it, please sign below." },
    { type: "paragraph", text: "{{signatory_name}}, {{signatory_title}}, for {{employer_name}}" },
    { type: "signatures" },
  ],
};

const freelanceContract = {
  ...common,
  key: "freelance-contract",
  industry: "General business",
  title: "Freelance Contract",
  summary: "A freelancer agrees to deliver a piece of work to a client by a date, for a fee.",
  signatureHint: { level: "esign_ok", text: `An ordinary electronic signature is usually used for a freelance contract. ${STAMP_CHECK}` },
  roles: [
    { id: "client", name: "Client", nameFrom: "client_name", color: BLUE, signingOrder: 1 },
    { id: "freelancer", name: "Freelancer", nameFrom: "freelancer_name", color: GREEN, signingOrder: 2 },
  ],
  questions: [
    date("agreement_date", "Date of the contract", { default: "today" }),
    text("client_name", "Client: name of the person or business"),
    text("freelancer_name", "Freelancer's full name"),
    longtext("project", "What will the freelancer deliver?", { maxLength: 800 }),
    date("delivery_date", "Delivery date"),
    money("fee", "Total fee, in rupees"),
    choice("payment_plan", "How is the fee paid?", [
      ["on_delivery", "All on delivery"],
      ["half_half", "Half in advance, half on delivery"],
      ["advance", "All in advance"],
    ]),
    number("revisions", "Rounds of changes included in the fee", { default: 2, min: 0, max: 10 }),
    text("city", "City whose courts will hear any dispute"),
  ],
  body: [
    { type: "title", text: "Freelance Contract" },
    { type: "paragraph", text: 'This contract is made on {{agreement_date|date}} between **{{client_name}}** (the "Client") and **{{freelancer_name}}** (the "Freelancer").' },
    { type: "clause", heading: "The work", text: "The Freelancer shall deliver the following to the Client by {{delivery_date|date}}: {{project}}" },
    { type: "clause", heading: "Fee", text: "The Client shall pay the Freelancer {{fee|money}} ({{fee|words}}), exclusive of applicable taxes." },
    { type: "clause", heading: "Payment", showIf: { question: "payment_plan", equals: "on_delivery" }, text: "The fee is payable in full within seven days of delivery." },
    { type: "clause", heading: "Payment", showIf: { question: "payment_plan", equals: "half_half" }, text: "Half of the fee is payable before work starts and the balance within seven days of delivery." },
    { type: "clause", heading: "Payment", showIf: { question: "payment_plan", equals: "advance" }, text: "The fee is payable in full before work starts." },
    { type: "clause", heading: "Changes", text: "The fee includes {{revisions}} round(s) of changes asked for within fourteen days of delivery. Further changes are charged as the parties agree in writing." },
    {
      type: "clause",
      heading: "Ownership",
      text: "Once the fee is paid in full, the Freelancer assigns to the Client all rights in the delivered work. Until then the rights stay with the Freelancer. The Freelancer may show the work in a portfolio unless the Client objects in writing.",
    },
    { type: "clause", heading: "Original work", text: "The Freelancer confirms that the work will be original and will not knowingly infringe anyone else's rights." },
    { type: "clause", heading: "Confidentiality", text: "The Freelancer shall keep the Client's non-public information confidential and use it only for this work." },
    { type: "clause", heading: "Independent contractor", text: "The Freelancer is an independent contractor and not an employee of the Client." },
    { type: "clause", heading: "Law and disputes", text: "This contract is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it." },
    { type: "signatures" },
  ],
};

const consentForm = {
  ...common,
  key: "consent-form",
  industry: "General",
  title: "Consent Form",
  summary: "A person gives written consent to something an organisation has explained to them.",
  signatureHint: {
    level: "check",
    text: "An ordinary electronic signature records that consent was given. Consent to process personal data and consent to medical treatment have their own legal requirements; check them before using this form for either.",
  },
  roles: [{ id: "person", name: "Person giving consent", nameFrom: "person_name", color: BLUE, signingOrder: 1 }],
  questions: [
    date("consent_date", "Date", { default: "today" }),
    text("organisation", "Who is asking for consent? (person or organisation)"),
    text("person_name", "Full name of the person giving consent"),
    longtext("subject", "What are they consenting to?", { help: "Write it the way you explained it to them.", maxLength: 1200 }),
    date("valid_until", "Consent is valid until (leave empty if it has no end date)", { required: false }),
  ],
  body: [
    { type: "title", text: "Consent Form" },
    { type: "subtitle", text: "{{consent_date|date}}" },
    { type: "paragraph", text: "I, **{{person_name}}**, give my consent to **{{organisation}}** for the following:" },
    { type: "paragraph", text: "{{subject}}" },
    {
      type: "list",
      items: [
        "This has been explained to me and I have had the chance to ask questions.",
        "I give this consent freely.",
        "I understand that I can withdraw this consent at any time by telling {{organisation}} in writing, and that withdrawing it does not affect anything already done.",
        { text: "This consent is valid until {{valid_until|date}}.", showIf: { question: "valid_until", answered: true } },
      ],
    },
    { type: "signatures" },
  ],
};

const acknowledgement = {
  ...common,
  key: "acknowledgement-of-receipt",
  industry: "General",
  title: "Acknowledgement of Receipt",
  summary: "A person confirms in writing that they have received documents, goods or money.",
  signatureHint: { level: "esign_ok", text: "An ordinary electronic signature is usually used to acknowledge receipt." },
  roles: [{ id: "receiver", name: "Received by", nameFrom: "receiver_name", color: BLUE, signingOrder: 1 }],
  questions: [
    date("received_date", "Date received", { default: "today" }),
    text("receiver_name", "Who received it? (full name)"),
    text("giver_name", "Who handed it over? (person or organisation)"),
    longtext("items", "What was received?", { help: "List the documents, goods or amount.", maxLength: 1200 }),
    choice("condition", "Condition on receipt", [
      ["good", "Complete and in good condition"],
      ["noted", "Received with the remarks below"],
    ]),
    longtext("remarks", "Remarks", { required: false, showIf: { question: "condition", equals: "noted" }, maxLength: 600 }),
  ],
  body: [
    { type: "title", text: "Acknowledgement of Receipt" },
    { type: "paragraph", text: "I, **{{receiver_name}}**, confirm that on {{received_date|date}} I received the following from **{{giver_name}}**:" },
    { type: "paragraph", text: "{{items}}" },
    { type: "paragraph", showIf: { question: "condition", equals: "good" }, text: "I received it complete and in good condition." },
    { type: "paragraph", showIf: { question: "condition", equals: "noted" }, text: "I received it with these remarks: {{remarks}}" },
    { type: "signatures" },
  ],
};

export default [mutualNda, serviceAgreement, rentReceipt, rentAgreement, offerLetter, freelanceContract, consentForm, acknowledgement];
