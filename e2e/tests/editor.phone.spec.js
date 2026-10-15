import { test, expect } from "@playwright/test";
import { draft, signIn, pageCanvas, fitsScreen } from "./helpers.js";

// The editor on a 360-pixel phone: the page fills the screen, the fields are in a drawer, and
// a field is placed with a tap on its type and a tap on the page
test.describe("the document editor on a phone", () => {
  test("a field is added from the drawer with two taps, and its settings open from below", async ({ page }) => {
    const doc = await draft({ pages: 1 });
    await signIn(page, doc);
    await page.goto(`/editor/${doc.pdfId}`);
    await expect(pageCanvas(page)).toBeVisible();
    expect(await fitsScreen(page)).toBe(true);

    await page.getByRole("button", { name: "Add field" }).tap();
    await page.getByRole("button", { name: /^Text/ }).first().tap();
    // The drawer gets out of the way so the page can be tapped
    await expect(page.getByRole("button", { name: "Add field" })).toBeVisible();

    await page.locator('[data-document-page="1"]').tap({ position: { x: 120, y: 160 } });
    await expect(page.getByTestId("field-text")).toBeVisible();

    // The new field is picked, and its settings sheet is on screen
    await expect(page.getByRole("complementary", { name: "Field settings" })).toBeVisible();
    expect(await fitsScreen(page)).toBe(true);
  });
});
