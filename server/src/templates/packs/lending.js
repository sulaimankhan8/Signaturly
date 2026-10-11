// The Lending pack: eight loan papers (plan task P6-07).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
//
// Lending is regulated. A lender bound by the Reserve Bank's directions must give borrowers
// particular documents in particular forms (a key fact statement among them), and these drafts
// do not produce those. A promissory note is deliberately not in this pack: negotiable
// instruments are among the documents the Information Technology Act keeps outside electronic
// signing.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, PURPLE, pack, role, hint, title, p, c, note, table, list, sign, when, cityQuestion, law } from "./_helpers.js";

const common = { ...pack("lending"), industry: "Lending" };

const LOAN_STAMP = hint.stamp(
  "Loan agreements and guarantees attract stamp duty at a rate each state sets, often by the loan amount. Signing here does not pay it. Lenders commonly ask for Aadhaar eSign or a stronger signature for these documents."
);

const lender = [text("lender_name", "Lender: name"), text("lender_address", "Lender: address"), text("lender_signatory", "Signing for the lender: name")];
const borrower = [text("borrower_name", "Borrower: full name"), text("borrower_address", "Borrower: address")];
const forLender = role("lender", "For the Lender", "lender_signatory", BLUE, 1);
const theBorrower = role("borrower", "Borrower", "borrower_name", GREEN, 2);

const sanction = {
  ...common,
  key: "loan-sanction-letter",
  title: "Loan Sanction Letter with Acceptance",
  summary: "A lender tells a borrower the terms on which a loan is approved, and the borrower accepts them.",
  signatureHint: hint.check("Signed for the lender and accepted by the borrower. A regulated lender must also give the borrower the disclosures its regulator requires; this letter does not replace them."),
  roles: [forLender, theBorrower],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...lender,
    ...borrower,
    text("loan_type", "Kind of loan, for example personal loan"),
    money("amount", "Loan amount, in rupees"),
    number("rate", "Interest rate, per cent a year", { min: 0, max: 60 }),
    choice("rate_type", "The rate is", [["fixed", "fixed"], ["floating", "floating"]]),
    number("tenure_months", "Tenure, in months", { min: 1, max: 480 }),
    money("emi", "Monthly instalment, in rupees"),
    money("processing_fee", "Processing fee, in rupees", { min: 0 }),
    optional(text("security", "Security or guarantee required")),
    number("valid_days", "Days for which this sanction is open", { default: 30, min: 1, max: 180 }),
  ],
  body: [
    title("Loan Sanction Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{borrower_name}}**, {{borrower_address}}"),
    p("We are pleased to tell you that {{lender_name}} has approved a {{loan_type}} on the terms below."),
    table([["Loan amount", "{{amount|money}}"], ["Interest", "{{rate}} per cent a year, {{rate_type}}"], ["Tenure", "{{tenure_months}} months"], ["Monthly instalment", "{{emi|money}}"], ["Processing fee", "{{processing_fee|money}}"], ["Security", "{{security}}"]]),
    list(["The loan will be paid out after the loan agreement and the other documents we ask for are signed.", "The terms of the loan agreement apply; where this letter and that agreement differ, the agreement decides.", "This sanction is open for {{valid_days}} days from the date of this letter.", "We may withdraw it if anything in your application turns out to be untrue or your circumstances change materially."]),
    p("For {{lender_name}}: {{lender_signatory}}"),
    p("I, {{borrower_name}}, accept the loan on these terms."),
    sign(),
  ],
};

