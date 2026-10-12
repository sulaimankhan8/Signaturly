import { test, expect } from "@playwright/test";
import { adminAccount, draft, seed, signIn } from "./helpers.js";

// Signs in to the admin app with a fresh admin account, and lands on the overview
const signInAdmin = async (page) => {
  const admin = await adminAccount();
  await page.goto(`${admin.adminUrl}/login`);
  await page.getByPlaceholder("admin@pactdoc.com").fill(admin.email);
  await page.getByPlaceholder("••••••••••••").fill(admin.password);
  await page.getByPlaceholder("Enter Admin Secret Key").fill(admin.adminSecret);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/overview");
  return admin;
};

const section = (page, name) => page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name, exact: true });

// Plan task P4-05: a template is created, edited, published and reviewed from the admin panel,
// with no deploy, and senders then get it.
test.describe("template admin", () => {
  test("an admin creates a template, publishes it and records its review; a sender then uses it", async ({ page, browser, baseURL }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await signInAdmin(page);
    const key = `visitor-declaration-${Date.now()}`;

    await section(page, "Templates").click();
    await page.waitForURL("**/templates");

    // The templates that ship with the product are listed, marked as not reviewed
    const list = page.getByRole("navigation", { name: "Templates" });
    await expect(list.getByRole("button", { name: /11-Month Rent Agreement/ })).toContainText("not reviewed");

    // A published version cannot be edited in place
    await list.getByRole("button", { name: /Mutual Non-Disclosure Agreement.*mutual-nda/s }).click();
    await expect(page.getByText(/Published: its wording cannot be changed/)).toBeVisible();
    await expect(page.getByLabel("Text", { exact: true })).toBeDisabled();
    // Which template is open is in the address, so the page can be reloaded or linked to
    await expect(page).toHaveURL(/key=mutual-nda/);

    // Create a new template: it starts as a draft
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByPlaceholder("visitor-declaration").fill(key);
    await page.getByLabel("Title").last().fill("Visitor Declaration");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("status")).toContainText("Template created as a draft");
    await expect(page.getByText(/Draft: not offered to senders/)).toBeVisible();

    // Write its text
    const text = page.getByLabel("Text", { exact: true });
    await text.fill(
      JSON.stringify(
        [
          { type: "title", text: "Visitor Declaration" },
          { type: "paragraph", text: "I, **{{signer_name}}**, have read the site rules and will follow them." },
          { type: "signatures" },
        ],
        null,
        2
      )
    );
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved.");

    // A placeholder that names no question is refused, with the reason
    const good = await text.inputValue();
    await text.fill(good.replace("{{signer_name}}", "{{visitor}}"));
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("{{visitor}}, which is not a question");

    // A mistake in the JSON is caught as the field is left, with the line it is on
    await text.fill(good.replace('"type": "signatures"', '"type": '));
    await text.blur();
    await expect(page.getByText(/^Line \d+, column \d+: a value is expected here$/)).toBeVisible();

    // Unsaved edits are not thrown away by clicking another template
    await list.getByRole("button", { name: /Mutual Non-Disclosure Agreement.*mutual-nda/s }).click();
    const leaving = page.getByRole("dialog", { name: "Leave without saving?" });
    await leaving.getByRole("button", { name: "Stay" }).click();
    await expect(page.getByText(/Draft: not offered to senders/)).toBeVisible();

    await text.fill(good);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved.");

    // Read it as a PDF before publishing
    await page.getByRole("button", { name: "Make preview" }).click();
    await expect(page.getByRole("link", { name: "Open preview (1 page)" })).toBeVisible();

    // Publishing says what it does and asks first
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publishing = page.getByRole("dialog", { name: "Publish version 1?" });
    await expect(publishing).toContainText("New documents made from");
    await publishing.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status")).toContainText("Version 1 is published");
    await expect(text).toBeDisabled();

    // Record the lawyer's review of this version
    await page.getByLabel("Reviewer's name").fill("Adv. N. Iyer");
    await page.getByLabel("Date of review").fill("2026-10-01");
    await page.getByRole("button", { name: "Record review" }).click();
    await expect(page.getByText(/Reviewed by Adv\. N\. Iyer on 01 Oct 2026/)).toBeVisible();

    // The next change is a new version, in draft; the review does not carry over
    await page.getByRole("button", { name: "Start new version from this" }).click();
    await expect(page.getByRole("button", { name: /Version 2 · draft/ })).toBeVisible();
    await expect(page.getByText(/Not reviewed\. Senders are told so/)).toBeVisible();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await page.getByRole("dialog", { name: "Delete the draft of version 2?" }).getByRole("button", { name: "Delete the draft" }).click();
    await expect(page.getByRole("button", { name: /Version 2/ })).toHaveCount(0);
    await expect(page.getByText("History of this version")).toBeVisible();
    expect(errors).toEqual([]);

    // A sender now finds the template, with its review shown
    const senderContext = await browser.newContext({ baseURL });
    const sender = await senderContext.newPage();
    await signIn(sender, await draft({ pages: 1 }));
    await sender.goto(`/templates/fill/${key}`);
    await expect(sender.getByRole("heading", { name: "Visitor Declaration" })).toBeVisible();
    await expect(sender.getByTestId("template-notes")).toContainText("Reviewed by Adv. N. Iyer, October 2026");
    await expect(sender.getByLabel("Signer's full name")).toBeVisible();
    await senderContext.close();
  });
});

