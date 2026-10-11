// The HR and staffing pack: ten documents from appointment to full-and-final settlement
// (plan task P5-10).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
// Labour law differs by state, by industry and by the size of the employer: notice periods,
// leave, working hours and what may be deducted from wages are all regulated. These drafts
// state what the employer types in and do not check it against any law.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, pack, role, hint, title, p, c, note, table, list, sign, when, cityQuestion, law } from "./_helpers.js";

const common = { ...pack("hr"), industry: "HR and staffing" };

const employer = [text("company_name", "Employer: name of the company or firm"), text("company_address", "Employer: address")];
const signatory = [text("signatory_name", "Signing for the employer: name"), text("signatory_title", "Their designation")];
const employee = [text("employee_name", "Employee: full name"), text("employee_address", "Employee: address")];
const forEmployer = role("employer", "For the Employer", "signatory_name", BLUE, 1);
const theEmployee = role("employee", "Employee", "employee_name", GREEN, 2);
const signedFor = p("For {{company_name}}: {{signatory_name}}, {{signatory_title}}");

const appointment = {
  ...common,
  key: "appointment-letter",
  title: "Appointment Letter",
  summary: "The employer confirms an appointment: role, start date, pay, probation, hours, leave and notice.",
  signatureHint: hint.esign("an appointment letter"),
  roles: [forEmployer, theEmployee],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    ...employee,
    text("designation", "Designation"),
    text("department", "Department or team"),
    text("work_location", "Place of work"),
    date("joining_date", "Date of joining"),
    money("annual_ctc", "Annual cost to company, in rupees"),
    number("probation_months", "Probation, in months (0 for none)", { default: 6, min: 0, max: 24 }),
    text("working_hours", "Working days and hours, for example Monday to Friday, 9:30 am to 6:30 pm"),
    number("leave_days", "Paid leave in a year, in days", { default: 18, min: 0, max: 60 }),
    number("notice_days", "Notice to end employment after probation, in days", { default: 30, min: 0, max: 180 }),
    ...signatory,
  ],
  body: [
    title("Letter of Appointment"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{employee_name}}**, {{employee_address}}"),
    p("We are pleased to appoint you as **{{designation}}** in {{department}} at {{company_name}}, {{company_address}}, on the terms below."),
    c("Joining and place of work", "You will join on {{joining_date|date}} and work at {{work_location}}. The company may ask you to work at another of its locations when its work requires."),
    c("Pay", "Your annual cost to the company is {{annual_ctc|money}} ({{annual_ctc|words}}), paid monthly after the deductions the law requires. The break-up is given in the annexure to this letter."),
    c("Probation", "You will be on probation for {{probation_months}} month(s). During probation either side may end the employment with 7 days of written notice."),
    c("Hours and leave", "Working days and hours are {{working_hours}}. You are entitled to {{leave_days}} days of paid leave in a year, taken as the company's leave policy provides, in addition to declared holidays."),
    c("Confidentiality", "You shall keep the company's confidential information secret during and after your employment and use it only for your work."),
    c("Ending employment", "After probation, either side may end the employment with {{notice_days}} days of written notice or pay in place of notice. The company may end it without notice for serious misconduct."),
    c("Policies", "You shall follow the company's policies and code of conduct as they stand from time to time."),
    p("Please sign below to accept this appointment."),
    signedFor,
    sign(),
  ],
};

