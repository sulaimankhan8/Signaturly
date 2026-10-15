import { test, expect } from "@playwright/test";
import { draft, seed, signIn, recipientsOf, en, fill, pageCanvas } from "./helpers.js";

test.describe("the document editor", () => {
  test("fields can be placed, nudged and undone from the keyboard", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const doc = await draft({ pages: 1 });
    await signIn(page, doc);
    await page.goto(`/editor/${doc.pdfId}`);
    await expect(pageCanvas(page)).toBeVisible();

    // Enter on a field type puts it in the middle of the page on screen, and focuses it
    await page.getByRole("button", { name: /^Text/ }).first().focus();
    await page.keyboard.press("Enter");
    const field = page.getByTestId("field-text");
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();

    // Shift+arrow moves it ten points at a time
    const before = await field.boundingBox();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const after = await field.boundingBox();
    expect(after.x).toBeGreaterThan(before.x + 5);
    expect(after.y).toBeGreaterThan(before.y + 5);

    // Undo takes back the move, then the field; redo brings the field back
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect(field).toHaveCount(0);
    await page.keyboard.press("Control+Shift+z");
    await expect(field).toBeVisible();

    // Delete removes the selected field, and typing in a box elsewhere never does
    await field.focus();
    await page.getByRole("textbox", { name: "Label" }).fill("City");
    await page.getByRole("textbox", { name: "Label" }).press("Backspace");
    await expect(field).toBeVisible();
    await field.focus();
    await page.keyboard.press("Delete");
    await expect(field).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a sender who also signs reviews, sees the document as the signer, sends and signs at once", async ({ page }) => {
    const doc = await draft({ pages: 1 });
    await signIn(page, doc);

    // Me & others: the sender is put on the list for themselves
    await page.goto(`/send/${doc.pdfId}?me=1`);
    await expect(page.getByPlaceholder("e.g. John Doe").first()).toHaveValue("Meera Sharma");
    await page.getByRole("button", { name: /Next: Place Form Fields/ }).click();
    await page.waitForURL(`**/assign/${doc.pdfId}`);

    await expect(pageCanvas(page)).toBeVisible();
    // The review step is refused while the only signer has nowhere to sign
    await page.getByRole("button", { name: /^Full name/ }).first().click();
    await page.locator('[data-document-page="1"]').click({ position: { x: 200, y: 300 } });
    await page.getByRole("button", { name: /Next: Review/ }).click();
    await expect(page.getByText(/has no signature field/)).toBeVisible();

    await page.getByRole("button", { name: /^Signature/ }).first().click();
    await page.locator('[data-document-page="1"]').click({ position: { x: 200, y: 500 } });
    await expect(page.getByTestId("field-signature")).toBeVisible();
    await page.getByRole("button", { name: /Next: Review/ }).click();
    await page.waitForURL(`**/review/${doc.pdfId}`);

    // What the signer will see: their own field, nothing to fill in yet
    await page.getByRole("button", { name: /See it as Meera/ }).click();
    const preview = page.getByRole("dialog", { name: /What Meera Sharma will see/ });
    await expect(preview.getByTestId("field-signature")).toBeVisible();
    await preview.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: /Send for Signing/ }).click();
    await expect(page.getByRole("dialog", { name: /your turn to sign/ })).toBeVisible();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.waitForURL("**/sign/**");
    // Their full name and their signature
    await expect(page.getByText(fill(en.sidebar.fieldsTitle, { count: 2 }))).toBeVisible();

    const [me] = await recipientsOf(doc.pdfId);
    expect(me).toMatchObject({ name: "Meera Sharma", email: doc.ownerEmail });
  });
});

test.describe("the document editor with a mouse", () => {
  test("fields are dragged in, carried to another page, resized, duplicated, lined up and pasted", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const doc = await draft({ pages: 2 });
    await signIn(page, doc);
    await page.goto(`/editor/${doc.pdfId}`);
    await expect(pageCanvas(page)).toBeVisible();

    // Zoomed out far enough that both pages are on screen
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.getByRole("button", { name: /^Zoom 50%/ })).toBeVisible();

    const pageOne = page.locator('[data-document-page="1"]');
    const pageTwo = page.locator('[data-document-page="2"]');
    const centre = async (locator, dx = 0, dy = 0) => {
      const box = await locator.boundingBox();
      return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
    };
    const drag = async (from, to) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.mouse.up();
    };

    // Dragged from the palette onto page 1
    await drag(await centre(page.getByRole("button", { name: /^Signature/ }).first()), await centre(pageOne, 0, -60));
    await expect(pageOne.getByTestId("field-signature")).toHaveCount(1);

    // Carried onto page 2
    const field = page.getByTestId("field-signature").first();
    await drag(await centre(field), await centre(pageTwo, 0, -60));
    await expect(pageTwo.getByTestId("field-signature")).toHaveCount(1);
    await expect(pageOne.getByTestId("field-signature")).toHaveCount(0);

    // Made wider from its bottom-right corner
    const before = await field.boundingBox();
    const corner = field.locator('span[aria-hidden="true"]').last();
    await drag(await centre(corner), await centre(corner, 50, 10));
    expect((await field.boundingBox()).width).toBeGreaterThan(before.width + 30);

    // Duplicated, then the two are lined up on their left edges
    await field.focus();
    await page.keyboard.press("Control+d");
    const both = pageTwo.getByTestId("field-signature");
    await expect(both).toHaveCount(2);
    // The copy lands just below and to the right; move it clear of the original
    await drag(await centre(both.nth(1)), await centre(both.nth(1), 30, 90));
    await both.nth(0).click();
    await both.nth(1).click({ modifiers: ["Shift"] });
    await expect(page.getByText("2 fields selected")).toBeVisible();
    await page.getByRole("button", { name: "Align left edges" }).click();
    const [a, b] = [await both.nth(0).boundingBox(), await both.nth(1).boundingBox()];
    expect(Math.abs(a.x - b.x)).toBeLessThan(1.5);

    // Copied, and pasted onto the page picked in the thumbnails
    await both.nth(0).click();
    await page.keyboard.press("Control+c");
    await page.getByRole("button", { name: /^Go to page 1/ }).click();
    await expect(page.getByText("Page 1 / 2")).toBeVisible();
    await page.keyboard.press("Control+v");
    await expect(pageOne.getByTestId("field-signature")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe("signing with the keyboard alone", () => {
  test("a signer fills, signs and finishes without a mouse", async ({ page }) => {
    const doc = await seed({ pages: 1 });
    await page.goto(doc.signUrl);
    await expect(pageCanvas(page)).toBeVisible();

    // Start takes the signer to the first field still needed, ready to type into
    await page.getByRole("button", { name: en.nav.start }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("field-text").locator("input")).toBeFocused();
    await page.keyboard.type("Chennai");

    // Next goes on to the signature, whose button opens the signature dialog
    await page.getByRole("button", { name: fill(en.nav.next, { count: 1 }) }).focus();
    await page.keyboard.press("Enter");
    const signatureButton = page.getByTestId("field-signature").getByRole("button");
    await expect(signatureButton).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(en.typed.placeholder).fill(doc.signerName);
    await dialog.getByRole("button", { name: en.typed.use }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);

    await page.locator("#electronic-consent-checkbox").focus();
    await page.keyboard.press("Space");
    await page.getByRole("banner").getByRole("button", { name: en.actions.sign }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: en.completed.title })).toBeVisible({ timeout: 30_000 });
  });
});
