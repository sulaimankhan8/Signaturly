// The Rentals pack: nine documents for letting homes, shops and rooms (plan task P4-10).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
// Rent law differs from state to state. The state notes are cautious summaries, not advice.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, pack, role, hint, title, p, c, note, table, list, sign, when, cityQuestion, law } from "./_helpers.js";

const common = { ...pack("rentals"), industry: "Rentals" };

const RENT_STAMP = hint.stamp(
  "Stamp duty applies to rent and licence agreements in every state, at a rate each state sets. Signing here does not pay it. Some states also require registration: see the note for your state."
);

const RENT_STATES = [
  { state: "MH", name: "Maharashtra", note: "Reported to require leave-and-licence agreements to be registered whatever their length. Confirm with the local registration office before relying on an unregistered agreement." },
  { state: "KA", name: "Karnataka", note: "Stamp duty applies. An agreement for less than twelve months is commonly left unregistered; confirm locally." },
  { state: "DL", name: "Delhi", note: "Stamp duty applies. An agreement for less than twelve months is commonly left unregistered; confirm locally." },
  { state: "TN", name: "Tamil Nadu", note: "Reported to require tenancy agreements to be in writing and registered with the rent authority. Confirm locally." },
];

const landlordTenant = [role("landlord", "Landlord", "landlord_name", BLUE, 1), role("tenant", "Tenant", "tenant_name", GREEN, 2)];
const parties = [text("landlord_name", "Landlord: full name"), text("landlord_address", "Landlord: address"), text("tenant_name", "Tenant: full name"), text("tenant_address", "Tenant: permanent address")];

const leaveAndLicence = {
  ...common,
  key: "leave-and-licence",
  title: "Leave and Licence Agreement (Home)",
  summary: "An owner lets someone live in a flat or house for a fixed period for a monthly fee, without creating a tenancy.",
  signatureHint: RENT_STAMP,
  stateNotes: RENT_STATES,
  roles: [role("licensor", "Licensor (Owner)", "landlord_name", BLUE, 1), role("licensee", "Licensee (Occupant)", "tenant_name", GREEN, 2)],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    ...parties,
    longtext("property_address", "Full address of the home being let", { maxLength: 400 }),
    date("start_date", "Licence starts on"),
    date("end_date", "Licence ends on"),
    money("fee", "Monthly licence fee, in rupees"),
    number("fee_day", "Day of the month the fee is due", { default: 5, min: 1, max: 28 }),
    money("deposit", "Refundable security deposit, in rupees"),
    number("notice_months", "Months of written notice either side must give to end it early", { default: 1, min: 1, max: 6 }),
    choice("bills", "Electricity and water bills are paid by", [["licensee", "the occupant"], ["licensor", "the owner"]]),
    cityQuestion,
  ],
  body: [
    title("Leave and Licence Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{landlord_name}}**, of {{landlord_address}} (the "Licensor"), and **{{tenant_name}}**, of {{tenant_address}} (the "Licensee").'),
    c("Premises", "The Licensor owns the home at {{property_address}} (the \"Premises\") and permits the Licensee to use it as a private residence only."),
    c("Period", "The licence runs from {{start_date|date}} to {{end_date|date}}. It ends on that date without notice unless both sides agree in writing to renew it."),
    c("Licence fee", "The Licensee shall pay {{fee|money}} ({{fee|words}}) each month, in advance, on or before day {{fee_day}} of the month."),
    c("Security deposit", "The Licensee has paid a deposit of {{deposit|money}} ({{deposit|words}}). It carries no interest. The Licensor shall return it when the Licensee hands back the Premises, less any unpaid fee, unpaid bills and the cost of repairing damage beyond ordinary wear."),
    c("Bills", "Electricity and water charges for the period are paid by the Licensee.", { showIf: when("bills", "licensee") }),
    c("Bills", "Electricity and water charges for the period are paid by the Licensor.", { showIf: when("bills", "licensor") }),
    c("Use of the Premises", "The Licensee shall:", {
      items: ["keep the Premises clean and in good condition;", "not sub-let them or let anyone else occupy them;", "not make structural changes;", "follow the rules of the building or society; and", "allow the Licensor to inspect them at a reasonable time after notice."],
    }),
    c("No tenancy", "This agreement gives permission to use the Premises and nothing more. It does not create a tenancy or any interest in the property."),
    c("Ending early", "Either side may end this agreement by giving {{notice_months}} month(s) of written notice. The Licensor may end it at once if the fee is unpaid for two months or the Licensee breaks a term and does not put it right within 15 days of being asked in writing."),
    law,
    sign(),
  ],
};

