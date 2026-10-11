// The Housing society pack: twelve forms, notices and letters (plan task P4-11).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
// Societies are run under state co-operative law and their own bye-laws, which decide what a
// notice must say and how long before a meeting it must go out. These drafts do not know them.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, PURPLE, pack, role, hint, title, p, c, note, table, list, sign, when } from "./_helpers.js";

const common = { ...pack("society"), industry: "Housing society" };

const BYE_LAWS = "Check the society's bye-laws and the state's co-operative rules for what this must contain and who must sign it.";
const society = [text("society_name", "Name of the society"), longtext("society_address", "Address of the society", { maxLength: 300 })];
const officer = [text("officer_name", "Signing for the society: name"), choice("officer_post", "Their post", [["Secretary", "Secretary"], ["Chairman", "Chairman"], ["Treasurer", "Treasurer"], ["Manager", "Manager"]])];
const forSociety = role("society", "For the Society", "officer_name", BLUE, 1);
const header = p("**{{society_name}}**, {{society_address}}");
const closing = p("For {{society_name}}: {{officer_name}}, {{officer_post}}");

const nocSale = {
  ...common,
  key: "society-noc-sale",
  title: "Society NOC for Sale or Transfer of a Flat",
  summary: "The society confirms it has no objection to a member selling or transferring their flat, and that dues are paid.",
  signatureHint: hint.check(`Signed for the society. ${BYE_LAWS}`),
  roles: [forSociety],
  questions: [
    date("letter_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member selling or transferring: full name"),
    text("flat", "Flat number and wing"),
    text("buyer_name", "Buyer or transferee: full name"),
    date("dues_paid_until", "Society dues are paid up to"),
    optional(text("share_certificate", "Share certificate number")),
    ...officer,
  ],
  body: [
    title("No Objection Certificate"),
    header,
    p("Date: {{letter_date|date}}"),
    p("This is to certify that **{{member_name}}** is a member of this society and holds flat {{flat}}. Share certificate number: {{share_certificate}}."),
    p("The society has no objection to the member selling or transferring the flat and the shares that go with it to **{{buyer_name}}**, subject to the bye-laws of the society and to the transferee applying for membership in the usual way."),
    p("All maintenance charges and other dues for the flat are paid up to {{dues_paid_until|date}}."),
    note("This certificate says only that the society does not object. It is not a transfer of the flat."),
    closing,
    sign(),
  ],
};

