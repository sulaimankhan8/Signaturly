import { describe, it, expect } from "vitest";
import { inr, paise, day, dateTime, shortDay, plural, words, toneOf, labelOf, planPrice, allowance } from "./format.js";
import { jsonProblem, formatJson, fieldOfProblem, toForm } from "./templates.js";
import { scaleTop } from "../components/ui/BarChart.jsx";

// Plan task AD-17: one way of writing money, dates and statuses.
describe("money", () => {
  it("is written in rupees, grouped the Indian way", () => {
    expect(inr(299)).toBe("₹299");
    expect(inr(125000)).toBe("₹1,25,000");
    expect(inr(0)).toBe("₹0");
    expect(inr(99.5)).toBe("₹99.50");
    expect(paise(20000)).toBe("₹200.00");
  });
});

describe("dates", () => {
  it("are written as India writes them, in India's time", () => {
    // 20:00 UTC on the 11th is 01:30 on the 12th in India
    expect(day("2026-10-11T20:00:00Z")).toBe("12 Oct 2026");
    expect(dateTime("2026-10-11T20:00:00Z")).toMatch(/^12 Oct 2026, 01:30$/);
    expect(day("2026-10-01")).toBe("01 Oct 2026");
  });

  it("show a calendar day from the server as it is", () => {
    expect(shortDay("2026-10-11")).toBe("11 Oct");
  });

  it("are empty for nothing, never 'Invalid Date'", () => {
    expect(day(null)).toBe("");
    expect(dateTime("not a date")).toBe("");
  });
});

describe("words for the server's values", () => {
  it("turns a status into plain words and a tone", () => {
    expect(words("partially_signed")).toBe("Partially signed");
    expect(labelOf("document", "pending")).toBe("Out for signature");
    expect(labelOf("document", "voided")).toBe("Voided");
    expect(labelOf("subscription", "past_due")).toBe("Payment overdue");
    // Every outcome has its own tone: a failure never looks like work under way
    expect([toneOf("document", "signed"), toneOf("document", "pending"), toneOf("document", "declined"), toneOf("document", "failed"), toneOf("document", "voided")]).toEqual(["green", "blue", "amber", "red", "neutral"]);
    expect(toneOf("document", "something new")).toBe("neutral");
  });

  it("counts things", () => {
    expect(plural(1, "document")).toBe("1 document");
    expect(plural(0, "document")).toBe("0 documents");
    expect(plural(2, "entry", "entries")).toBe("2 entries");
  });

  it("describes a plan from what the server says, with no prices of its own", () => {
    expect(planPrice({ priceInr: 299, interval: "month" })).toBe("₹299 a month");
    expect(planPrice({ priceInr: 499, interval: "month", perSeat: true })).toBe("₹499 a seat a month");
    expect(planPrice({ priceInr: 2499, interval: "month", priceIsFrom: true })).toBe("from ₹2,499 a month");
    expect(planPrice({ priceInr: 0, interval: null })).toBe("Free");
    expect(planPrice({ priceInr: null, interval: null })).toBe("Not sold");
    expect(allowance(50)).toBe("50 documents a month");
    expect(allowance(null)).toBe("No monthly limit");
  });
});

// Plan task AD-35: a mistake in a template's JSON is shown where it is.
describe("template JSON", () => {
  it("says which line a mistake is on", () => {
    expect(jsonProblem('[\n  { "type": "title" }\n]')).toBe("");
    expect(jsonProblem('[\n  { "type": "title" },\n  { "type": }\n]')).toBe("Line 3, column 13: a value is expected here");
    expect(jsonProblem('[\n  { "type": "title" }\n  { "type": "paragraph" }\n]')).toBe("Line 3, column 3: a comma or ] is expected here");
    expect(jsonProblem('[\n  { type: "title" }\n]')).toBe('Line 2, column 5: a name in "double quotes" is expected here');
    expect(jsonProblem('[{ "text": "a \\"quoted\\" word" },')).toBe("Line 1, column 34: the text ends too soon");
    expect(jsonProblem("[1, 2,]")).toBe("Line 1, column 7: a value is expected here");
  });

  it("tidies sound JSON and leaves unsound JSON alone", () => {
    expect(formatJson('[{"a":1}]')).toBe('[\n  {\n    "a": 1\n  }\n]');
    expect(formatJson("[{")).toBe("[{");
  });

  it("puts a problem from the server under the field it is about", () => {
    expect(fieldOfProblem("block 2 (paragraph) uses {{visitor}}, which is not a question")).toBe("body");
    expect(fieldOfProblem('question "name" appears twice')).toBe("questions");
    expect(fieldOfProblem('signer "tenant" has nowhere to sign')).toBe("roles");
    expect(fieldOfProblem("there are no signers")).toBe("roles");
    expect(fieldOfProblem("title is missing")).toBe("title");
    expect(fieldOfProblem("version must be a whole number from 1")).toBe(null);
  });

  it("turns a saved version into the form's fields", () => {
    const form = toForm({ title: "NDA", pack: "starter", signatureHint: { level: "esign_ok", text: "Fine" }, roles: [{ id: "a" }], body: [] });
    expect(form).toMatchObject({ title: "NDA", pack: "starter", hintLevel: "esign_ok", hintText: "Fine", body: "[]", questions: "[]" });
    expect(JSON.parse(form.roles)).toEqual([{ id: "a" }]);
  });
});

describe("the chart's scale", () => {
  it("ends on a round number that holds the data, in four equal steps", () => {
    expect(scaleTop(0)).toBe(4);
    expect(scaleTop(3)).toBe(4);
    expect(scaleTop(7)).toBe(8);
    expect(scaleTop(37)).toBe(40);
    expect(scaleTop(378)).toBe(400);
    expect(scaleTop(2990)).toBe(4000);
  });
});
