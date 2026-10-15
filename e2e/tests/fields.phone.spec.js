import { test, expect } from "@playwright/test";
import { seed, recipientState, en } from "./helpers.js";

const box = (y) => ({ page: 1, xPercent: 0.12, yPercent: y, widthPercent: 0.06, heightPercent: 0.04 });

// Signs with a typed signature from the phone's signature sheet
const typeSignature = async (page, name) => {
  await page.getByTestId("field-signature").getByRole("button").tap();
  await page.getByRole("tab", { name: en.sig.tabType, exact: true }).tap();
  await page.getByPlaceholder(en.typed.placeholder).fill(name);
  await page.getByRole("button", { name: en.typed.use }).tap();
};

test.describe("fields on a phone", () => {
  test("an optional checkbox never stands in the way of signing", async ({ page }) => {
    const doc = await seed({
      pages: 1,
      fields: [
        { id: "signature", type: "signature", page: 1, xPercent: 0.12, yPercent: 0.6, widthPercent: 0.45, heightPercent: 0.1, required: true },
        { id: "updates", type: "checkbox", label: "Send me updates", ...box(0.3) },
      ],
    });
    await page.goto(doc.signUrl);
    await typeSignature(page, doc.signerName);

    // Everything required is done, so the bar offers to sign, though the box is still empty
    const bar = page.getByTestId("mobile-action-bar");
    const signButton = bar.getByRole("button", { name: en.actions.sign });
    await expect(signButton).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Send me updates/ })).not.toBeChecked();

    await page.locator("#electronic-consent-checkbox").check();
    await signButton.tap();
    await expect(page.getByRole("heading", { name: en.completed.title })).toBeVisible({ timeout: 30_000 });
    expect((await recipientState(doc.token)).status).toBe("signed");
  });

  test("a radio question takes one answer", async ({ page }) => {
    const doc = await seed({
      pages: 1,
      fields: [
        { id: "signature", type: "signature", page: 1, xPercent: 0.12, yPercent: 0.6, widthPercent: 0.45, heightPercent: 0.1, required: true },
        { id: "yes", type: "radio", groupId: "agree", label: "Yes", required: true, ...box(0.3) },
        { id: "no", type: "radio", groupId: "agree", label: "No", required: true, ...box(0.36) },
      ],
    });
    await page.goto(doc.signUrl);
    await typeSignature(page, doc.signerName);

    // The question is still open, so the bar points to it rather than offering to sign
    const bar = page.getByTestId("mobile-action-bar");
    await expect(bar.getByRole("button", { name: en.actions.sign })).toHaveCount(0);

    const yes = page.getByRole("radio", { name: /^Yes/ });
    const no = page.getByRole("radio", { name: /^No/ });
    await yes.tap();
    await no.tap();
    await expect(no).toHaveAttribute("aria-checked", "true");
    await expect(yes).toHaveAttribute("aria-checked", "false");

    await page.locator("#electronic-consent-checkbox").check();
    await bar.getByRole("button", { name: en.actions.sign }).tap();
    await expect(page.getByRole("heading", { name: en.completed.title })).toBeVisible({ timeout: 30_000 });
  });
});
