import { describe, it, expect } from "vitest";
import {
  normalizeField,
  normalizeFieldList,
  missingRequired,
  problemWithValue,
  mergeSignerFields,
  fieldsForSigner,
} from "../../src/services/fieldRules.service.js";
import { matchFieldsToRecipients } from "../../src/services/send.service.js";
import { formatDate } from "../../src/utils/format.js";

const box = { page: 1, xPercent: 0.1, yPercent: 0.1, widthPercent: 0.2, heightPercent: 0.05 };
const signer = { _id: "r1", name: "Asha Rao", email: "asha@example.test" };

describe("fields are cleaned the same way on every path", () => {
  it("refuses a type it does not know, and a page the document does not have", () => {
    expect(() => normalizeField({ ...box, type: "bogus" })).toThrow(/Unknown field type/);
    expect(() => normalizeField({ ...box, type: "text", page: 3 }, { pageCount: 2 })).toThrow(/page 3/);
  });

  it("keeps a field wholly on its page", () => {
    const field = normalizeField({ ...box, type: "signature", xPercent: 0.95, yPercent: 0.99, widthPercent: 0.3, heightPercent: 0.1 });
    expect(field.xPercent + field.widthPercent).toBeLessThanOrEqual(1);
    expect(field.yPercent + field.heightPercent).toBeLessThanOrEqual(1);
  });

  it("makes checkboxes optional and everything else required unless told otherwise", () => {
    expect(normalizeField({ ...box, type: "checkbox" }).required).toBe(false);
    expect(normalizeField({ ...box, type: "checkbox", required: true }).required).toBe(true);
    expect(normalizeField({ ...box, type: "text" }).required).toBe(true);
    expect(normalizeField({ ...box, type: "signature", required: false }).required).toBe(false);
    // Filled in by the server, so never waiting on the signer
    expect(normalizeField({ ...box, type: "date", required: true }).required).toBe(false);
  });

  it("lets a sender pre-fill text but never a signature, a tick or a date", () => {
    const layout = normalizeFieldList(
      [
        { ...box, id: "t", type: "text", value: "Flat 302", readOnly: true },
        { ...box, id: "s", type: "signature", signatureUrl: "data:image/png;base64,AAAA" },
        { ...box, id: "c", type: "checkbox", checked: true },
        { ...box, id: "d", type: "date", value: "01 Jan 2020" },
      ],
      { values: "layout" }
    );
    const byId = Object.fromEntries(layout.map((f) => [f.id, f]));
    expect(byId.t).toMatchObject({ value: "Flat 302", readOnly: true });
    expect(byId.s.signatureUrl).toBeUndefined();
    expect(byId.c.checked).toBe(false);
    expect(byId.d.value).toBeUndefined();
  });

  it("does not keep a read-only text field with nothing in it read-only", () => {
    expect(normalizeField({ ...box, type: "text", value: "", readOnly: true }).readOnly).toBe(false);
  });

  it("needs at least one choice in a dropdown, and keeps them unique", () => {
    expect(() => normalizeField({ ...box, type: "dropdown", options: [" ", ""] })).toThrow(/at least one choice/);
    expect(normalizeField({ ...box, type: "dropdown", options: ["Yes", "Yes", "No"] }).options).toEqual(["Yes", "No"]);
  });

  it("makes a radio group required as a whole when any option is", () => {
    const fields = normalizeFieldList([
      { ...box, id: "a", type: "radio", groupId: "g", required: true },
      { ...box, id: "b", type: "radio", groupId: "g", required: false },
    ]);
    expect(fields.map((f) => f.required)).toEqual([true, true]);
  });

  it("gives repeated ids new ones", () => {
    const fields = normalizeFieldList([
      { ...box, id: "same", type: "text" },
      { ...box, id: "same", type: "text" },
    ]);
    expect(new Set(fields.map((f) => f.id)).size).toBe(2);
  });
});

