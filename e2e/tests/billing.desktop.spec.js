import { test, expect } from "@playwright/test";
import { draft, signIn } from "./helpers.js";

// Plan tasks P4-13 to P4-17: prices, extra documents, wallet, invoice details and invoices.
test.describe("plans and billing", () => {
  test("the pricing page shows the plans in rupees and leads to sign-up", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /Choose the Perfect Plan/ })).toBeVisible();

    await expect(page.getByTestId("plan-free")).toContainText("5 documents a month");
    await expect(page.getByTestId("plan-pro")).toContainText("₹299");
    await expect(page.getByTestId("plan-pro")).toContainText("50 documents a month");
    await expect(page.getByTestId("plan-business")).toContainText("₹499");
    await expect(page.getByTestId("plan-enterprise")).toContainText("₹2,499");
    await expect(page.getByTestId("comparison")).toContainText("Team workspaces, roles and invitations");
    // A year costs ten months: the toggle says what that saves
    await page.getByRole("button", { name: /Annual/ }).click();
    await expect(page.getByRole("button", { name: /Annual/ })).toContainText("SAVE 17%");
    await expect(page.getByTestId("plan-pro")).toContainText("₹2,990");
    await expect(page.getByTestId("topups")).toContainText("10 extra documents");

    // The plan that is no longer sold, and the old dollar prices, are nowhere on the page
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/lifetime|\$\s?\d/i);

    await page.getByRole("link", { name: "Get Pro" }).click();
    await page.waitForURL(/\/register\?next=%2Fbilling/);
  });

  test("a sender buys extra documents and wallet credit, adds a GST number, and finds the invoices", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // No payment provider is set up in the test stack, so each purchase asks to be simulated
    page.on("dialog", (dialog) => dialog.accept());

    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/billing");

    await expect(page.getByTestId("billing-plan")).toContainText("Free");
    await expect(page.getByTestId("billing-usage")).toContainText("0 of 5");
    await expect(page.getByTestId("billing-invoices")).toContainText("No payments yet.");

    await page.getByTestId("billing-topups").getByRole("button", { name: /10 extra documents/ }).click();
    await expect(page.getByTestId("billing-usage")).toContainText("10 extra documents in hand");

    await expect(page.getByTestId("wallet-balance")).toHaveText("₹0.00");
    await page.getByRole("button", { name: "Add ₹200" }).click();
    await expect(page.getByTestId("wallet-balance")).toHaveText("₹200.00");
    await expect(page.getByTestId("billing-wallet")).toContainText("Credit added");

    // A GST number in the wrong form is refused; a right one is saved and sets the state
    await page.getByPlaceholder("27ABCDE1234F1Z5").fill("NOT-A-NUMBER");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText(/GST number is not in the right form/)).toBeVisible();
    await page.getByPlaceholder("27ABCDE1234F1Z5").fill("29abcde1234f1z5");
    await page.getByLabel("Name on the invoice").fill("Rao Exports");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Invoice details saved.")).toBeVisible();
    await expect(page.getByLabel("State")).toHaveValue("29");

    // Both purchases have an invoice that can be downloaded
    const invoices = page.getByTestId("billing-invoices");
    await expect(invoices.getByRole("listitem")).toHaveCount(2);
    await expect(invoices).toContainText("10 extra documents");
    await expect(invoices).toContainText("₹79.00");
    await expect(invoices).toContainText("₹200.00");

    const download = page.waitForEvent("download");
    await invoices.getByRole("button", { name: /Download/ }).first().click();
    expect((await download).suggestedFilename()).toMatch(/^P[DR]-\d{4}-\d{2}-\d{6}\.pdf$/);

    // Moving to Pro changes the plan and the allowance
    await page.getByRole("button", { name: /Get Pro for ₹299 a month/ }).click();
    await expect(page.getByTestId("billing-plan")).toContainText("Pro");
    await expect(page.getByTestId("billing-usage")).toContainText("0 of 50");
    await expect(invoices.getByRole("listitem")).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("a sender who has used the month's allowance is told so, and can go on after a top-up", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const account = await draft({ pages: 1, usedThisMonth: 5 });
    await signIn(page, account);

    await page.goto("/templates/fill/consent-form");
    await page.getByLabel("Who is asking for consent? (person or organisation)").fill("Lakeview Clinic");
    await page.getByLabel("Full name of the person giving consent").fill("Asha Rao");
    await page.getByLabel("What are they consenting to?").fill("Sharing my test reports with my family doctor.");
    await page.getByRole("button", { name: "Next: who signs" }).click();
    await page.getByLabel("Person giving consent: email").fill("asha@example.test");
    await page.getByRole("button", { name: "Send for signature" }).click();
    await expect(page.getByText(/quota exceeded.*buy extra documents/i)).toBeVisible();

    await page.goto("/billing");
    await page.getByTestId("billing-topups").getByRole("button", { name: /10 extra documents/ }).click();
    await expect(page.getByTestId("billing-usage")).toContainText("10 extra documents in hand");

    // The draft was kept, so the document can be sent straight away
    await page.goto("/templates/fill/consent-form");
    await expect(page.getByText("Draft restored")).toBeVisible();
    await page.getByRole("button", { name: "Next: who signs" }).click();
    await page.getByRole("button", { name: "Send for signature" }).click();
    await page.waitForURL("**/dashboard");
  });
});
