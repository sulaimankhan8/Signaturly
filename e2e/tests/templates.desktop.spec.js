import { test, expect } from "@playwright/test";
import { draft, signIn, latestDocumentOf, en, hi, pageCanvas } from "./helpers.js";

// Plan task P4-04: answer, preview, send, sign.
test.describe("guided templates", () => {
  test("a free account fills in the rent agreement, sends it, and both parties sign", async ({ page, browser, baseURL }) => {
    test.setTimeout(150_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const account = await draft({ pages: 1 });
    await signIn(page, account);

    // The library shows what the plan includes and what a higher plan would add
    await page.goto("/templates");
    await page.getByRole("button", { name: /Template Library/ }).click();
    await expect(page.getByTestId("pack-starter")).toContainText("Included in your plan");
    await expect(page.getByTestId("pack-general")).toContainText("Pro plan");
    await expect(page.getByTestId("template-general-nda").getByRole("button")).toHaveText("Available on Pro");
    await expect(page.getByTestId("template-rent-agreement-11-month")).toContainText("Not yet reviewed by a lawyer");

    await page.getByTestId("template-rent-agreement-11-month").getByRole("button", { name: "Use this template" }).click();
    await page.waitForURL("**/templates/fill/rent-agreement-11-month");

    // Plan task P4-07: the stamping note is shown before anything is sent
    const notes = page.getByTestId("template-notes");
    await expect(notes).toContainText("Stamp duty applies");
    await expect(notes).toContainText("starting draft, not legal advice");
    await expect(notes.locator("[data-testid^=state-note-]")).toHaveCount(5);

    // The preview appears before anything is answered
    await expect(page.getByTestId("template-preview").locator("canvas")).toBeVisible();

    // Sending is refused while questions are unanswered, and the first one is pointed out
    await page.getByRole("button", { name: "Next: who signs" }).click();
    await expect(page.getByText(/questions still need an answer/)).toBeVisible();
    await expect(page.getByRole("alert").first()).toHaveText("This is needed");

    await page.getByLabel("Landlord's full name").fill("Ramesh Kumar Sharma");
    await page.getByLabel("Landlord's address").fill("14 MG Road, Pune 411001");
    await page.getByLabel("Tenant's full name").fill("Asha Rao");
    await page.getByLabel("Tenant's permanent address").fill("22 Lake View, Bengaluru 560001");
    await page.getByLabel("Address of the property being let").fill("Flat 302, Shree Ganesh Apartments, Kothrud, Pune 411038");
    await page.getByLabel("State where the property is").selectOption("MH");
    await page.getByLabel("City where the property is").fill("Pune");
    await page.getByLabel("Date the tenancy starts").fill("2026-11-01");
    await page.getByLabel("Monthly rent, in rupees").fill("18,500");
    await page.getByLabel("Security deposit, in rupees").fill("55000");
    await page.getByLabel("Who pays the society maintenance charges?").selectOption("tenant");

    // Once the state is chosen, only its note is shown
    await expect(notes.locator("[data-testid^=state-note-]")).toHaveCount(1);
    await expect(page.getByTestId("state-note-MH")).toContainText("registered");

    if (process.env.SAVE_RENDERS) await page.screenshot({ path: `${process.env.SAVE_RENDERS}/template-fill.png`, fullPage: true });

    // The work so far is kept
    await expect(page.getByText("Draft saved")).toBeVisible();

    // The answers reach the signers step: names are already filled in
    await page.getByRole("button", { name: "Next: who signs" }).click();
    await expect(page.getByLabel("Landlord: name")).toHaveValue("Ramesh Kumar Sharma");
    await expect(page.getByLabel("Tenant: name")).toHaveValue("Asha Rao");

    await page.getByLabel("Landlord: email").fill("ramesh@example.test");
    await page.getByLabel("Tenant: email").fill("asha@example.test");
    await page.getByLabel("Tenant: language").selectOption("hi");
    await page.getByRole("button", { name: "Send for signature" }).click();
    await page.waitForURL("**/dashboard");
    expect(errors).toEqual([]);

    // A document was made from version 1 of the template and sent to both
    const sent = await latestDocumentOf(account.ownerEmail);
    expect(sent).toMatchObject({
      status: "pending",
      pageCount: 2,
      template: { key: "rent-agreement-11-month", version: 1, language: "en" },
      recipients: [
        // They sign in order: the landlord has been asked, the tenant is waiting for their turn
        { name: "Ramesh Kumar Sharma", email: "ramesh@example.test", language: "en", status: "sent" },
        { name: "Asha Rao", email: "asha@example.test", language: "hi", status: "pending" },
      ],
    });

    // Each party signs on their own device: the landlord in English, the tenant in Hindi
    const sign = async (recipient, words, signaturesOnPage) => {
      const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
      const signer = await context.newPage();
      await signer.goto(`/sign/${recipient.token}`);
      await expect(pageCanvas(signer)).toBeVisible();

      await signer.getByRole("button", { name: words.sig.tabType, exact: true }).click();
      await signer.getByPlaceholder(words.typed.placeholder).fill(recipient.name);
      await signer.getByRole("button", { name: words.typed.use }).click();

      // The signature goes into the field the template placed, on the last page.
      // A later signer also sees the signatures already given.
      await signer.getByRole("button", { name: words.pager.next }).click();
      await expect(signer.getByTestId("field-signature").filter({ has: signer.locator("img") })).toHaveCount(signaturesOnPage);

      await signer.getByRole("checkbox").check();
      await signer.getByRole("banner").getByRole("button", { name: words.actions.sign }).click();
      await expect(signer.getByRole("heading", { name: words.completed.title })).toBeVisible({ timeout: 30_000 });
      await context.close();
    };

    await sign(sent.recipients[0], en, 1);
    await sign(sent.recipients[1], hi, 2);

    const done = await latestDocumentOf(account.ownerEmail);
    expect(done).toMatchObject({ status: "signed", sealed: true });
    expect(done.recipients.map((r) => r.status)).toEqual(["signed", "signed"]);
  });

  test("a draft is waiting when the sender comes back", async ({ page }) => {
    const account = await draft({ pages: 1 });
    await signIn(page, account);

    await page.goto("/templates/fill/mutual-nda");
    await page.getByLabel("First party: name of the person or business").fill("Sharma Traders");
    await expect(page.getByText("Draft saved")).toBeVisible();

    await page.goto("/templates/fill/mutual-nda");
    await expect(page.getByText("Draft restored")).toBeVisible();
    await expect(page.getByLabel("First party: name of the person or business")).toHaveValue("Sharma Traders");
  });

  test("a template outside the plan explains which plan opens it", async ({ page }) => {
    const account = await draft({ pages: 1 });
    await signIn(page, account);

    await page.goto("/templates/fill/general-nda");
    await expect(page.getByText(/part of the pro plan and above/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
  });
});