const nocRental = {
  ...common,
  key: "society-noc-rental",
  title: "Society NOC for Letting a Flat",
  summary: "The society confirms it has no objection to a member letting their flat to a named occupant.",
  signatureHint: hint.check(`Signed for the society. ${BYE_LAWS}`),
  roles: [forSociety],
  questions: [
    date("letter_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    text("occupant_name", "Tenant or licensee: full name"),
    date("from_date", "Letting starts on"),
    date("to_date", "Letting ends on"),
    ...officer,
  ],
  body: [
    title("No Objection Certificate for Letting"),
    header,
    p("Date: {{letter_date|date}}"),
    p("The society has no objection to its member **{{member_name}}** letting flat {{flat}} to **{{occupant_name}}** from {{from_date|date}} to {{to_date|date}}."),
    list(["The member remains responsible for all society dues and for the conduct of the occupant.", "The occupant shall follow the bye-laws and rules of the society.", "The member shall give the society a copy of the agreement and of the police intimation where one is required.", "This certificate ends with the period above and must be applied for again on renewal."]),
    closing,
    sign(),
  ],
};

const tenantIntimation = {
  ...common,
  key: "society-tenant-intimation",
  title: "Intimation of Tenant to the Society",
  summary: "A member tells the society who will occupy their flat, with the occupant's details and their own undertaking.",
  signatureHint: hint.esign("a member's intimation to the society"),
  roles: [role("member", "Member", "member_name")],
  questions: [
    date("form_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    text("occupant_name", "Occupant: full name"),
    text("occupant_phone", "Occupant: mobile number"),
    text("occupant_address", "Occupant: permanent address"),
    number("occupants", "Number of people who will live there", { default: 2, min: 1, max: 20 }),
    text("occupation", "Occupant's work or business"),
    date("from_date", "Occupation starts on"),
    date("to_date", "Occupation ends on"),
    optional(text("vehicles", "Vehicle numbers, if any")),
  ],
  body: [
    title("Intimation of Tenant"),
    p("To the Secretary, **{{society_name}}**, {{society_address}}"),
    p("Date: {{form_date|date}}"),
    p("I, **{{member_name}}**, member holding flat {{flat}}, inform the society that the flat will be occupied as follows:"),
    table([["Occupant", "{{occupant_name}}"], ["Mobile", "{{occupant_phone}}"], ["Permanent address", "{{occupant_address}}"], ["People living there", "{{occupants}}"], ["Work or business", "{{occupation}}"], ["Period", "{{from_date|date}} to {{to_date|date}}"], ["Vehicles", "{{vehicles}}"]]),
    list(["I remain responsible for all dues of the flat.", "I have told the occupant about the society's rules and am answerable for their conduct.", "I will give the society copies of the agreement and of the police intimation where one is required."]),
    sign(),
  ],
};

const duesNotice = {
  ...common,
  key: "society-dues-notice",
  title: "Notice of Outstanding Maintenance Dues",
  summary: "The society reminds a member of unpaid maintenance charges and asks for payment by a date.",
  signatureHint: hint.check(`Signed for the society. Interest and any further step must follow the bye-laws. ${BYE_LAWS}`),
  roles: [forSociety],
  questions: [
    date("notice_date", "Date of the notice", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    money("amount", "Amount outstanding, in rupees"),
    text("period", "Period it covers, for example April to September 2026"),
    optional(money("interest", "Interest included in that amount, in rupees", { min: 0 })),
    date("pay_by", "Pay by"),
    text("payment_details", "How to pay, for example the society's bank account or UPI id"),
    ...officer,
  ],
  body: [
    title("Notice of Outstanding Dues"),
    header,
    p("Date: {{notice_date|date}}"),
    p("To: **{{member_name}}**, flat {{flat}}"),
    p("The society's records show that **{{amount|money}}** ({{amount|words}}) is outstanding for the flat for {{period}}."),
    p("This includes interest of {{interest|money}} charged as the bye-laws provide.", { question: "interest", answered: true }),
    p("Please pay the amount on or before {{pay_by|date}} to: {{payment_details}}. If you have already paid, send the details to the society office so the records can be corrected."),
    p("If the amount stays unpaid after that date, the managing committee will consider the steps open to it under the bye-laws."),
    closing,
    sign(),
  ],
};

const agmNotice = {
  ...common,
  key: "society-agm-notice",
  title: "Notice of General Body Meeting",
  summary: "The society calls its members to an annual or special general body meeting, with the agenda.",
  signatureHint: hint.check(`Signed for the society. The length of notice, the quorum and how notice must be given are fixed by the bye-laws. ${BYE_LAWS}`),
  roles: [forSociety],
  questions: [
    date("notice_date", "Date of the notice", { default: "today" }),
    ...society,
    choice("meeting_type", "Kind of meeting", [["Annual General Body Meeting", "Annual General Body Meeting"], ["Special General Body Meeting", "Special General Body Meeting"]]),
    date("meeting_date", "Date of the meeting"),
    text("meeting_time", "Time, for example 10:30 am"),
    text("venue", "Venue"),
    longtext("agenda", "Agenda, one item per line", { maxLength: 1500 }),
    ...officer,
  ],
  body: [
    title("Notice of {{meeting_type}}"),
    header,
    p("Date: {{notice_date|date}}"),
    p("Notice is given to all members that the {{meeting_type}} of the society will be held on **{{meeting_date|date}}** at **{{meeting_time}}** at {{venue}}, to take up the following business:"),
    c("Agenda", "{{agenda}}"),
    list(["If there is no quorum at the time fixed, the meeting will be adjourned and held as the bye-laws provide.", "A member who wishes to raise any other matter should give it in writing to the society office before the meeting.", "Members are asked to attend in person."]),
    closing,
    sign(),
  ],
};

const resolution = {
  ...common,
  key: "society-committee-resolution",
  title: "Managing Committee Resolution",
  summary: "A record of a resolution passed at a managing committee meeting, signed by the chairman and the secretary.",
  signatureHint: hint.esign("a record of a committee resolution"),
  roles: [role("chairman", "Chairman", "chairman_name", BLUE, 1), role("secretary", "Secretary", "secretary_name", GREEN, 2)],
  questions: [
    ...society,
    date("meeting_date", "Date of the meeting"),
    text("venue", "Where it was held"),
    number("present", "Committee members present", { min: 1, max: 50 }),
    text("resolution_number", "Resolution number"),
    text("subject", "Subject of the resolution"),
    longtext("resolution_text", "The resolution, in full", { maxLength: 2000 }),
    text("proposed_by", "Proposed by"),
    text("seconded_by", "Seconded by"),
    choice("outcome", "Passed", [["unanimously", "unanimously"], ["by majority", "by majority"]]),
    text("chairman_name", "Chairman: name"),
    text("secretary_name", "Secretary: name"),
  ],
  body: [
    title("Resolution of the Managing Committee"),
    header,
    p("Extract from the minutes of the managing committee meeting held on {{meeting_date|date}} at {{venue}}, with {{present}} members present."),
    table([["Resolution number", "{{resolution_number}}"], ["Subject", "{{subject}}"], ["Proposed by", "{{proposed_by}}"], ["Seconded by", "{{seconded_by}}"], ["Passed", "{{outcome}}"]]),
    c("Resolved", "{{resolution_text}}"),
    p("Certified to be a true extract."),
    sign(),
  ],
};

const parking = {
  ...common,
  key: "society-parking-allotment",
  title: "Parking Allotment Letter",
  summary: "The society allots a parking space to a member, with the charge and the conditions of use.",
  signatureHint: hint.esign("a parking allotment accepted by the member"),
  roles: [forSociety, role("member", "Member", "member_name", GREEN, 2)],
  questions: [
    date("letter_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    text("slot", "Parking space number"),
    choice("vehicle_type", "For a", [["car", "car"], ["two-wheeler", "two-wheeler"]]),
    text("vehicle_number", "Vehicle registration number"),
    money("charge", "Monthly parking charge, in rupees", { min: 0 }),
    date("from_date", "Allotted from"),
    ...officer,
  ],
  body: [
    title("Parking Allotment"),
    header,
    p("Date: {{letter_date|date}}"),
    p("Parking space **{{slot}}** is allotted to **{{member_name}}**, flat {{flat}}, for the {{vehicle_type}} numbered {{vehicle_number}}, from {{from_date|date}}, at a charge of {{charge|money}} a month."),
    list(["The space is for the vehicle named above only and may not be let or handed to anyone else.", "The allotment gives a right to park. It does not give ownership of the space.", "The society may change or withdraw the allotment as its bye-laws and parking rules provide.", "The society is not responsible for loss of or damage to the vehicle.", "The allotment ends when the member ceases to occupy the flat."]),
    closing,
    sign(),
  ],
};

const renovation = {
  ...common,
  key: "society-renovation-undertaking",
  title: "Renovation Permission and Undertaking",
  summary: "A member asks to carry out interior work in their flat and undertakes to follow the society's conditions.",
  signatureHint: hint.esign("a renovation undertaking"),
  roles: [role("member", "Member", "member_name", BLUE, 1), { ...forSociety, color: GREEN, signingOrder: 2 }],
  questions: [
    date("form_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    longtext("work", "Work to be carried out", { maxLength: 800 }),
    text("contractor", "Contractor: name and phone"),
    date("work_from", "Work starts on"),
    date("work_to", "Work ends on"),
    text("hours", "Working hours allowed, for example 10 am to 6 pm, not on Sundays"),
    optional(money("deposit", "Refundable deposit paid to the society, in rupees", { min: 0 })),
    ...officer,
  ],
  body: [
    title("Renovation Permission and Undertaking"),
    p("To the Secretary, **{{society_name}}**, {{society_address}}. Date: {{form_date|date}}"),
    p("I, **{{member_name}}**, of flat {{flat}}, ask for permission to carry out this work between {{work_from|date}} and {{work_to|date}}: {{work}}"),
    table([["Contractor", "{{contractor}}"], ["Working hours", "{{hours}}"], ["Deposit", "{{deposit|money}}"]]),
    c("Undertaking", "I undertake that:", {
      items: ["no beam, column, load-bearing wall or outer wall will be altered or damaged;", "no change will be made to the outside of the building or to common plumbing or wiring without written permission;", "work will be done only in the hours above;", "debris will be removed daily and common areas kept clean;", "workers will carry identification and follow the society's security rules; and", "I will pay for any damage the work causes to common property or to another flat."],
    }),
    p("Permission is given for the society on the conditions above: {{officer_name}}, {{officer_post}}."),
    sign(),
  ],
};

const nomination = {
  ...common,
  key: "society-nomination-form",
  title: "Nomination Form",
  summary: "A member names the person to whom their shares and interest in the society should pass on their death.",
  signatureHint: hint.check(`Nomination forms usually follow a format fixed by the bye-laws and may need witnesses. ${BYE_LAWS}`),
  roles: [role("member", "Member", "member_name", BLUE, 1), role("witness", "Witness", "witness_name", PURPLE, 2)],
  questions: [
    date("form_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    optional(text("share_certificate", "Share certificate number")),
    text("nominee_name", "Nominee: full name"),
    text("nominee_relation", "Nominee's relationship to the member"),
    text("nominee_address", "Nominee: address"),
    date("nominee_dob", "Nominee: date of birth"),
    number("share_percent", "Share nominated to this person, in per cent", { default: 100, min: 1, max: 100 }),
    text("witness_name", "Witness: full name"),
    text("witness_address", "Witness: address"),
  ],
  body: [
    title("Nomination Form"),
    p("To the Secretary, **{{society_name}}**, {{society_address}}. Date: {{form_date|date}}"),
    p("I, **{{member_name}}**, member holding flat {{flat}} (share certificate number {{share_certificate}}), nominate the person below to receive my shares and interest in the society on my death. This replaces any nomination I made before."),
    table([["Nominee", "{{nominee_name}}"], ["Relationship", "{{nominee_relation}}"], ["Address", "{{nominee_address}}"], ["Date of birth", "{{nominee_dob|date}}"], ["Share", "{{share_percent}} per cent"]]),
    p("Witness: {{witness_name}}, {{witness_address}}"),
    note("A nomination tells the society whom to deal with. Who finally owns the flat is decided by the law of succession or by a will."),
    sign(),
  ],
};

const membership = {
  ...common,
  key: "society-membership-application",
  title: "Application for Membership",
  summary: "Someone who has bought or received a flat applies to become a member of the society.",
  signatureHint: hint.check(`Membership applications usually follow a format fixed by the bye-laws. ${BYE_LAWS}`),
  roles: [role("applicant", "Applicant", "applicant_name")],
  questions: [
    date("form_date", "Date", { default: "today" }),
    ...society,
    text("applicant_name", "Applicant: full name"),
    number("applicant_age", "Applicant: age", { min: 18, max: 120 }),
    text("applicant_occupation", "Applicant: occupation"),
    text("applicant_address", "Applicant: present address"),
    text("flat", "Flat number and wing"),
    choice("acquired_by", "The flat was acquired by", [["purchase", "purchase"], ["gift", "gift"], ["inheritance", "inheritance"]]),
    text("previous_member", "Previous member: full name"),
    date("document_date", "Date of the sale deed or other document"),
  ],
  body: [
    title("Application for Membership"),
    p("To the Secretary, **{{society_name}}**, {{society_address}}. Date: {{form_date|date}}"),
    p("I, **{{applicant_name}}**, aged {{applicant_age}}, {{applicant_occupation}}, of {{applicant_address}}, apply to be admitted as a member of the society for flat {{flat}}."),
    p("I acquired the flat by {{acquired_by}} from {{previous_member}} under a document dated {{document_date|date}}, a copy of which is attached."),
    list(["I will pay the entrance fee, share money and transfer charges the bye-laws require.", "I will follow the bye-laws and rules of the society.", "I will use the flat for the purpose for which it was built.", "What I have stated here is true."]),
    sign(),
  ],
};

const facilityBooking = {
  ...common,
  key: "society-facility-booking",
  title: "Clubhouse or Hall Booking Form",
  summary: "A member books the society's hall, clubhouse or other shared facility for an event and accepts the conditions.",
  signatureHint: hint.esign("a facility booking form"),
  roles: [role("member", "Member", "member_name")],
  questions: [
    date("form_date", "Date", { default: "today" }),
    ...society,
    text("member_name", "Member: full name"),
    text("flat", "Flat number and wing"),
    text("facility", "Facility booked, for example the community hall"),
    date("event_date", "Date of the event"),
    text("event_time", "From and to, for example 6 pm to 10 pm"),
    text("occasion", "Occasion"),
    number("guests", "Expected number of guests", { min: 1, max: 2000 }),
    money("charge", "Booking charge, in rupees", { min: 0 }),
    optional(money("deposit", "Refundable deposit, in rupees", { min: 0 })),
  ],
  body: [
    title("Facility Booking Form"),
    header,
    table([["Member", "{{member_name}}, flat {{flat}}"], ["Facility", "{{facility}}"], ["Date and time", "{{event_date|date}}, {{event_time}}"], ["Occasion", "{{occasion}}"], ["Guests", "{{guests}}"], ["Charge", "{{charge|money}}"], ["Deposit", "{{deposit|money}}"]]),
    c("Conditions", "I agree that:", {
      items: ["the facility will be used only for the occasion above and vacated on time;", "music will stop at the hour the society's rules and the law require;", "the place will be left clean, and I will pay for any damage;", "guests' vehicles will be parked only where the society allows; and", "the society may cancel the booking if these conditions are broken."],
    }),
    p("Date: {{form_date|date}}"),
    sign(),
  ],
};

const vendorAmc = {
  ...common,
  key: "society-maintenance-contract",
  title: "Annual Maintenance Contract with a Vendor",
  summary: "The society engages a vendor to maintain lifts, pumps, security systems or similar equipment for a year.",
  signatureHint: hint.esign("a maintenance contract"),
  roles: [forSociety, role("vendor", "Vendor", "vendor_name", GREEN, 2)],
  questions: [
    date("agreement_date", "Date of the contract", { default: "today" }),
    ...society,
    text("vendor_name", "Vendor: name of the business"),
    text("vendor_address", "Vendor: address"),
    longtext("equipment", "Equipment covered", { maxLength: 600 }),
    longtext("services", "What the vendor will do, and how often", { maxLength: 800 }),
    date("start_date", "Contract starts on"),
    date("end_date", "Contract ends on"),
    money("annual_fee", "Fee for the period, in rupees"),
    choice("payment_terms", "Paid", [["quarterly in advance", "quarterly in advance"], ["half-yearly in advance", "half-yearly in advance"], ["yearly in advance", "yearly in advance"], ["monthly in arrears", "monthly in arrears"]]),
    number("response_hours", "Hours within which a breakdown call must be attended", { default: 4, min: 1, max: 72 }),
    number("notice_days", "Days of notice to end the contract", { default: 30, min: 7, max: 180 }),
    text("city", "City whose courts will hear any dispute"),
    ...officer,
  ],
  body: [
    title("Annual Maintenance Contract"),
    p('This contract is made on {{agreement_date|date}} between **{{society_name}}**, {{society_address}} (the "Society"), acting through its {{officer_post}} {{officer_name}}, and **{{vendor_name}}**, of {{vendor_address}} (the "Vendor").'),
    c("Equipment", "{{equipment}}"),
    c("Services", "From {{start_date|date}} to {{end_date|date}} the Vendor shall: {{services}}"),
    c("Breakdowns", "The Vendor shall attend a breakdown call within {{response_hours}} hour(s) of being told of it and shall restore the equipment as quickly as is reasonably possible."),
    c("Fee", "The Society shall pay {{annual_fee|money}} ({{annual_fee|words}}) for the period, {{payment_terms}}, plus tax that applies. Spare parts not covered by this contract are charged only after the Society approves the cost in writing."),
    c("Vendor's responsibilities", "The Vendor shall use trained staff, follow safety rules, hold the licences and insurance the work requires, and is responsible for its own staff and for damage caused by their negligence."),
    c("Ending the contract", "Either side may end this contract with {{notice_days}} days of written notice. Fees paid in advance for the period after it ends shall be refunded."),
    c("Law and disputes", "This contract is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it."),
    sign(),
  ],
};

export default [nocSale, nocRental, tenantIntimation, duesNotice, agmNotice, resolution, parking, renovation, nomination, membership, facilityBooking, vendorAmc];