const shopRent = {
  ...common,
  key: "commercial-rent-agreement",
  title: "Shop or Office Rent Agreement",
  summary: "A landlord lets a shop, office or other commercial space to a business for a fixed period.",
  signatureHint: RENT_STAMP,
  stateNotes: RENT_STATES,
  roles: landlordTenant,
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    ...parties,
    longtext("property_address", "Full address of the shop or office", { maxLength: 400 }),
    text("business", "What business will be carried on there?"),
    date("start_date", "Tenancy starts on"),
    number("term_months", "Length of the tenancy, in months", { default: 11, min: 1, max: 120 }),
    money("rent", "Monthly rent, in rupees"),
    number("rent_day", "Day of the month rent is due", { default: 7, min: 1, max: 28 }),
    number("increase_percent", "Yearly rent increase, in per cent (0 for none)", { default: 5, min: 0, max: 25 }),
    money("deposit", "Refundable security deposit, in rupees"),
    number("lock_in_months", "Months during which neither side may end it (0 for none)", { default: 0, min: 0, max: 60 }),
    number("notice_months", "Months of written notice to end it after that", { default: 2, min: 1, max: 12 }),
    cityQuestion,
  ],
  body: [
    title("Commercial Rent Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{landlord_name}}**, of {{landlord_address}} (the "Landlord"), and **{{tenant_name}}**, of {{tenant_address}} (the "Tenant").'),
    c("Premises and use", "The Landlord lets the premises at {{property_address}} to the Tenant for carrying on this business and no other: {{business}}."),
    c("Period", "The tenancy is for {{term_months}} month(s) starting on {{start_date|date}}."),
    c("Rent", "The Tenant shall pay rent of {{rent|money}} ({{rent|words}}) a month, in advance, on or before day {{rent_day}} of each month, plus any tax that applies. The rent rises by {{increase_percent}} per cent at the end of each year of the tenancy."),
    c("Security deposit", "The Tenant has paid a deposit of {{deposit|money}} ({{deposit|words}}), without interest, returnable on handing back the premises less unpaid rent, unpaid charges and the cost of repairing damage beyond ordinary wear."),
    c("Charges and licences", "The Tenant pays for electricity, water and maintenance during the tenancy, and obtains and keeps every licence the business needs. Property tax is paid by the Landlord."),
    c("Tenant's duties", "The Tenant shall:", {
      items: ["keep the premises in good repair;", "not sub-let or part with possession;", "make no structural change without the Landlord's written consent;", "not store anything dangerous or unlawful; and", "hand the premises back in the condition received, ordinary wear excepted."],
    }),
    c("Ending the tenancy", "Neither side may end the tenancy during the first {{lock_in_months}} month(s). After that, either may end it with {{notice_months}} month(s) of written notice. The Landlord may end it at once if rent is unpaid for two months."),
    law,
    sign(),
  ],
};