const loanAgreement = {
  ...common,
  key: "simple-loan-agreement",
  title: "Simple Loan Agreement",
  summary: "A lender lends a sum to a borrower, to be repaid with interest in monthly instalments.",
  signatureHint: LOAN_STAMP,
  roles: [forLender, theBorrower],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    ...lender,
    ...borrower,
    money("amount", "Loan amount, in rupees"),
    text("purpose", "Purpose of the loan"),
    number("rate", "Interest rate, per cent a year", { min: 0, max: 60 }),
    number("tenure_months", "Number of monthly instalments", { min: 1, max: 480 }),
    money("emi", "Each instalment, in rupees"),
    date("first_due", "First instalment due on"),
    number("penal_rate", "Extra charge on overdue amounts, per cent a year", { default: 2, min: 0, max: 36 }),
    choice("prepayment", "Paying early is", [["free", "allowed without charge"], ["charged", "allowed with a charge"]]),
    optional(number("prepayment_percent", "Charge for paying early, per cent of the amount prepaid", { min: 0, max: 10 })),
    cityQuestion,
  ],
  body: [
    title("Loan Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{lender_name}}**, of {{lender_address}} (the "Lender"), acting through {{lender_signatory}}, and **{{borrower_name}}**, of {{borrower_address}} (the "Borrower").'),
    c("The loan", "The Lender lends the Borrower {{amount|money}} ({{amount|words}}) for this purpose: {{purpose}}. The Borrower shall use it for that purpose only."),
    c("Interest", "Interest is charged at {{rate}} per cent a year on the amount outstanding."),
    c("Repayment", "The Borrower shall repay the loan with interest in {{tenure_months}} monthly instalments of {{emi|money}} ({{emi|words}}) each, the first on {{first_due|date}} and the rest on the same day of each following month."),
    c("Late payment", "An instalment not paid on its due date carries an extra charge of {{penal_rate}} per cent a year on the overdue amount until it is paid."),
    c("Paying early", "The Borrower may repay all or part of the loan early at any time without charge.", { showIf: when("prepayment", "free") }),
    c("Paying early", "The Borrower may repay all or part of the loan early, with a charge of {{prepayment_percent}} per cent of the amount prepaid.", { showIf: when("prepayment", "charged") }),
    c("Default", "If three instalments are overdue, or anything the Borrower stated to obtain the loan proves untrue, the Lender may by written notice call in the whole amount outstanding."),
    c("Borrower's statements", "The Borrower confirms that what they have told the Lender about their identity, income and debts is true, and will tell the Lender of any change of address or of circumstances that affects repayment."),
    law,
    sign(),
  ],
};

const guarantee = {
  ...common,
  key: "personal-guarantee",
  title: "Personal Guarantee",
  summary: "A guarantor promises the lender to pay what a borrower owes under a loan if the borrower does not.",
  signatureHint: LOAN_STAMP,
  roles: [role("guarantor", "Guarantor", "guarantor_name", PURPLE, 1), { ...forLender, signingOrder: 2 }],
  questions: [
    date("guarantee_date", "Date of the guarantee", { default: "today" }),
    ...lender,
    text("borrower_name", "Borrower: full name"),
    text("guarantor_name", "Guarantor: full name"),
    text("guarantor_address", "Guarantor: address"),
    date("loan_date", "Date of the loan agreement"),
    money("amount", "Loan amount, in rupees"),
    money("limit", "The most the guarantor can be asked to pay, in rupees"),
    cityQuestion,
  ],
  body: [
    title("Personal Guarantee"),
    p('This guarantee is given on {{guarantee_date|date}} by **{{guarantor_name}}**, of {{guarantor_address}} (the "Guarantor"), to **{{lender_name}}**, of {{lender_address}} (the "Lender").'),
    c("Background", "The Lender has lent or agreed to lend {{amount|money}} to {{borrower_name}} (the \"Borrower\") under a loan agreement dated {{loan_date|date}}, and has asked for this guarantee."),
    c("Guarantee", "The Guarantor promises that if the Borrower does not pay any amount due under the loan agreement, the Guarantor will pay it within 15 days of the Lender asking in writing."),
    c("Limit", "The most the Guarantor can be asked to pay under this guarantee is {{limit|money}} ({{limit|words}}), together with interest on that sum from the date of the Lender's demand."),
    c("Continuing guarantee", "This guarantee continues until everything due under the loan agreement is paid. It is not ended by the Lender giving the Borrower more time or by a change in the loan's terms that the Guarantor has agreed to in writing."),
    c("Guarantor's confirmation", "The Guarantor has read the loan agreement, understands that they may have to pay the Borrower's debt, and gives this guarantee freely."),
    law,
    sign(),
  ],
};

const bureauConsent = {
  ...common,
  key: "borrower-consent-declaration",
  title: "Borrower Consent and Declaration",
  summary: "A loan applicant consents to credit and identity checks and declares that the application is true.",
  signatureHint: hint.esign("a consent and declaration"),
  roles: [role("applicant", "Applicant", "applicant_name")],
  questions: [
    date("consent_date", "Date", { default: "today" }),
    text("lender_name", "Lender: name"),
    text("applicant_name", "Applicant: full name"),
    text("applicant_address", "Applicant: address"),
    text("application_number", "Loan application number"),
    text("grievance_contact", "Lender's contact for questions and complaints"),
  ],
  body: [
    title("Consent and Declaration"),
    p("I, **{{applicant_name}}**, of {{applicant_address}}, have applied to {{lender_name}} for a loan (application {{application_number}})."),
    c("Consent", "I consent to {{lender_name}}:", { items: ["obtaining my credit information from credit information companies;", "verifying my identity, address, income and employment with the records and people concerned;", "using and storing the information and documents I have given for deciding on and servicing the loan; and", "reporting how I repay the loan to credit information companies, as the law requires."] }),
    c("Declaration", "I declare that:", { items: ["everything I have stated in my application is true and complete;", "the documents I have given are genuine;", "I have not hidden any existing loan or default; and", "I will tell the lender promptly of any change in what I have stated."] }),
    p("I understand that I can raise a question or complaint with {{grievance_contact}}."),
    p("Date: {{consent_date|date}}"),
    sign(),
  ],
};

