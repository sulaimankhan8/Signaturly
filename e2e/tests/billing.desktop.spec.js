import { test, expect } from "@playwright/test";
import { draft, signIn } from "./helpers.js";

// After paying, the browser is on the page that confirms the payment. It says so, and leads back to Billing.
const backToBilling = async (page, said = "Payment confirmed") => {
  const landed = page.getByTestId("payment-return");
  await expect(landed).toContainText(said);
  await landed.getByRole("link", { name: "Go to Billing" }).click();
  await page.waitForURL("**/billing");
};

// The payments listed on the overview, newest first
const latestPayments = (page) => page.getByTestId("recent-invoices").locator("tbody tr");

// Plan tasks P4-13 to P4-17: prices, extra documents, wallet, invoice details and invoices.
test.describe("plans and billing", () => {
  test("the pricing page shows a visitor the plans in rupees and leads to sign-up and checkout", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /E-signatures priced for/ })).toBeVisible();

    await expect(page.getByTestId("plan-free")).toContainText("5 documents a month");
    await expect(page.getByTestId("plan-pro")).toContainText("50 documents a month");
    await expect(page.getByTestId("comparison")).toContainText("Team workspaces, roles and invitations");
    // Yearly is shown first: every plan sold by the year is shown by the month, with what is
    // charged once a year beside it and the monthly price struck through
    await expect(page.getByRole("button", { name: /Yearly/ })).toContainText("2 months free");
    await expect(page.getByTestId("plan-pro")).toContainText("₹249");
    await expect(page.getByTestId("plan-pro")).toContainText("Billed ₹2,990, once a year");
    await expect(page.getByTestId("plan-business")).toContainText("₹416");
    await expect(page.getByTestId("plan-business")).toContainText("Billed ₹4,990 a seat, once a year");
    await page.getByRole("button", { name: "Monthly" }).click();
    await expect(page.getByTestId("plan-pro")).toContainText("₹299");
    await expect(page.getByTestId("plan-pro")).toContainText("Billed monthly");
    await expect(page.getByTestId("plan-business")).toContainText("₹499");
    // Enterprise is the same card in both views, and asks for a conversation
    await expect(page.getByTestId("plan-enterprise")).toContainText("₹2,499");
    await expect(page.getByTestId("plan-enterprise").getByRole("button", { name: "Contact sales" })).toBeVisible();
    await expect(page.getByTestId("billing-topups")).toContainText("10 extra documents");
    await expect(page.getByTestId("billing-wallet")).toContainText("Signing link by WhatsApp");

    // The plan that is no longer sold, and the old dollar prices, are nowhere on the page
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/lifetime|\$\s?\d/i);

    // An account first, then straight on to checkout for the plan chosen
    await page.getByRole("link", { name: "Get Pro" }).click();
    await page.waitForURL(/\/register\?next=%2Fbilling%2Fcheckout%3Fplan%3Dpro_monthly/);
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
    await expect(page.getByTestId("recent-invoices")).toContainText("No payments yet.");

    // Extra documents: a pack is chosen, then bought in one payment
    await page.goto("/billing/add-ons");
    await page.getByTestId("topup-docs_10").click();
    await page.getByTestId("billing-topups").getByRole("button", { name: /Buy 10 extra documents · ₹79/ }).click();
    // The page that confirms the payment shows what was bought and the receipt for it
    await expect(page.getByTestId("payment-return")).toContainText("10 extra documents");
    await expect(page.getByTestId("payment-return")).toContainText("₹79.00");
    await backToBilling(page);
    await expect(page.getByTestId("billing-extra")).toContainText("10 in hand");

    await page.goto("/billing/add-ons");
    await expect(page.getByTestId("wallet-balance")).toHaveText("₹0.00");
    // The set amounts add up to one amount; nothing is paid until the button below
    const quick = page.getByTestId("wallet-quick");
    await expect(page.getByTestId("wallet-buy")).toBeDisabled();
    await quick.getByRole("button", { name: "Add ₹200 to the amount" }).click();
    await expect(page.getByLabel("Amount to add")).toHaveValue("200");
    await expect(page.getByTestId("wallet-balance")).toHaveText("₹0.00");
    await page.getByTestId("wallet-buy").click();
    await backToBilling(page);
    await page.goto("/billing/add-ons");
    await expect(page.getByTestId("wallet-balance")).toHaveText("₹200.00");
    await expect(page.getByTestId("billing-wallet")).toContainText("Credit added");
    // Neither purchase went through the wallet, and the wallet paid for neither
    await expect(page.getByTestId("billing-topups")).toContainText("no wallet needed");
    await expect(page.getByTestId("billing-wallet")).toContainText("Optional");

    // A GST number in the wrong form is refused; a right one is saved and sets the state
    await page.goto("/billing/invoices");
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
    await expect(invoices.locator("tbody tr")).toHaveCount(2);
    await expect(invoices).toContainText("10 extra documents");
    await expect(invoices).toContainText("₹79.00");
    await expect(invoices).toContainText("₹200.00");

    const download = page.waitForEvent("download");
    await invoices.getByRole("button", { name: /Download/ }).first().click();
    expect((await download).suggestedFilename()).toMatch(/^P[DR]-\d{4}-\d{2}-\d{6}\.pdf$/);

    // Moving to Pro, paid for one month: the plan and the allowance change, and nothing renews
    // Every plan is listed with what it costs; the account's own is marked
    await page.goto("/billing/plans");
    await expect(page.getByTestId("plan-free")).toContainText("Your plan");
    await expect(page.getByTestId("plan-pro")).toContainText("₹299");
    await page.getByRole("button", { name: "Upgrade to Pro" }).click();
    await page.waitForURL(/\/billing\/checkout\?plan=pro_monthly/);
    const checkout = page.getByTestId("plan-checkout");
    // Auto-renew is the choice made for the customer; paying once is one click away
    await expect(checkout.getByLabel(/^Auto-renew/)).toBeChecked();
    await checkout.getByLabel(/^Pay once: one month/).check();
    await expect(checkout.getByTestId("checkout-summary")).toContainText("Nothing after that.");
    await checkout.getByRole("button", { name: "Pay ₹299", exact: true }).click();
    await backToBilling(page);
    await expect(page.getByTestId("billing-plan")).toContainText("Pro");
    await expect(page.getByTestId("billing-usage")).toContainText("0 of 50");
    await expect(page.getByTestId("billing-renewal")).toContainText("It will not renew by itself.");
    await expect(latestPayments(page)).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("a sender pays for a month, adds another, then lets the plan renew by itself and turns that off", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());

    const account = await draft({ pages: 1 });
    await signIn(page, account);
    // An old link to buy a plan still works: it lands on checkout for that plan
    await page.goto("/billing?plan=pro_monthly");
    await page.waitForURL(/\/billing\/checkout\?plan=pro_monthly/);
    const checkout = page.getByTestId("plan-checkout");
    await expect(checkout).toContainText("Get Pro");
    await checkout.getByLabel(/^Pay once: one month/).check();
    await checkout.getByRole("button", { name: "Pay ₹299", exact: true }).click();
    await backToBilling(page);

    const renewal = page.getByTestId("billing-renewal");
    const hero = page.getByTestId("billing-plan");
    await expect(renewal).toContainText("It will not renew by itself.");
    await expect(latestPayments(page)).toHaveCount(1);
    const firstEnd = await renewal.innerText();

    // A second month is added after the first; the days left are not lost
    await hero.getByRole("button", { name: /Add another month · ₹299/ }).click();
    await expect(checkout).toContainText("is added after");
    await checkout.getByRole("button", { name: "Pay ₹299", exact: true }).click();
    await backToBilling(page);
    await expect(latestPayments(page)).toHaveCount(2);
    await expect(renewal).not.toHaveText(firstEnd);

    // Turning auto-renew on charges nothing today: the first charge waits for the paid time to end
    await hero.getByRole("button", { name: "Turn on auto-renew" }).click();
    await expect(checkout).toContainText("Nothing is charged today.");
    await checkout.getByRole("button", { name: "Turn on auto-renew" }).click();
    // Nothing is charged today, and the page says that instead
    await backToBilling(page, "Auto-renew is on");
    await expect(renewal).toContainText("Renews automatically on");
    await expect(renewal).toContainText("₹299");
    await expect(latestPayments(page)).toHaveCount(2);

    // The next automatic charge moves the date on and brings its own invoice
    await page.getByRole("button", { name: /Simulate the next charge/ }).click();
    await expect(latestPayments(page)).toHaveCount(3);

    // Turned off, the plan stays until the date and nothing more is charged
    await hero.getByRole("button", { name: "Turn off auto-renew" }).click();
    await expect(renewal).toContainText("It will not renew by itself.");
    await expect(hero).toContainText("Pro");
    expect(errors).toEqual([]);
  });

  test("a sender on Free subscribes to a plan, with a top-up added at checkout", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/billing/plans");

    // One button for each plan; auto-renew or once is chosen at checkout, and auto-renew is chosen to begin with
    await page.getByRole("button", { name: "Upgrade to Pro" }).click();
    const checkout = page.getByTestId("plan-checkout");
    await expect(checkout.getByLabel(/^Auto-renew/)).toBeChecked();
    await expect(checkout.getByLabel(/^Pay once: one month/)).not.toBeChecked();

    // A top-up added to the same payment: one charge today, the plan alone after that
    await checkout.getByTestId("checkout-addons").getByRole("button", { name: /\+10 documents · ₹79/ }).click();
    await expect(checkout.getByTestId("checkout-summary")).toContainText("₹378");
    await expect(checkout.getByTestId("checkout-summary")).toContainText("Then ₹299 every month");
    await checkout.getByRole("button", { name: "Pay ₹378 and subscribe" }).click();
    await expect(page.getByTestId("payment-return")).toContainText("with 10 extra documents");
    await backToBilling(page);

    await expect(page.getByTestId("billing-plan")).toContainText("Pro");
    await expect(page.getByTestId("billing-renewal")).toContainText("Renews automatically on");
    await expect(page.getByTestId("billing-renewal")).toContainText("₹299");
    await expect(page.getByTestId("billing-extra")).toContainText("10 in hand");
    // One payment, one invoice, naming both
    await expect(latestPayments(page)).toHaveCount(1);
    await expect(page.getByTestId("recent-invoices")).toContainText("with 10 extra documents");
    await expect(page.getByTestId("recent-invoices")).toContainText("₹378.00");
    // A plan that renews is not also sold by the single month
    await expect(page.getByRole("button", { name: /Add another month/ })).toHaveCount(0);
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

    // The same screen says what can be done: add documents with one payment, or move to a bigger plan
    const prompt = page.getByTestId("out-of-documents");
    await expect(prompt).toContainText("You have used this month's documents");
    await expect(prompt).toContainText("all 5 documents your plan allows this month");
    await expect(prompt.getByRole("button", { name: /Move to Pro/ })).toBeVisible();
    await prompt.getByRole("button", { name: /10 extra documents, one payment/ }).click();
    await expect(prompt).toHaveCount(0);

    // Nothing was lost: the answers are still there, and the document goes at the second try
    await page.getByRole("button", { name: "Send for signature" }).click();
    await page.waitForURL("**/dashboard");

    // One of the ten was used, and the wallet was never involved
    await page.goto("/billing");
    await expect(page.getByTestId("billing-extra")).toContainText("9 in hand");
    await expect(page.getByTestId("overview-wallet")).toContainText("₹0.00");
  });
});
