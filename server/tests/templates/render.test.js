import { describe, it, expect } from "vitest";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { renderPdfPage, pdfText, inkPixels } from "../render.js";
import { sampleAnswers, hindiRentAgreement, hindiAnswers } from "./fixtures.js";
import { SEED_DEFINITIONS, PACKS } from "../../src/templates/catalogue.js";
import { renderTemplate } from "../../src/services/templateRender.service.js";
import { validateDefinition } from "../../src/services/templateCatalogue.service.js";
import { numberInWords, fillText, checkAnswers, applies, BLANK } from "../../src/services/templateText.service.js";

const find = (key) => SEED_DEFINITIONS.find((definition) => definition.key === key);
const rent = find("rent-agreement-11-month");

const rentAnswers = {
  agreement_date: "2026-10-11",
  landlord_name: "Ramesh Kumar Sharma",
  landlord_address: "14 MG Road, Pune 411001",
  tenant_name: "Asha Rao",
  tenant_address: "22 Lake View, Bengaluru 560001",
  property_address: "Flat 302, Shree Ganesh Apartments, Kothrud, Pune 411038",
  state: "MH",
  city: "Pune",
  start_date: "2026-11-01",
  rent: 18500,
  rent_day: 5,
  deposit: 125000,
  maintenance_by: "tenant",
  notice_months: 1,
};

describe("P4-03 filling answers into template text", () => {
  it("writes amounts in words the Indian way", () => {
    expect(numberInWords(0)).toBe("Zero");
    expect(numberInWords(15)).toBe("Fifteen");
    expect(numberInWords(18500)).toBe("Eighteen Thousand Five Hundred");
    expect(numberInWords(125000)).toBe("One Lakh Twenty Five Thousand");
    expect(numberInWords(10000000)).toBe("One Crore");
    expect(numberInWords(123456789)).toBe("Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred and Eighty Nine");
  });

  it("formats money, dates and date arithmetic", () => {
    const fill = (text, language = "en") => fillText(text, { rent: 125000, start: "2026-11-01", end: "2027-01-31", paise: 99.5 }, { language });
    expect(fill("{{rent|money}}")).toBe("Rs. 1,25,000");
    expect(fill("{{rent|money}}", "hi")).toBe("₹1,25,000");
    expect(fill("{{rent|words}}")).toBe("Rupees One Lakh Twenty Five Thousand only");
    expect(fill("{{paise|words}}")).toBe("Rupees Ninety Nine and Fifty Paise only");
    expect(fill("{{start|date}}")).toBe("1 November 2026");
    // Eleven months from 1 November, less a day
    expect(fill("{{start|addMonths:11|addDays:-1|date}}")).toBe("30 September 2027");
    // A month added to the 31st lands on the last day of the shorter month
    expect(fill("{{end|addMonths:1|date}}")).toBe("28 February 2027");
  });

  it("leaves a blank to write on where a question is unanswered or a filter is unknown", () => {
    expect(fillText("Rent of {{rent|money}} from {{who}}", {})).toBe(`Rent of ${BLANK} from ${BLANK}`);
    expect(fillText("{{rent|nonsense}}", { rent: 5 })).toBe(BLANK);
  });

  it("shows a chosen option by its label", () => {
    const questions = [{ id: "mode", type: "select", options: [{ value: "upi", label: "UPI" }] }];
    expect(fillText("Paid by {{mode}}", { mode: "upi" }, { questions })).toBe("Paid by UPI");
  });

  it("does not fill placeholders that arrive inside an answer", () => {
    expect(fillText("Name: {{name}}", { name: "{{rent|money}}", rent: 5 })).toBe("Name: {{rent|money}}");
  });

  it("checks answers by question type and keeps only what the template asks", () => {
    const { answers, errors } = checkAnswers(rent, { ...rentAnswers, rent: "18,500", rent_day: 31, state: "XX", extra: "dropped", $where: "x" });
    expect(answers.rent).toBe(18500);
    expect(errors).toMatchObject({ rent_day: expect.any(String), state: expect.any(String) });
    expect(answers).not.toHaveProperty("extra");
    expect(answers).not.toHaveProperty("$where");
  });

  it("requires every required question when sending, and none when previewing", () => {
    expect(Object.keys(checkAnswers(rent, {}).errors)).toEqual(expect.arrayContaining(["landlord_name", "rent", "start_date"]));
    expect(checkAnswers(rent, {}, { partial: true }).errors).toEqual({});
    // An optional question is never required
    expect(checkAnswers(rent, rentAnswers).errors).toEqual({});
  });

  it("fills a date question whose default is today from the sender's date", () => {
    const { agreement_date: _omitted, ...rest } = rentAnswers;
    expect(checkAnswers(rent, rest, { today: "2026-12-25" }).answers.agreement_date).toBe("2026-12-25");
  });

  it("rejects dates that do not exist", () => {
    expect(checkAnswers(rent, { ...rentAnswers, start_date: "2026-02-31" }).errors.start_date).toBeTruthy();
  });

  it("applies conditions on answers", () => {
    expect(applies(undefined, {})).toBe(true);
    expect(applies({ question: "a", equals: "x" }, { a: "x" })).toBe(true);
    expect(applies({ question: "a", equals: "x" }, { a: "y" })).toBe(false);
    expect(applies({ question: "a", answered: true }, {})).toBe(false);
    expect(applies({ question: "a", answered: true }, { a: 3 })).toBe(true);
  });
});