const pgAgreement = {
  ...common,
  key: "pg-hostel-agreement",
  title: "Paying Guest or Hostel Agreement",
  summary: "The terms on which someone stays in a paying-guest home or hostel: charges, deposit and house rules.",
  signatureHint: hint.esign("a paying-guest agreement"),
  roles: [role("owner", "Owner or Manager", "owner_name", BLUE, 1), role("resident", "Resident", "resident_name", GREEN, 2)],
  questions: [
    date("agreement_date", "Date", { default: "today" }),
    text("owner_name", "Owner or manager: name"),
    text("pg_name", "Name of the PG or hostel"),
    longtext("pg_address", "Address of the PG or hostel", { maxLength: 300 }),
    text("resident_name", "Resident: full name"),
    text("resident_address", "Resident: permanent address"),
    text("emergency_contact", "Resident: emergency contact name and phone"),
    text("room", "Room and bed, for example Room 4, Bed B"),
    date("start_date", "Stay starts on"),
    money("charge", "Monthly charge, in rupees"),
    choice("food", "Meals are", [["included", "included in the charge"], ["not_included", "not included"]]),
    money("deposit", "Refundable deposit, in rupees"),
    number("notice_days", "Days of notice before leaving", { default: 30, min: 7, max: 90 }),
    optional(longtext("house_rules", "Any other house rules", { maxLength: 600 })),
  ],
  body: [
    title("Paying Guest Agreement"),
    p("This agreement is made on {{agreement_date|date}} between **{{owner_name}}**, for {{pg_name}} at {{pg_address}}, and **{{resident_name}}**, of {{resident_address}} (the \"Resident\")."),
    table([["Room", "{{room}}"], ["Stay starts", "{{start_date|date}}"], ["Monthly charge", "{{charge|money}}"], ["Deposit", "{{deposit|money}}"], ["Emergency contact", "{{emergency_contact}}"]]),
    c("Charges", "The Resident shall pay the monthly charge in advance by the 5th of each month. Meals are included in the charge.", { showIf: when("food", "included") }),
    c("Charges", "The Resident shall pay the monthly charge in advance by the 5th of each month. Meals are not included.", { showIf: when("food", "not_included") }),
    c("Deposit", "The deposit is returned within 15 days of the Resident leaving, less unpaid charges and the cost of anything damaged or missing."),
    c("House rules", "The Resident shall:", {
      items: ["keep the room and shared areas clean;", "not disturb other residents;", "not keep or use anything unlawful on the premises;", "have guests only as the house allows; and", "pay for damage they cause."],
    }),
    p("{{house_rules}}", { question: "house_rules", answered: true }),
    c("Leaving", "Either side may end the stay with {{notice_days}} days of notice. The owner may end it at once for non-payment or serious misconduct."),
    c("Nature of the stay", "The Resident is a paying guest. This agreement does not create a tenancy."),
    sign(),
  ],
};

const rentIncrease = {
  ...common,
  key: "rent-increase-notice",
  title: "Rent Increase Notice",
  summary: "A landlord tells a tenant in writing that the rent will rise from a given date.",
  signatureHint: hint.check("A notice signed by the landlord alone. Whether and how much rent can be raised depends on the agreement and on the rent law of the state."),
  roles: [role("landlord", "Landlord", "landlord_name")],
  questions: [
    date("notice_date", "Date of the notice", { default: "today" }),
    text("landlord_name", "Landlord: full name"),
    text("tenant_name", "Tenant: full name"),
    longtext("property_address", "Address of the rented property", { maxLength: 300 }),
    date("agreement_date", "Date of the rent agreement"),
    money("current_rent", "Current monthly rent, in rupees"),
    money("new_rent", "New monthly rent, in rupees"),
    date("effective_date", "New rent applies from"),
  ],
  body: [
    title("Notice of Rent Increase"),
    p("Date: {{notice_date|date}}"),
    p("To: **{{tenant_name}}**, {{property_address}}"),
    p("This is about the property above, which you occupy under the agreement dated {{agreement_date|date}}."),
    p("From {{effective_date|date}} the monthly rent will be **{{new_rent|money}}** ({{new_rent|words}}) in place of the present {{current_rent|money}}. Every other term of the agreement stays as it is."),
    p("Please pay the new rent from that date. If you have any question about this notice, write to me before then."),
    sign(),
  ],
};