describe("what a signer must complete", () => {
  it("counts a radio group once and is satisfied by any one answer", () => {
    const group = [
      { id: "a", type: "radio", groupId: "g", required: true, checked: false },
      { id: "b", type: "radio", groupId: "g", required: true, checked: false },
    ];
    expect(missingRequired(group).map((f) => f.id)).toEqual(["a"]);
    expect(missingRequired([group[0], { ...group[1], checked: true }])).toEqual([]);
  });

  it("never waits on an optional checkbox or a date", () => {
    expect(missingRequired([{ id: "c", type: "checkbox", required: false }, { id: "d", type: "date" }])).toEqual([]);
  });

  it("checks typed values against the format the sender chose", () => {
    expect(problemWithValue({ type: "text", format: "number", value: "12,500.50" })).toBeNull();
    expect(problemWithValue({ type: "text", format: "number", value: "twelve" })).toMatch(/number/);
    expect(problemWithValue({ type: "text", format: "email", value: "asha@" })).toMatch(/email/);
    expect(problemWithValue({ type: "text", format: "date", value: "05 Sept 2026" })).toBeNull();
    expect(problemWithValue({ type: "dropdown", options: ["Yes", "No"], value: "Maybe" })).toMatch(/choices/);
  });
});

describe("a signer's submission", () => {
  const fields = [
    { ...box, id: "date", type: "date", recipientId: "r1" },
    { ...box, id: "name", type: "name", recipientId: "r1" },
    { ...box, id: "fixed", type: "text", value: "Pune", readOnly: true, required: true, recipientId: "r1" },
    { ...box, id: "yes", type: "radio", groupId: "g", required: true, recipientId: "r1" },
    { ...box, id: "no", type: "radio", groupId: "g", required: true, recipientId: "r1" },
    { ...box, id: "theirs", type: "text", required: true, recipientId: "r2" },
  ];

  it("writes the date, name and read-only text itself, whatever was sent", () => {
    const signedAt = new Date("2026-10-15T06:00:00Z");
    const { mine } = mergeSignerFields({
      fields,
      recipient: signer,
      signedAt,
      submitted: [
        { id: "date", value: "01 Jan 2020" },
        { id: "name", value: "Someone Else" },
        { id: "fixed", value: "Mumbai" },
        { id: "yes", checked: true },
      ],
    });
    const byId = Object.fromEntries(mine.map((f) => [f.id, f]));
    expect(byId.date.value).toBe(formatDate(signedAt));
    expect(byId.name.value).toBe("Asha Rao");
    expect(byId.fixed.value).toBe("Pune");
  });

  it("keeps one answer per radio group", () => {
    const { mine } = mergeSignerFields({ fields, recipient: signer, submitted: [{ id: "yes", checked: true }, { id: "no", checked: true }] });
    expect(mine.filter((f) => f.type === "radio" && f.checked).map((f) => f.id)).toEqual(["yes"]);
  });

  it("refuses an unanswered required radio group", () => {
    expect(() => mergeSignerFields({ fields, recipient: signer, submitted: [] })).toThrow(/required fields/);
  });

  it("never changes another signer's field", () => {
    const { merged } = mergeSignerFields({ fields, recipient: signer, submitted: [{ id: "yes", checked: true }, { id: "theirs", value: "mine now" }] });
    expect(merged.find((f) => f.id === "theirs").value).toBeUndefined();
  });

  it("shows a signer only their own fields", () => {
    expect(fieldsForSigner(fields, "r2").map((f) => f.id)).toEqual(["theirs"]);
  });
});

describe("whose each field is", () => {
  const people = [
    { id: "client-a", name: "Asha Rao", email: "shared@example.test", role: "signer" },
    { id: "client-b", name: "Ravi Rao", email: "shared@example.test", role: "signer" },
    { id: "client-c", name: "Meera", email: "meera@example.test", role: "viewer" },
  ];

  it("goes by the editor's id first, so two people sharing an email keep their own fields", () => {
    expect(matchFieldsToRecipients([{ type: "signature", page: 1, recipientId: "client-b", recipientEmail: "shared@example.test" }], people)).toEqual([1]);
  });

  it("refuses a field that names nobody instead of giving it to the first signer", () => {
    expect(() => matchFieldsToRecipients([{ type: "signature", page: 2, recipientEmail: "nobody@example.test" }], people)).toThrow(/not assigned/);
  });

  it("refuses a field for someone who only views", () => {
    expect(() => matchFieldsToRecipients([{ type: "text", page: 1, recipientId: "client-c" }], people)).toThrow(/only views/);
  });

  it("matches a name only when one person has it", () => {
    const twins = [
      { id: "1", name: "Same Name", email: "a@example.test", role: "signer" },
      { id: "2", name: "Same Name", email: "b@example.test", role: "signer" },
    ];
    expect(() => matchFieldsToRecipients([{ type: "text", page: 1, recipientName: "Same Name" }], twins)).toThrow(/not assigned/);
  });
});