const employmentAgreement = {
  ...common,
  key: "employment-agreement",
  title: "Employment Agreement",
  summary: "A fuller agreement between employer and employee, covering duties, pay, confidentiality, inventions and ending the employment.",
  signatureHint: hint.esign("an employment agreement"),
  roles: [forEmployer, theEmployee],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    ...employer,
    ...employee,
    text("designation", "Designation"),
    longtext("duties", "Main duties", { maxLength: 800 }),
    date("joining_date", "Employment starts on"),
    money("monthly_salary", "Gross monthly salary, in rupees"),
    number("notice_days", "Notice to end employment, in days", { default: 60, min: 0, max: 180 }),
    number("non_solicit_months", "Months after leaving during which the employee will not approach the company's staff or customers", { default: 12, min: 1, max: 24 }),
    cityQuestion,
    ...signatory,
  ],
  body: [
    title("Employment Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{company_name}}**, of {{company_address}} (the "Company"), acting through {{signatory_name}}, {{signatory_title}}, and **{{employee_name}}**, of {{employee_address}} (the "Employee").'),
    c("Position and duties", "The Company employs the Employee as {{designation}} from {{joining_date|date}}. The Employee's main duties are: {{duties}} The Employee shall give their full working time to these duties and follow the Company's reasonable instructions."),
    c("Salary", "The Company shall pay the Employee a gross salary of {{monthly_salary|money}} ({{monthly_salary|words}}) a month, after the deductions the law requires."),
    c("Confidential information", "The Employee shall not, during or after the employment, disclose or use the Company's confidential information except for the Company's work, and shall return all Company property and records on leaving."),
    c("Work created", "Everything the Employee creates in the course of the employment, including designs, software and written material, belongs to the Company. The Employee shall sign whatever is needed to record that."),
    c("Other work", "The Employee shall not take up other paid work during the employment without the Company's written consent."),
    c("After leaving", "For {{non_solicit_months}} month(s) after the employment ends, the Employee shall not ask the Company's employees to leave it or approach its customers with whom the Employee dealt in order to take their business away."),
    c("Ending the employment", "Either side may end the employment with {{notice_days}} days of written notice or pay in place of notice. The Company may end it without notice for serious misconduct, after giving the Employee a chance to explain."),
    law,
    sign(),
  ],
};

const employeeNda = {
  ...common,
  key: "employee-confidentiality-agreement",
  title: "Employee Confidentiality and Inventions Agreement",
  summary: "An employee undertakes to keep the employer's information confidential and confirms that work created in the job belongs to the employer.",
  signatureHint: hint.esign("a confidentiality agreement"),
  roles: [theEmployee, { ...forEmployer, signingOrder: 2 }],
  questions: [
    date("agreement_date", "Date", { default: "today" }),
    ...employer,
    ...employee,
    text("designation", "Employee's designation"),
    number("survive_years", "Years after leaving for which confidentiality continues", { default: 3, min: 1, max: 10 }),
    cityQuestion,
    ...signatory,
  ],
  body: [
    title("Confidentiality and Inventions Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{company_name}}**, of {{company_address}} (the "Company"), and **{{employee_name}}**, {{designation}}, of {{employee_address}} (the "Employee").'),
    c("Confidential information", "Confidential information means anything the Employee learns through the employment that is not public, including customer and price lists, business plans, source code, designs, processes and personal data held by the Company."),
    c("Duty of confidence", "The Employee shall:", { items: ["use confidential information only for the Company's work;", "not disclose it to anyone outside the Company without written permission;", "not copy it or take it off the Company's systems except as the work requires; and", "return or delete all of it on leaving."] }),
    c("How long", "These duties continue during the employment and for {{survive_years}} year(s) after it ends. They continue without limit for information that remains a trade secret."),
    c("Work created", "Everything the Employee creates in the course of the employment belongs to the Company. The Employee shall tell the Company promptly of anything invented in the course of the work and sign whatever is needed to record the Company's ownership."),
    c("What is not covered", "These duties do not apply to information that is public otherwise than through the Employee's fault, or that a law or a court requires the Employee to disclose."),
    law,
    signedFor,
    sign(),
  ],
};

const internship = {
  ...common,
  key: "internship-letter",
  title: "Internship Offer Letter",
  summary: "An organisation offers an internship for a fixed period, with the stipend, mentor and what is expected.",
  signatureHint: hint.esign("an internship letter"),
  roles: [forEmployer, role("intern", "Intern", "intern_name", GREEN, 2)],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("intern_name", "Intern: full name"),
    optional(text("college", "College or institute")),
    text("project", "Team or project"),
    text("mentor", "Mentor or supervisor"),
    date("start_date", "Internship starts on"),
    date("end_date", "Internship ends on"),
    choice("paid", "The internship is", [["paid", "paid"], ["unpaid", "unpaid"]]),
    optional(money("stipend", "Monthly stipend, in rupees", { min: 0 })),
    text("working_hours", "Days and hours"),
    ...signatory,
  ],
  body: [
    title("Internship Offer"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{intern_name}}** {{college}}"),
    p("We are glad to offer you an internship at {{company_name}} with {{project}}, from {{start_date|date}} to {{end_date|date}}. {{mentor}} will guide your work. Days and hours are {{working_hours}}."),
    p("You will be paid a stipend of {{stipend|money}} a month.", when("paid", "paid")),
    p("The internship is unpaid.", when("paid", "unpaid")),
    list(["An internship is for learning. It is not employment and gives no right to a job afterwards.", "You shall keep confidential whatever you learn about the organisation's business, and work you produce belongs to the organisation.", "You shall follow the organisation's rules and code of conduct.", "Either side may end the internship with 7 days of notice.", "A certificate will be given on satisfactory completion."]),
    signedFor,
    sign(),
  ],
};