const closure = {
  ...common,
  key: "loan-closure-letter",
  title: "Loan Closure and No-Dues Letter",
  summary: "A lender confirms that a loan has been repaid in full and that nothing further is owed.",
  signatureHint: hint.esign("a no-dues letter"),
  roles: [forLender],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...lender,
    ...borrower,
    text("loan_account", "Loan account number"),
    money("amount", "Original loan amount, in rupees"),
    date("loan_date", "Date of the loan"),
    date("closure_date", "Date the loan was fully repaid"),
    optional(longtext("security_released", "Security or documents being returned", { maxLength: 500 })),
  ],
  body: [
    title("Loan Closure and No-Dues Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{borrower_name}}**, {{borrower_address}}"),
    p("Loan account {{loan_account}}: a loan of {{amount|money}} taken on {{loan_date|date}}."),
    p("We confirm that this loan was repaid in full on **{{closure_date|date}}**. Nothing further is owed to {{lender_name}} on this account, and the account is closed."),
    p("The following are released and returned to you: {{security_released}}", { question: "security_released", answered: true }),
    p("We will report the closure to the credit information companies in the usual course."),
    p("For {{lender_name}}: {{lender_signatory}}"),
    sign(),
  ],
};

const application = {
  ...common,
  key: "loan-application-form",
  title: "Loan Application Form",
  summary: "A person applies for a loan, stating who they are, what they earn and owe, and how much they want to borrow.",
  signatureHint: hint.check("Signed by the applicant. A regulated lender has its own application format and must collect the identity documents its regulator requires; this form does not replace them."),
  roles: [role("applicant", "Applicant", "applicant_name")],
  questions: [
    date("application_date", "Date of the application", { default: "today" }),
    text("lender_name", "Lender: name"),
    text("applicant_name", "Applicant: full name"),
    date("applicant_dob", "Applicant: date of birth"),
    text("applicant_address", "Applicant: present address"),
    text("applicant_phone", "Applicant: mobile number"),
    choice("employment", "The applicant is", [["salaried", "salaried"], ["self-employed", "self-employed"], ["in business", "in business"], ["retired", "retired"]]),
    text("employer", "Employer or business name"),
    money("monthly_income", "Monthly income, in rupees"),
    money("existing_emis", "Total of existing monthly loan instalments, in rupees", { min: 0 }),
    text("loan_type", "Kind of loan wanted"),
    money("amount", "Amount wanted, in rupees"),
    number("tenure_months", "Repayment period wanted, in months", { min: 1, max: 480 }),
    text("purpose", "Purpose of the loan"),
    optional(text("security_offered", "Security or guarantor offered")),
  ],
  body: [
    title("Loan Application"),
    p("To: **{{lender_name}}**. Date: {{application_date|date}}"),
    table([["Applicant", "{{applicant_name}}"], ["Date of birth", "{{applicant_dob|date}}"], ["Address", "{{applicant_address}}"], ["Mobile", "{{applicant_phone}}"], ["Occupation", "{{employment}}, {{employer}}"], ["Monthly income", "{{monthly_income|money}}"], ["Existing instalments a month", "{{existing_emis|money}}"]]),
    table([["Loan wanted", "{{loan_type}}"], ["Amount", "{{amount|money}}"], ["Repayment period", "{{tenure_months}} months"], ["Purpose", "{{purpose}}"], ["Security or guarantor", "{{security_offered}}"]]),
    c("Declaration", "I declare that:", { items: ["what I have stated above is true and complete;", "I have not hidden any loan, default or legal proceeding against me;", "I will give the lender the documents it asks for to check this application; and", "I understand that this is an application only, and that the lender may refuse it."] }),
    sign(),
  ],
};

