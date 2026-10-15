import { test, expect } from "@playwright/test";
import { seed, recipientState, en, fill, pageCanvas } from "./helpers.js";

test.describe("signing on a desktop", () => {
  test("a signer types a signature and signs from the header", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const doc = await seed({ pages: 2 });
    await page.goto(doc.signUrl);
    await expect(pageCanvas(page)).toBeVisible();

    // The phone action bar is not shown on a wide screen; the side panel is
    await expect(page.getByTestId("mobile-action-bar")).toBeHidden();
    await expect(page.getByRole("heading", { name: en.sidebar.studioTitle })).toBeVisible();
    await expect(page.getByText(fill(en.sidebar.fieldsTitle, { count: 3 }))).toBeVisible();

    // Fields are filled in right on the page
    await page.getByTestId("field-text").locator("input").fill("Mumbai");
    await page.getByTestId("field-text").locator("input").blur();

    // The signature field opens the signature dialog; type a signature there
    await page.getByTestId("field-signature").getByRole("button").click();
    await page.getByRole("tab", { name: en.sig.tabType, exact: true }).click();
    await page.getByPlaceholder(en.typed.placeholder).fill(doc.signerName);
    await page.getByRole("button", { name: en.typed.use }).click();

    // It is placed in the signature field on page 2, which opening the dialog scrolled to
    await expect(page.getByTestId("field-signature").locator("img")).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("banner").getByRole("button", { name: en.actions.sign }).click();

    await expect(page.getByRole("heading", { name: en.completed.title })).toBeVisible({ timeout: 30_000 });
    expect(await recipientState(doc.token)).toMatchObject({ status: "signed", consent: true });
    expect(errors).toEqual([]);
  });

  test("a signer can decline, with a reason", async ({ page }) => {
    const doc = await seed({ pages: 1 });
    await page.goto(doc.signUrl);
    await expect(pageCanvas(page)).toBeVisible();

    await page.getByRole("button", { name: en.actions.decline }).click();
    await page.getByRole("button", { name: en.actions.confirmDecline }).click();
    await expect(page.getByText(en.toast.declineReason)).toBeVisible();

    await page.getByPlaceholder(en.declineModal.placeholder).fill("The rent amount is wrong");
    await page.getByRole("button", { name: en.actions.confirmDecline }).click();

    await expect(page.getByRole("heading", { name: en.declined.title })).toBeVisible();
    expect((await recipientState(doc.token)).status).toBe("declined");
  });

  test("a link that is not valid says so and shows no document", async ({ page }) => {
    await page.goto("/sign/not-a-real-link");
    await expect(page.getByRole("heading", { name: en.error.title })).toBeVisible();
    await expect(page.locator(".react-pdf__Page__canvas")).toHaveCount(0);
  });
});