describe("P4-01 every template that ships is sound", () => {
  it("has a known pack and no broken placeholder, condition or signer", () => {
    for (const definition of SEED_DEFINITIONS) {
      expect(validateDefinition(definition), definition.key).toEqual([]);
      expect(PACKS[definition.pack], definition.key).toBeTruthy();
    }
  });

  it("has no two templates with the same key", () => {
    const keys = SEED_DEFINITIONS.map((definition) => `${definition.key}:${definition.language}:${definition.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the eight Starter templates and the converted older ones", () => {
    expect(SEED_DEFINITIONS.filter((d) => d.pack === "starter").map((d) => d.key).sort()).toEqual([
      "acknowledgement-of-receipt",
      "consent-form",
      "freelance-contract",
      "mutual-nda",
      "offer-letter-basic",
      "rent-agreement-11-month",
      "rent-receipt",
      "service-agreement",
    ]);
    const converted = SEED_DEFINITIONS.filter((d) => d.legacyId);
    expect(converted).toHaveLength(13);
    // Promissory notes between private individuals are still outside the IT Act
    expect(converted.some((d) => d.legacyId === "tpl-promissory-note")).toBe(false);
  });

  it("marks every unreviewed template as unreviewed", () => {
    for (const definition of SEED_DEFINITIONS) expect(definition.reviewer, definition.key).toBeNull();
  });

  it("reports what is wrong with a broken definition", () => {
    const broken = {
      ...rent,
      roles: [...rent.roles, { id: "witness", name: "Witness", nameFrom: "witness_name" }],
      body: [
        { type: "paragraph", text: "Rent {{rentt|money}} and {{rent|dollars}} and {{ broken" },
        { type: "marquee", text: "x" },
        { type: "clause", text: "x", showIf: { question: "nope", equals: 1 } },
        { type: "signatures", roles: ["landlord", "tenant"] },
      ],
    };
    const problems = validateDefinition(broken).join("\n");
    expect(problems).toContain("{{rentt}}");
    expect(problems).toContain('unknown filter "dollars"');
    expect(problems).toContain("malformed placeholder");
    expect(problems).toContain("unknown type");
    expect(problems).toContain('depends on "nope"');
    expect(problems).toContain('"witness_name", which is not a question');
    expect(problems).toContain('signer "witness" has nowhere to sign');
  });
});

describe("P4-03 a template and answers become a PDF with fields in place", () => {
  it.each(SEED_DEFINITIONS.map((definition) => [definition.key, definition]))("%s renders with sample answers", async (_key, definition) => {
    const { buffer, pageCount, fields } = await renderTemplate(definition, sampleAnswers(definition));

    const loaded = await PDFDocument.load(buffer);
    expect(loaded.getPageCount()).toBe(pageCount);
    expect(pageCount).toBeGreaterThanOrEqual(1);

    // Every signer has a signature and a date, and every field lies inside its page
    for (const role of definition.roles) {
      expect(fields.filter((f) => f.roleId === role.id).map((f) => f.type).sort(), role.id).toEqual(["date", "signature"]);
    }
    for (const field of fields) {
      expect(field.page).toBeGreaterThanOrEqual(1);
      expect(field.page).toBeLessThanOrEqual(pageCount);
      for (const edge of [field.xPercent, field.yPercent, field.xPercent + field.widthPercent, field.yPercent + field.heightPercent]) {
        expect(edge).toBeGreaterThanOrEqual(0);
        expect(edge).toBeLessThanOrEqual(1);
      }
    }
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);

    // No placeholder survives into the document, and nothing was left blank
    const text = (await pdfText(buffer)).join(" ");
    expect(text).not.toMatch(/\{\{|\}\}/);
    expect(text).not.toContain(BLANK);
  });

  it("renders every branch of every choice", async () => {
    for (const definition of SEED_DEFINITIONS) {
      for (const question of definition.questions.filter((q) => q.type === "select")) {
        for (const option of question.options) {
          const { buffer } = await renderTemplate(definition, sampleAnswers(definition, { [question.id]: option.value }));
          expect((await pdfText(buffer)).join(" "), `${definition.key} ${question.id}=${option.value}`).not.toMatch(/\{\{|\}\}/);
        }
      }
    }
  });

  it("puts the sender's answers into the rent agreement", async () => {
    const { buffer, pageCount, fields } = await renderTemplate(rent, rentAnswers);
    const text = (await pdfText(buffer)).join(" ");

    expect(text).toContain("Ramesh Kumar Sharma");
    expect(text).toContain("Asha Rao");
    expect(text).toContain("Rs. 18,500 (Rupees Eighteen Thousand Five Hundred only)");
    expect(text).toContain("Rs. 1,25,000 (Rupees One Lakh Twenty Five Thousand only)");
    expect(text).toContain("from 1 November 2026 to 30 September 2027");
    expect(text).toContain("society maintenance charges for the Premises");
    expect(text).toContain(`Page ${pageCount} of ${pageCount}`);

    // Lock-in was not answered, so its clause is absent and the numbering has no gap
    expect(text).not.toContain("Lock-in");
    const numbers = [...text.matchAll(/(?:^| )(\d{1,2})\. [A-Z]/g)].map((m) => Number(m[1]));
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));

    // The landlord signs on the left, the tenant on the right, on the same line
    const [landlord, tenant] = ["landlord", "tenant"].map((id) => fields.find((f) => f.roleId === id && f.type === "signature"));
    expect(landlord.xPercent).toBeLessThan(tenant.xPercent);
    expect(landlord.yPercent).toBeCloseTo(tenant.yPercent, 5);
    expect(landlord.page).toBe(tenant.page);
  });

  it("includes a clause only when its condition holds", async () => {
    const withLockIn = await renderTemplate(rent, { ...rentAnswers, lock_in_months: 6, maintenance_by: "landlord" });
    const text = (await pdfText(withLockIn.buffer)).join(" ");
    expect(text).toContain("Lock-in");
    expect(text).toContain("first 6 month(s)");
    expect(text).toContain("The Landlord shall pay the society maintenance charges");
  });

  it("gives the same file, byte for byte, for the same input", async () => {
    const first = await renderTemplate(rent, rentAnswers);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await renderTemplate(rent, rentAnswers);
    expect(first.buffer.equals(second.buffer)).toBe(true);

    const changed = await renderTemplate(rent, { ...rentAnswers, rent: 18501 });
    expect(first.buffer.equals(changed.buffer)).toBe(false);
  });

  it("prints what a sender types as plain text, never as formatting or a placeholder", async () => {
    const { buffer } = await renderTemplate(rent, { ...rentAnswers, tenant_name: "**Asha** {{rent|money}}" });
    expect((await pdfText(buffer)).join(" ")).toContain("**Asha** {{rent|money}}");
  });

  it("keeps a very long unbroken value inside the page", async () => {
    const { buffer } = await renderTemplate(rent, { ...rentAnswers, property_address: "X".repeat(190) });
    const { canvas } = await renderPdfPage(buffer, 1, 1);
    const context = canvas.getContext("2d");
    // Nothing is drawn in the right-hand margin
    const margin = context.getImageData(canvas.width - 40, 0, 40, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < margin.length; i += 4) if (margin[i] + margin[i + 1] + margin[i + 2] < 384) ink += 1;
    expect(ink).toBe(0);
  });

  it("leaves blanks, not errors, when a draft is rendered half-filled", async () => {
    const { buffer } = await renderTemplate(rent, { landlord_name: "Ramesh Kumar Sharma" });
    const text = (await pdfText(buffer)).join(" ");
    expect(text).toContain("Ramesh Kumar Sharma");
    expect(text).toContain(BLANK);
  });
});

// Decision record: docs/decisions/0002-template-renderer.md
describe("P4-02 the renderer handles a two-page Hindi agreement within its limits", () => {
  it("lays out Hindi text across two pages, quickly and in little memory", async () => {
    expect(validateDefinition(hindiRentAgreement)).toEqual([]);

    // Warm the fonts up, so the measurement is of rendering and not of loading font files
    await renderTemplate(hindiRentAgreement, hindiAnswers);

    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    const { buffer, pageCount, fields } = await renderTemplate(hindiRentAgreement, hindiAnswers);
    const milliseconds = performance.now() - started;
    const heapGrowth = (process.memoryUsage().heapUsed - before) / (1024 * 1024);

    expect(pageCount).toBe(2);
    expect(fields).toHaveLength(4);
    expect(fields.every((f) => f.page === 2)).toBe(true);

    // The service runs in a 512 MB container; one render must be a small part of that
    expect(heapGrowth).toBeLessThan(120);
    expect(milliseconds).toBeLessThan(4000);
    expect(buffer.length).toBeLessThan(1.5 * 1024 * 1024);

    // Both pages carry text, and none of it runs into the margins
    for (const number of [1, 2]) {
      const { canvas } = await renderPdfPage(buffer, number, 1);
      expect(inkPixels(canvas)).toBeGreaterThan(number === 1 ? 20000 : 3000);
      const context = canvas.getContext("2d");
      for (const x of [0, canvas.width - 44]) {
        const strip = context.getImageData(x, 0, 44, canvas.height).data;
        let ink = 0;
        for (let i = 0; i < strip.length; i += 4) if (strip[i] + strip[i + 1] + strip[i + 2] < 384) ink += 1;
        expect(ink, `page ${number} margin at x=${x}`).toBe(0);
      }
      if (process.env.SAVE_RENDERS) {
        const big = await renderPdfPage(buffer, number, 1.6);
        fs.writeFileSync(`${process.env.SAVE_RENDERS}/hindi-rent-${number}.png`, big.canvas.toBuffer("image/png"));
      }
    }

    if (process.env.SAVE_RENDERS) {
      const english = await renderTemplate(rent, { ...rentAnswers, lock_in_months: 3 });
      for (let number = 1; number <= english.pageCount; number++) {
        const page = await renderPdfPage(english.buffer, number, 1.6);
        fs.writeFileSync(`${process.env.SAVE_RENDERS}/english-rent-${number}.png`, page.canvas.toBuffer("image/png"));
      }
      fs.writeFileSync(
        `${process.env.SAVE_RENDERS}/renderer-measurements.json`,
        JSON.stringify({ milliseconds: Math.round(milliseconds), heapGrowthMb: Number(heapGrowth.toFixed(1)), bytes: buffer.length, pageCount })
      );
    }
  });
});