const confirmation = {
  ...common,
  key: "probation-confirmation-letter",
  title: "Confirmation of Employment after Probation",
  summary: "The employer confirms an employee in service at the end of probation.",
  signatureHint: hint.esign("a confirmation letter"),
  roles: [forEmployer],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    text("designation", "Designation"),
    date("joining_date", "Date of joining"),
    date("confirmation_date", "Confirmed with effect from"),
    number("notice_days", "Notice period after confirmation, in days", { default: 30, min: 0, max: 180 }),
    ...signatory,
  ],
  body: [
    title("Confirmation of Employment"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{employee_name}}** (employee code {{employee_code}}), {{designation}}"),
    p("You joined {{company_name}} on {{joining_date|date}}. We are pleased to tell you that you have completed your probation satisfactorily and are confirmed in the company's service with effect from **{{confirmation_date|date}}**."),
    p("From that date the notice period for either side is {{notice_days}} days. The other terms of your appointment stay as they are."),
    p("We wish you a long and rewarding time with us."),
    signedFor,
    sign(),
  ],
};

const salaryRevision = {
  ...common,
  key: "salary-revision-letter",
  title: "Salary Revision Letter",
  summary: "The employer tells an employee of a change in pay, and of any change in designation, from a given date.",
  signatureHint: hint.esign("a salary revision letter"),
  roles: [forEmployer],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    money("old_ctc", "Present annual cost to company, in rupees"),
    money("new_ctc", "Revised annual cost to company, in rupees"),
    date("effective_date", "With effect from"),
    optional(text("new_designation", "New designation, if it changes")),
    ...signatory,
  ],
  body: [
    title("Salary Revision"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{employee_name}}** (employee code {{employee_code}})"),
    p("In recognition of your work, your annual cost to the company is revised from {{old_ctc|money}} to **{{new_ctc|money}}** ({{new_ctc|words}}) with effect from {{effective_date|date}}. The revised break-up is in the annexure."),
    p("From the same date your designation will be {{new_designation}}.", { question: "new_designation", answered: true }),
    p("The other terms of your employment stay as they are. Please keep the details of your pay confidential."),
    signedFor,
    sign(),
  ],
};

const warning = {
  ...common,
  key: "warning-letter",
  title: "Warning Letter",
  summary: "The employer records a concern about an employee's conduct or performance and says what must change.",
  signatureHint: hint.check("Signed for the employer; the employee signs only to confirm receiving it. Disciplinary action must follow the employer's standing orders or policy and give the employee a fair chance to answer."),
  roles: [forEmployer, { ...theEmployee, name: "Employee (received)" }],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    text("designation", "Designation"),
    longtext("incident", "What happened, with dates", { maxLength: 1200 }),
    longtext("expected", "What is expected from now on", { maxLength: 800 }),
    optional(date("review_date", "Date by which it will be reviewed")),
    ...signatory,
  ],
  body: [
    title("Warning Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{employee_name}}** (employee code {{employee_code}}), {{designation}}"),
    c("The concern", "{{incident}}"),
    c("What is expected", "{{expected}}"),
    p("The matter will be reviewed on {{review_date|date}}.", { question: "review_date", answered: true }),
    p("This letter is placed on your record. If the same happens again, the company may take further action under its policy. If you think any part of this letter is wrong, give your explanation in writing within 7 days."),
    p("Signing below confirms only that you have received this letter. It does not mean you agree with it."),
    signedFor,
    sign(),
  ],
};

