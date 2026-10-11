import { test, expect } from "@playwright/test";
import { adminAccount, draft, signIn } from "./helpers.js";

// Plan task P4-05: a template is created, edited, published and reviewed from the admin panel,
// with no deploy, and senders then get it.
test.describe("template admin", () => {
  test("an admin creates a template, publishes it and records its review; a sender then uses it", async ({ page, browser, baseURL }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const admin = await adminAccount();
    const key = `visitor-declaration-${Date.now()}`;

    // Sign in to the admin app
    await page.goto(`${admin.adminUrl}/login`);
    await page.getByPlaceholder("admin@pactdoc.com").fill(admin.email);
    await page.getByPlaceholder("••••••••••••").fill(admin.password);
    await page.getByPlaceholder("Enter Admin Secret Key").fill(admin.adminSecret);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard");

    await page.getByRole("button", { name: "Manage templates" }).click();
    await page.waitForURL("**/templates");

    // The templates that ship with the product are listed, marked as not reviewed
    const list = page.getByRole("navigation", { name: "Templates" });
    await expect(list.getByRole("button", { name: /11-Month Rent Agreement/ })).toContainText("not reviewed");

    // A published version cannot be edited in place
    await list.getByRole("button", { name: /Mutual Non-Disclosure Agreement.*mutual-nda/s }).click();
    await expect(page.getByText(/Published: its wording cannot be changed/)).toBeVisible();
    await expect(page.getByLabel("Text", { exact: true })).toBeDisabled();

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
    await text.fill(good);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved.");

    // Read it as a PDF before publishing
    await page.getByRole("button", { name: "Make preview" }).click();
    await expect(page.getByRole("link", { name: "Open preview (1 page)" })).toBeVisible();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
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
