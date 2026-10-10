import { test, expect } from "@playwright/test";
import { draft, recipientsOf, hi, pageCanvas } from "./helpers.js";

// The sender's screens: sign in, name a signer who reads Hindi, place fields, send.
// Then the signer opens the link that was sent and finds the page in Hindi.
test.describe("sending a document", () => {
  test("a sender sends to a Hindi signer through the app, and the signer is greeted in Hindi", async ({ page, browser, baseURL }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const doc = await draft({ pages: 1 });

    await page.goto("/login");
    await page.getByPlaceholder("name@company.com").fill(doc.ownerEmail);
    await page.getByPlaceholder("••••••••").fill(doc.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard");

    // Who signs, and in which language
    await page.goto(`/send/${doc.pdfId}`);
    await page.getByPlaceholder("e.g. John Doe").fill("आशा राव");
    await page.getByPlaceholder("john@company.com").fill("asha@example.test");
    await page.locator("select").filter({ has: page.locator('option[value="hi"]') }).selectOption("hi");
    await page.getByRole("button", { name: /Next: Place Form Fields/ }).click();
    await page.waitForURL(`**/assign/${doc.pdfId}`);

    // Place a signature field. A sender can move it (only signers have fields locked).
    await expect(pageCanvas(page)).toBeVisible();
    await page.getByRole("button", { name: /^Signature/ }).first().click();
    const field = page.getByTestId("field-signature");
    await expect(field).toBeVisible();

    const before = await field.boundingBox();
    await page.mouse.move(before.x + 20, before.y + 20);
    await page.mouse.down();
    await page.mouse.move(before.x + 140, before.y + 160, { steps: 8 });
    await page.mouse.up();
    const after = await field.boundingBox();
    expect(after.x - before.x).toBeGreaterThan(60);
    expect(after.y - before.y).toBeGreaterThan(60);

    // A date field is left empty for the signer: it takes the day they sign, not the day it was sent
    await page.getByRole("button", { name: /Date Field/ }).click();
    await expect(page.getByTestId("field-date")).toBeVisible();
    expect(await page.getByTestId("field-date").locator("input").inputValue()).toBe("");

    await page.getByRole("button", { name: /Send for Signing/ }).click();
    await page.waitForURL("**/dashboard");

    // The signer was stored with their language and was written to in Hindi
    const [signer] = await recipientsOf(doc.pdfId);
    expect(signer).toMatchObject({ name: "आशा राव", email: "asha@example.test", language: "hi", channel: "email" });
    expect(signer.emails.some((subject) => subject.includes("हस्ताक्षर का अनुरोध"))).toBe(true);
    expect(errors).toEqual([]);

    // The signer opens the link on their own device
    const signerContext = await browser.newContext({ baseURL });
    const signerPage = await signerContext.newPage();
    await signerPage.goto(`/sign/${signer.token}`);
    await expect(pageCanvas(signerPage)).toBeVisible();
    await expect(signerPage.getByText(hi.consent.text)).toBeVisible();
    await expect(signerPage.getByTestId("field-signature")).toBeVisible();
    await signerContext.close();
  });
});
