// The Real estate sales pack: five papers around the sale of a property (plan task P6-07).
//
// Starting drafts written by the development team. None has been reviewed by a lawyer; each
// carries `reviewer: null` and stays out of the catalogue in production until one has.
//
// What is deliberately not here: an agreement for sale and a sale deed. Contracts for the sale
// or conveyance of immovable property are among the documents the Information Technology Act
// keeps outside electronic signing, and they must be stamped and registered. This pack covers
// only the papers around a sale, and each says plainly that it is not the sale itself.

import { text, longtext, money, date, number, choice, optional, BLUE, GREEN, pack, role, hint, title, p, c, note, table, list, sign, when, cityQuestion, law } from "./_helpers.js";

const common = { ...pack("realestate"), industry: "Real estate sales" };

const NOT_A_SALE = "This document is not an agreement for sale and does not transfer any interest in the property. A sale of property needs a stamped and registered document signed on paper.";
const NOT_A_SALE_HINT = hint.check(
  "An ordinary electronic signature is commonly used for this paper, which is not itself a sale. An agreement for sale or a sale deed cannot be signed here: the law keeps contracts for the sale of immovable property outside electronic signing, and they must be stamped and registered."
);

const brokerage = {
  ...common,
  key: "property-brokerage-agreement",
  title: "Property Brokerage Agreement",
  summary: "An owner or buyer appoints a broker to find a buyer, seller or tenant, and agrees the commission.",
  signatureHint: hint.esign("a brokerage agreement"),
  stateNotes: [{ state: "MH", name: "Maharashtra", note: "Agents dealing in projects registered with the state's real estate authority are reported to need registration with it themselves. Confirm locally." }],
  roles: [role("client", "Client", "client_name", BLUE, 1), role("broker", "Broker", "broker_name", GREEN, 2)],
  questions: [
    date("agreement_date", "Date of the agreement", { default: "today" }),
    text("client_name", "Client: full name"),
    text("client_address", "Client: address"),
    text("broker_name", "Broker: name of the person or firm"),
    text("broker_address", "Broker: address"),
    optional(text("broker_registration", "Broker's registration number with the real estate authority")),
    choice("mandate", "The broker is to find", [["a buyer for", "a buyer for the client's property"], ["a tenant for", "a tenant for the client's property"], ["a property for the client to buy, similar to", "a property for the client to buy"]]),
    longtext("property", "The property, or the kind of property wanted", { maxLength: 500 }),
    choice("exclusive", "The appointment is", [["exclusive", "exclusive: no other broker is appointed"], ["non-exclusive", "non-exclusive"]]),
    number("commission_percent", "Commission, per cent of the price or of one year's rent", { default: 2, min: 0, max: 10 }),
    number("term_days", "Appointment lasts, in days", { default: 90, min: 7, max: 365 }),
    cityQuestion,
  ],
  body: [
    title("Property Brokerage Agreement"),
    p('This agreement is made on {{agreement_date|date}} between **{{client_name}}**, of {{client_address}} (the "Client"), and **{{broker_name}}**, of {{broker_address}} (the "Broker"). Broker\'s registration: {{broker_registration}}.'),
    c("Appointment", "The Client appoints the Broker, on a {{exclusive}} basis, to find {{mandate}}: {{property}}"),
    c("Period", "The appointment lasts {{term_days}} days from the date of this agreement."),
    c("Commission", "If a transaction is completed with a person the Broker introduced during that period, or within 90 days after it, the Client shall pay the Broker {{commission_percent}} per cent of the price, or of one year's rent in the case of a letting, plus tax. Nothing is payable if no transaction is completed."),
    c("Broker's duties", "The Broker shall act honestly and in the Client's interest, pass on every offer, disclose any interest of its own in a transaction, and hold no money for the Client except as the Client instructs in writing."),
    c("Limits", "The Broker has no authority to sign any document or accept any money on the Client's behalf."),
    law,
    sign(),
  ],
};

const booking = {
  ...common,
  key: "property-booking-form",
  title: "Property Booking Form (Expression of Interest)",
  summary: "A buyer records their interest in a unit and the booking amount paid, before any agreement for sale.",
  signatureHint: NOT_A_SALE_HINT,
  roles: [role("applicant", "Applicant", "applicant_name", BLUE, 1), role("seller", "For the Seller", "seller_signatory", GREEN, 2)],
  questions: [
    date("form_date", "Date", { default: "today" }),
    text("seller_name", "Seller or developer: name"),
    text("seller_signatory", "Signing for the seller: name"),
    text("project", "Project or building"),
    optional(text("rera_number", "Project's registration number with the real estate authority")),
    text("applicant_name", "Applicant: full name"),
    text("applicant_address", "Applicant: address"),
    text("unit", "Unit, for example Flat 702, Tower B"),
    text("area", "Carpet area, for example 742 sq ft"),
    money("price", "Agreed price, in rupees"),
    money("booking_amount", "Booking amount paid, in rupees"),
    number("agreement_days", "Days within which the agreement for sale is to be signed", { default: 30, min: 1, max: 180 }),
    choice("refund", "If the applicant withdraws before that, the booking amount is", [["refunded in full", "refunded in full"], ["refunded after the deduction stated in the project's terms", "refunded after a stated deduction"]]),
  ],
  body: [
    title("Booking Form"),
    p("Date: {{form_date|date}}. Project: **{{project}}**, by {{seller_name}}. Registration number: {{rera_number}}."),
    table([["Applicant", "{{applicant_name}}, {{applicant_address}}"], ["Unit", "{{unit}}"], ["Carpet area", "{{area}}"], ["Price", "{{price|money}}"], ["Booking amount paid", "{{booking_amount|money}}"]]),
    list(["The applicant has paid the booking amount to reserve the unit.", "The parties intend to sign and register an agreement for sale within {{agreement_days}} days. The unit is reserved for the applicant until then.", "If the applicant withdraws before that, the booking amount is {{refund}}.", "If the seller cannot offer the unit, the booking amount is refunded in full."]),
    note(NOT_A_SALE),
    sign(),
  ],
};