const vacateByLandlord = {
  ...common,
  key: "notice-to-vacate-landlord",
  title: "Notice to Vacate (from the Landlord)",
  summary: "A landlord gives a tenant written notice to leave the property by a given date.",
  signatureHint: hint.check("A notice signed by the landlord alone. The notice period and the grounds on which a tenant can be asked to leave depend on the agreement and on state rent law; some notices must be sent in a particular way."),
  roles: [role("landlord", "Landlord", "landlord_name")],
  questions: [
    date("notice_date", "Date of the notice", { default: "today" }),
    text("landlord_name", "Landlord: full name"),
    text("tenant_name", "Tenant: full name"),
    longtext("property_address", "Address of the rented property", { maxLength: 300 }),
    date("agreement_date", "Date of the rent agreement"),
    choice("reason", "Reason", [["term_end", "the agreed period is ending"], ["own_use", "the landlord needs the property"], ["breach", "the tenant has broken the agreement"]]),
    optional(longtext("breach_details", "What was broken, if that is the reason", { maxLength: 400 })),
    date("vacate_by", "Date by which the tenant must leave"),
  ],
  body: [
    title("Notice to Vacate"),
    p("Date: {{notice_date|date}}"),
    p("To: **{{tenant_name}}**, {{property_address}}"),
    p("You occupy the property above under the agreement dated {{agreement_date|date}}. I give you notice to leave it and hand it back to me, with the keys, on or before **{{vacate_by|date}}**."),
    p("The agreed period of the agreement is coming to an end and it will not be renewed.", when("reason", "term_end")),
    p("I need the property for my own use.", when("reason", "own_use")),
    p("You have not kept to the agreement: {{breach_details}}", when("reason", "breach")),
    p("Please pay all rent and bills up to the day you leave. The security deposit will be settled as the agreement provides once the property has been inspected."),
    sign(),
  ],
};

const vacateByTenant = {
  ...common,
  key: "notice-to-vacate-tenant",
  title: "Notice of Leaving (from the Tenant)",
  summary: "A tenant tells the landlord in writing that they will leave on a given date and asks for the deposit back.",
  signatureHint: hint.esign("a tenant's notice of leaving"),
  roles: [role("tenant", "Tenant", "tenant_name")],
  questions: [
    date("notice_date", "Date of the notice", { default: "today" }),
    text("tenant_name", "Tenant: full name"),
    text("landlord_name", "Landlord: full name"),
    longtext("property_address", "Address of the rented property", { maxLength: 300 }),
    date("leaving_date", "Date of leaving"),
    money("deposit", "Security deposit paid, in rupees"),
    text("refund_details", "Where to return the deposit, for example a UPI id or account"),
    text("forwarding_address", "Address for letters after leaving"),
  ],
  body: [
    title("Notice of Leaving"),
    p("Date: {{notice_date|date}}"),
    p("To: **{{landlord_name}}**"),
    p("I am your tenant at {{property_address}}. I give notice that I will leave the property and return the keys on **{{leaving_date|date}}**."),
    p("Please arrange to inspect the property on or before that date. I ask that the security deposit of {{deposit|money}} be returned, less any amount properly due under our agreement, to: {{refund_details}}."),
    p("After I leave, letters can be sent to me at {{forwarding_address}}."),
    sign(),
  ],
};

const depositReceipt = {
  ...common,
  key: "security-deposit-receipt",
  title: "Security Deposit Receipt",
  summary: "A landlord confirms in writing that a security deposit has been received.",
  signatureHint: hint.check("A receipt signed by the landlord. A receipt for more than a small amount may need a revenue stamp; check what applies."),
  roles: [role("landlord", "Landlord", "landlord_name")],
  questions: [
    date("receipt_date", "Date of the receipt", { default: "today" }),
    text("landlord_name", "Landlord: full name"),
    text("tenant_name", "Tenant: full name"),
    longtext("property_address", "Address of the property", { maxLength: 300 }),
    money("amount", "Deposit received, in rupees"),
    choice("payment_mode", "Paid by", [["bank transfer", "bank transfer"], ["UPI", "UPI"], ["cheque", "cheque"], ["cash", "cash"]]),
    optional(text("reference", "Transaction or cheque number")),
  ],
  body: [
    title("Security Deposit Receipt"),
    table([["Date", "{{receipt_date|date}}"], ["Received from", "{{tenant_name}}"], ["Property", "{{property_address}}"], ["Amount", "{{amount|money}}"], ["Paid by", "{{payment_mode}}"], ["Reference", "{{reference}}"]]),
    p("I, **{{landlord_name}}**, have received {{amount|money}} ({{amount|words}}) from {{tenant_name}} as a refundable security deposit for the property above. It carries no interest and will be returned as the rent agreement provides."),
    sign(),
  ],
};