// Roadmap item A-22: the rest of the admin app.
test.describe("admin app", () => {
  test("an admin finds an account, changes its plan, and the change is on record", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const account = await draft({ pages: 1 });
    const admin = await signInAdmin(page);

    // Money is in rupees and the signed-in admin is the one named
    await expect(page.getByText("Received this month")).toBeVisible();
    await expect(page.getByText("₹0").first()).toBeVisible();
    await expect(page.getByText(admin.email)).toBeVisible();

    await section(page, "Users").click();
    await page.getByLabel("Search").fill(account.ownerEmail);
    const users = page.getByRole("table", { name: "Users" });
    await expect(users.getByRole("row")).toHaveCount(2);
    await expect(page).toHaveURL(/search=/);
    await users.getByRole("link", { name: "Meera Sharma" }).click();

    await expect(page.getByRole("heading", { name: "Meera Sharma" })).toBeVisible();
    await expect(page.getByText("5 documents a month")).toBeVisible();

    await page.getByRole("button", { name: "Change plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Change plan" });
    await expect(dialog).toContainText("This plan gives 50 documents a month.");

    // A change needs a reason
    await dialog.getByRole("button", { name: "Change plan" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Say why the plan is being changed.");

    await dialog.getByLabel("Ends after (days)").fill("90");
    await dialog.getByLabel("Reason").fill("Pilot agreed by email");
    await dialog.getByRole("button", { name: "Change plan" }).click();
    await expect(page.getByRole("status")).toContainText("Plan changed to Pro");

    // The account has the plan's own allowance, not the one it had before
    await expect(page.getByText("50 documents a month").first()).toBeVisible();
    await expect(page.getByText("Given by an admin").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Pilot agreed by email" })).toBeVisible();

    // And it is in the record of what admins did, with who and why
    await page.getByRole("link", { name: "Everything admins did on this account" }).click();
    const activity = page.getByRole("table", { name: "Admin activity" });
    await expect(activity).toContainText("changed from Free to Pro");
    await expect(activity).toContainText("Reason: Pilot agreed by email");
    await expect(activity).toContainText(admin.email);

    expect(errors).toEqual([]);
  });

  test("an admin opens a document, sees its audit chain checked, and takes the evidence certificate", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const sent = await seed({ pages: 1 });
    const admin = await signInAdmin(page);

    // A full reload of a deep link: the session lasts for the tab, and the address names the screen
    await page.goto(`${admin.adminUrl}/documents/${sent.pdfId}`);
    await expect(page.getByRole("heading", { name: "rent-agreement.pdf" })).toBeVisible();
    await expect(page.getByText("Out for signature")).toBeVisible();
    await expect(page.getByText(/Audit chain intact\./)).toBeVisible();
    await expect(page.getByRole("cell", { name: new RegExp(sent.signerName) })).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download evidence certificate" }).click();
    expect((await download).suggestedFilename()).toBe(`evidence-certificate-${sent.pdfId}.pdf`);

    // The audit log names each event
    await page.getByRole("link", { name: "Open in the audit log" }).click();
    const log = page.getByRole("table", { name: "Audit log" });
    await expect(log).toContainText("Sent");
    await expect(log).not.toContainText("AUDIT_EVENT");

    // Opening the document and taking the certificate were both recorded
    await section(page, "Admin activity").click();
    const activity = page.getByRole("table", { name: "Admin activity" });
    await expect(activity).toContainText("Downloaded the evidence certificate");
    await expect(activity).toContainText('Opened the details of "rent-agreement.pdf"');

    expect(errors).toEqual([]);
  });

  test("works on a phone-sized screen, with the sections behind a menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signInAdmin(page);

    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    const widthOf = () => page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    const [content, screen] = await widthOf();
    expect(content).toBeLessThanOrEqual(screen);

    await page.getByRole("button", { name: "Menu" }).click();
    await section(page, "Operations").click();
    await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
    const [operations, operationsScreen] = await widthOf();
    expect(operations).toBeLessThanOrEqual(operationsScreen);
  });

  test("someone who is not signed in is sent to sign in, and a wrong key is refused in plain words", async ({ page }) => {
    const admin = await adminAccount();
    await page.goto(`${admin.adminUrl}/users`);
    await page.waitForURL("**/login");

    await page.getByPlaceholder("admin@pactdoc.com").fill(admin.email);
    await page.getByPlaceholder("••••••••••••").fill(admin.password);
    await page.getByPlaceholder("Enter Admin Secret Key").fill("not-the-key");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("alert")).toContainText("The email, password or admin key is not right.");

    // With the right key, the admin lands where they were going
    await page.getByPlaceholder("Enter Admin Secret Key").fill(admin.adminSecret);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/users");
  });
});