const relieving = {
  ...common,
  key: "relieving-letter",
  title: "Resignation Acceptance and Relieving Letter",
  summary: "The employer accepts a resignation and confirms the employee's last working day and that they are relieved of their duties.",
  signatureHint: hint.esign("a relieving letter"),
  roles: [forEmployer],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    text("designation", "Designation"),
    date("joining_date", "Date of joining"),
    date("resignation_date", "Date of the resignation"),
    date("last_day", "Last working day"),
    ...signatory,
  ],
  body: [
    title("Relieving Letter"),
    p("Date: {{letter_date|date}}"),
    p("To: **{{employee_name}}** (employee code {{employee_code}})"),
    p("Your resignation dated {{resignation_date|date}} from the post of {{designation}} has been accepted. You are relieved of your duties at {{company_name}} at the close of work on **{{last_day|date}}**. You were with the company from {{joining_date|date}}."),
    p("Your dues will be settled in the full-and-final settlement. Your duty to keep the company's information confidential continues after you leave."),
    p("We thank you for your work and wish you well."),
    signedFor,
    sign(),
  ],
};

const experience = {
  ...common,
  key: "experience-letter",
  title: "Experience Letter",
  summary: "The employer certifies when someone worked for it and in what role.",
  signatureHint: hint.esign("an experience letter"),
  roles: [forEmployer],
  questions: [
    date("letter_date", "Date of the letter", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    text("designation", "Last designation held"),
    date("joining_date", "Worked from"),
    date("last_day", "Worked until"),
    optional(longtext("responsibilities", "Main responsibilities", { maxLength: 800 })),
    choice("conduct", "Conduct during the employment was", [["good", "good"], ["very good", "very good"], ["satisfactory", "satisfactory"]]),
    ...signatory,
  ],
  body: [
    title("Experience Letter"),
    p("Date: {{letter_date|date}}"),
    p("To whom it may concern"),
    p("This is to certify that **{{employee_name}}** (employee code {{employee_code}}) worked with {{company_name}}, {{company_address}}, from {{joining_date|date}} to {{last_day|date}}, and held the post of **{{designation}}** on leaving."),
    c("Responsibilities", "{{responsibilities}}", { showIf: { question: "responsibilities", answered: true } }),
    p("During this time their conduct was {{conduct}}. We wish them well."),
    signedFor,
    sign(),
  ],
};

const fullAndFinal = {
  ...common,
  key: "full-and-final-settlement",
  title: "Full and Final Settlement",
  summary: "Employer and employee record the amounts paid on leaving and confirm that nothing further is due.",
  signatureHint: hint.check("Signed by both sides. An employee cannot sign away dues the law guarantees, such as gratuity or provident fund; this records what was paid and does not replace those rights."),
  roles: [forEmployer, theEmployee],
  questions: [
    date("settlement_date", "Date of the settlement", { default: "today" }),
    ...employer,
    text("employee_name", "Employee: full name"),
    text("employee_code", "Employee code"),
    date("last_day", "Last working day"),
    money("salary_due", "Salary up to the last working day, in rupees", { min: 0 }),
    money("leave_encashment", "Leave encashment, in rupees", { min: 0 }),
    money("other_earnings", "Other amounts payable, in rupees", { min: 0 }),
    money("deductions", "Deductions and recoveries, in rupees", { min: 0 }),
    money("net_payable", "Net amount paid, in rupees", { min: 0 }),
    choice("payment_mode", "Paid by", [["bank transfer", "bank transfer"], ["cheque", "cheque"]]),
    optional(text("assets_returned", "Company property returned, for example laptop and ID card")),
    ...signatory,
  ],
  body: [
    title("Full and Final Settlement"),
    p("Employee: **{{employee_name}}** (employee code {{employee_code}}). Employer: **{{company_name}}**, {{company_address}}. Last working day: {{last_day|date}}."),
    table([["Salary up to the last working day", "{{salary_due|money}}"], ["Leave encashment", "{{leave_encashment|money}}"], ["Other amounts", "{{other_earnings|money}}"], ["Less deductions and recoveries", "{{deductions|money}}"], ["Net amount paid", "{{net_payable|money}}"]]),
    p("The net amount of {{net_payable|money}} ({{net_payable|words}}) has been paid by {{payment_mode}} on {{settlement_date|date}}."),
    p("Company property returned: {{assets_returned}}.", { question: "assets_returned", answered: true }),
    p("The Employee confirms receiving this amount in settlement of salary and the other items listed above. Gratuity, provident fund and any other benefit the law provides are dealt with separately as the law requires and are not given up by this document."),
    signedFor,
    sign(),
  ],
};

export default [appointment, employmentAgreement, employeeNda, internship, confirmation, salaryRevision, warning, relieving, experience, fullAndFinal];