const reschedule = {
  ...common,
  key: "loan-reschedule-letter",
  title: "Loan Repayment Rescheduling Letter",
  summary: "Lender and borrower record an agreed change to how an existing loan will be repaid.",
  signatureHint: hint.check("Signed by both sides. A change to a stamped loan agreement may itself attract stamp duty, and a regulated lender must follow its regulator's rules on restructuring; check both before relying on this."),
  roles: [forLender, theBorrower],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...lender,
    ...borrower,
    text("loan_account", "Loan account number"),
    date("loan_date", "Date of the loan agreement"),
    money("outstanding", "Amount outstanding today, in rupees"),
    money("new_emi", "New monthly instalment, in rupees"),
    number("new_tenure_months", "Number of instalments from now", { min: 1, max: 480 }),
    date("first_due", "First new instalment due on"),
    number("rate", "Interest rate from now, per cent a year", { min: 0, max: 60 }),
    optional(longtext("reason", "Why the change is being made", { maxLength: 500 })),
  ],
  body: [
    title("Rescheduling of Loan Repayment"),
    p("Date: {{letter_date|date}}"),
    p('Between **{{lender_name}}**, of {{lender_address}} (the "Lender"), and **{{borrower_name}}**, of {{borrower_address}} (the "Borrower"), about loan account {{loan_account}} under the agreement dated {{loan_date|date}}.'),
    c("Background", "{{reason}}", { showIf: { question: "reason", answered: true } }),
    c("Amount outstanding", "The parties agree that {{outstanding|money}} ({{outstanding|words}}) is outstanding on the loan today, including interest to date."),
    c("New repayment", "The Borrower shall repay that amount, with interest at {{rate}} per cent a year, in {{new_tenure_months}} monthly instalments of {{new_emi|money}} ({{new_emi|words}}) each, the first on {{first_due|date}} and the rest on the same day of each following month."),
    c("Everything else", "Every other term of the loan agreement, and any security or guarantee given for the loan, continues to apply. This letter does not excuse any default that happens after its date."),
    p("For {{lender_name}}: {{lender_signatory}}"),
    sign(),
  ],
};

const hypothecation = {
  ...common,
  key: "deed-of-hypothecation",
  title: "Deed of Hypothecation of Movable Goods",
  summary: "A borrower gives a lender a charge over movable goods, such as a vehicle, machinery or stock, as security for a loan, while keeping possession of them.",
  signatureHint: LOAN_STAMP,
  roles: [{ ...theBorrower, signingOrder: 1 }, { ...forLender, signingOrder: 2 }],
  questions: [
    date("deed_date", "Date of the deed", { default: "today" }),
    ...lender,
    ...borrower,
    date("loan_date", "Date of the loan agreement"),
    money("amount", "Loan amount, in rupees"),
    longtext("goods", "The goods given as security, described so they can be identified", { help: "For a vehicle: make, model, registration, chassis and engine numbers", maxLength: 1000 }),
    text("location", "Where the goods are kept"),
    cityQuestion,
  ],
  body: [
    title("Deed of Hypothecation"),
    p('This deed is made on {{deed_date|date}} between **{{borrower_name}}**, of {{borrower_address}} (the "Borrower"), and **{{lender_name}}**, of {{lender_address}} (the "Lender"), acting through {{lender_signatory}}.'),
    c("Background", "The Lender has lent or agreed to lend the Borrower {{amount|money}} ({{amount|words}}) under a loan agreement dated {{loan_date|date}}, on condition that the Borrower gives the security in this deed."),
    c("The goods", "{{goods}} They are kept at {{location}}."),
    c("Charge", "As security for everything due under the loan agreement, the Borrower hypothecates the goods to the Lender by way of first charge. The Borrower keeps possession and use of the goods."),
    c("Borrower's promises", "The Borrower:", { items: ["owns the goods and has not charged them to anyone else;", "shall not sell, let, part with or charge them without the Lender's written consent;", "shall keep them in good condition and insured for their full value, with the Lender's interest noted on the policy;", "shall not move them from the place above without telling the Lender; and", "shall let the Lender inspect them at any reasonable time."] }),
    c("If the Borrower defaults", "If any amount under the loan agreement stays unpaid after the Lender's written demand, the Lender may, after giving the notice the law requires, take possession of the goods and sell them, apply the proceeds to what is owed and its reasonable costs, and return any balance to the Borrower. The Borrower remains liable for any shortfall."),
    c("Release", "When everything due under the loan agreement has been paid, this charge ends and the Lender shall confirm that in writing."),
    law,
    sign(),
  ],
};

export default [sanction, loanAgreement, guarantee, bureauConsent, closure, application, reschedule, hypothecation];