const inventory = {
  ...common,
  key: "move-in-inventory",
  title: "Move-in Inventory and Condition Record",
  summary: "Landlord and tenant record what is in the property and its condition on the day the tenant moves in.",
  signatureHint: hint.esign("an inventory signed by both sides"),
  roles: landlordTenant,
  questions: [
    date("record_date", "Date of moving in", { default: "today" }),
    text("landlord_name", "Landlord: full name"),
    text("tenant_name", "Tenant: full name"),
    longtext("property_address", "Address of the property", { maxLength: 300 }),
    longtext("furniture", "Furniture and fittings provided", { help: "For example: 2 beds, 1 wardrobe, 3 ceiling fans, 1 geyser", maxLength: 800 }),
    longtext("condition", "Condition of walls, floors, doors and windows", { maxLength: 600 }),
    optional(longtext("defects", "Existing damage or defects", { maxLength: 600 })),
    text("meter_electricity", "Electricity meter reading"),
    optional(text("meter_water", "Water meter reading")),
    number("keys", "Number of keys handed over", { default: 2, min: 0, max: 20 }),
  ],
  body: [
    title("Move-in Inventory and Condition Record"),
    p("Property: {{property_address}}. Recorded on {{record_date|date}} by **{{landlord_name}}** (Landlord) and **{{tenant_name}}** (Tenant)."),
    c("Furniture and fittings", "{{furniture}}"),
    c("Condition", "{{condition}}"),
    c("Existing damage", "{{defects}}", { showIf: { question: "defects", answered: true } }),
    table([["Electricity meter", "{{meter_electricity}}"], ["Water meter", "{{meter_water}}"], ["Keys handed over", "{{keys}}"]]),
    p("Both sides agree that this is a true record of the property on that day. It will be compared with the property's condition when the Tenant leaves."),
    sign(),
  ],
};

const renewal = {
  ...common,
  key: "tenancy-renewal",
  title: "Rent Agreement Renewal",
  summary: "Landlord and tenant extend an existing rent agreement for a further period, with any change in rent.",
  signatureHint: RENT_STAMP,
  stateNotes: RENT_STATES,
  roles: landlordTenant,
  questions: [
    date("renewal_date", "Date of this renewal", { default: "today" }),
    text("landlord_name", "Landlord: full name"),
    text("tenant_name", "Tenant: full name"),
    longtext("property_address", "Address of the property", { maxLength: 300 }),
    date("original_date", "Date of the original agreement"),
    date("new_start", "Renewed period starts on"),
    date("new_end", "Renewed period ends on"),
    money("new_rent", "Monthly rent for the renewed period, in rupees"),
    optional(longtext("other_changes", "Any other change agreed", { maxLength: 500 })),
  ],
  body: [
    title("Renewal of Rent Agreement"),
    p("This renewal is made on {{renewal_date|date}} between **{{landlord_name}}** (the \"Landlord\") and **{{tenant_name}}** (the \"Tenant\") for the property at {{property_address}}."),
    c("Renewal", "The agreement between the parties dated {{original_date|date}} is renewed for a further period from {{new_start|date}} to {{new_end|date}}."),
    c("Rent", "The monthly rent for the renewed period is {{new_rent|money}} ({{new_rent|words}})."),
    c("Other changes", "{{other_changes}}", { showIf: { question: "other_changes", answered: true } }),
    c("Everything else", "Every other term of the original agreement continues to apply, and the security deposit already paid continues to be held on the same terms."),
    sign(),
  ],
};

export default [leaveAndLicence, shopRent, pgAgreement, rentIncrease, vacateByLandlord, vacateByTenant, depositReceipt, inventory, renewal];