const tokenReceipt = {
  ...common,
  key: "token-money-receipt",
  title: "Token Money Receipt",
  summary: "A seller acknowledges receiving token money from a buyer towards an intended purchase.",
  signatureHint: NOT_A_SALE_HINT,
  roles: [role("seller", "Seller", "seller_name", BLUE, 1), role("buyer", "Buyer", "buyer_name", GREEN, 2)],
  questions: [
    date("receipt_date", "Date of the receipt", { default: "today" }),
    text("seller_name", "Seller: full name"),
    text("buyer_name", "Buyer: full name"),
    longtext("property", "The property", { maxLength: 400 }),
    money("price", "Agreed price, in rupees"),
    money("token", "Token money received, in rupees"),
    choice("payment_mode", "Paid by", [["bank transfer", "bank transfer"], ["UPI", "UPI"], ["cheque", "cheque"]]),
    optional(text("reference", "Transaction or cheque number")),
    date("agreement_by", "The agreement for sale is to be signed by"),
  ],
  body: [
    title("Token Money Receipt"),
    p("I, **{{seller_name}}**, have received {{token|money}} ({{token|words}}) from **{{buyer_name}}** on {{receipt_date|date}} by {{payment_mode}} (reference: {{reference}}) as token money towards the intended purchase of: {{property}}"),
    list(["The price discussed is {{price|money}}. The token money will be counted towards it.", "The parties intend to sign and register an agreement for sale by {{agreement_by|date}}.", "If the seller decides not to sell, the token money will be returned in full.", "What happens to the token money if the buyer decides not to buy is as the parties have agreed between them in writing; if they have agreed nothing, it is returned."]),
    note(NOT_A_SALE),
    sign(),
  ],
};

const siteVisit = {
  ...common,
  key: "site-visit-acknowledgement",
  title: "Site Visit Acknowledgement",
  summary: "A prospective buyer confirms visiting a property with a named broker, so the introduction is on record.",
  signatureHint: hint.esign("a site visit record"),
  roles: [role("visitor", "Visitor", "visitor_name")],
  questions: [
    date("visit_date", "Date of the visit", { default: "today" }),
    text("visitor_name", "Visitor: full name"),
    text("visitor_phone", "Visitor: mobile number"),
    text("broker_name", "Broker who arranged the visit"),
    longtext("properties", "Properties shown, one per line", { maxLength: 800 }),
  ],
  body: [
    title("Site Visit Acknowledgement"),
    p("I, **{{visitor_name}}** ({{visitor_phone}}), confirm that on {{visit_date|date}} I visited the properties below, which were shown to me by {{broker_name}}."),
    c("Properties shown", "{{properties}}"),
    p("I understand that this records the visit only. It does not oblige me to buy or rent anything, and it is not an offer."),
    sign(),
  ],
};

const possession = {
  ...common,
  key: "possession-handover-letter",
  title: "Possession Handover Letter",
  summary: "Seller and buyer record that the keys and physical possession of a property were handed over on a given day.",
  signatureHint: hint.check("Signed by both sides to record the handover. Ownership passes by the registered sale deed, not by this letter."),
  roles: [role("seller", "Handing over", "seller_name", BLUE, 1), role("buyer", "Taking over", "buyer_name", GREEN, 2)],
  questions: [
    date("handover_date", "Date of handing over", { default: "today" }),
    text("seller_name", "Handing over: full name"),
    text("buyer_name", "Taking over: full name"),
    longtext("property", "The property", { maxLength: 400 }),
    date("deed_date", "Date of the registered sale deed"),
    optional(text("deed_number", "Registration number of the sale deed")),
    number("keys", "Number of keys handed over", { default: 2, min: 0, max: 30 }),
    text("meter_electricity", "Electricity meter reading"),
    optional(longtext("fixtures", "Fixtures and fittings left in the property", { maxLength: 600 })),
    optional(longtext("pending", "Anything still to be done by either side", { maxLength: 600 })),
  ],
  body: [
    title("Possession Handover Letter"),
    p("On {{handover_date|date}}, **{{seller_name}}** handed over vacant physical possession of the property below to **{{buyer_name}}**, following the sale deed dated {{deed_date|date}} (registration number {{deed_number}})."),
    c("Property", "{{property}}"),
    table([["Keys handed over", "{{keys}}"], ["Electricity meter reading", "{{meter_electricity}}"]]),
    c("Fixtures and fittings", "{{fixtures}}", { showIf: { question: "fixtures", answered: true } }),
    c("Still to be done", "{{pending}}", { showIf: { question: "pending", answered: true } }),
    p("Charges for electricity, water, maintenance and property tax up to this date are for the person handing over, and after it for the person taking over."),
    sign(),
  ],
};

export default [brokerage, booking, tokenReceipt, siteVisit, possession];
