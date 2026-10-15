import { test, expect } from "@playwright/test";
import { seed, recipientState, otpFor, en, hi, fill, flatten, pageCanvas, fitsScreen, drawWithFinger, inkOn } from "./helpers.js";

// Plan task P3-13: signing works on a 360-pixel-wide phone, by touch.
test.describe("signing on a phone", () => {
  test("a signer fills, draws with a finger and signs without the page ever being wider than the screen", async ({ page }) => {
    const doc = await seed({ pages: 2 });
    await page.goto(doc.signUrl);

    // The page is drawn to fit the screen
    await expect(pageCanvas(page)).toBeVisible();
    const canvasBox = await pageCanvas(page).boundingBox();
    expect(canvasBox.width).toBeLessThanOrEqual(360);
    expect(canvasBox.width).toBeGreaterThan(300);
    expect(await fitsScreen(page)).toBe(true);

    // The action bar is on screen, and the desktop-only controls are not
    const bar = page.getByTestId("mobile-action-bar");
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(740);
    await expect(page.getByRole("button", { name: en.actions.sign })).toHaveCount(0);

    // Every button in the bar is big enough for a thumb
    for (const button of await bar.getByRole("button").all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }

    // A field cannot be dragged away from where the sender put it
    const textField = page.getByTestId("field-text");
    const before = await textField.boundingBox();
    await page.mouse.move(before.x + 10, before.y + 10);
    await page.mouse.down();
    await page.mouse.move(before.x + 90, before.y + 120, { steps: 5 });
    await page.mouse.up();
    const after = await textField.boundingBox();
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);

    // Type into the text field, right on the page
    await textField.locator("input").fill("Pune");
    await textField.locator("input").blur();
    await expect(textField.locator("input")).toHaveValue("Pune");

    // The date field shows the date of signing, with the month as a word, and cannot be changed
    await expect(page.getByTestId("field-date")).toHaveText(/^\d{2} [A-Z][a-z]{2,3} \d{4}$/);
    await expect(page.getByTestId("field-date").locator("input")).toHaveCount(0);

    // "Next field" takes the signer to the signature on page 2
    await bar.getByRole("button", { name: fill(en.nav.next, { count: 1 }) }).tap();
    await expect(page.getByText(fill(en.pager.page, { current: 2, total: 2 }))).toBeVisible();
    await expect(pageCanvas(page)).toBeVisible();

    // Tapping the signature field opens the signature sheet; draw with a finger
    await page.getByTestId("field-signature").getByRole("button").tap();
    await page.getByRole("tab", { name: en.sig.tabDraw, exact: true }).tap();
    const pad = page.locator("canvas.touch-none");
    await expect(pad).toBeVisible();
    expect(await inkOn(pad)).toBe(0);
    await drawWithFinger(page, pad);
    expect(await inkOn(pad)).toBeGreaterThan(200);
    expect(await fitsScreen(page)).toBe(true);

    await page.getByRole("button", { name: en.pad.attach }).tap();
    await expect(page.getByTestId("field-signature").locator("img")).toBeVisible();

    // Signing without consent is refused, in words
    const signButton = bar.getByRole("button", { name: en.actions.sign });
    await signButton.tap();
    await expect(page.getByText(en.consent.required)).toBeVisible();
    expect((await recipientState(doc.token)).status).not.toBe("signed");

    await page.getByRole("checkbox").check();
    await signButton.tap();

    await expect(page.getByRole("heading", { name: en.completed.title })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: en.completed.download })).toBeVisible();
    // The sender is on the Free plan, so the finished page carries the line and the invitation
    await expect(page.getByTestId("signed-with-badge")).toContainText(en.completed.badge);
    await expect(page.getByRole("link", { name: en.completed.inviteLink })).toHaveAttribute("href", "/register");
    expect(await fitsScreen(page)).toBe(true);

    expect(await recipientState(doc.token)).toMatchObject({ status: "signed", consent: true });
  });

  // Plan task P3-03: a signer who reads Hindi is shown Hindi from the first screen to the last.
  test("a Hindi signer passes the identity check and signs with every screen in Hindi", async ({ page }) => {
    const doc = await seed({ language: "hi", authType: "otp", pages: 1, signerName: "आशा राव" });
    await page.goto(doc.signUrl);

    // Identity check, in Hindi
    await expect(page.getByRole("heading", { name: hi.verify.titleOtp })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await page.getByRole("button", { name: hi.verify.request }).tap();
    await expect(page.getByText(hi.verify.sent.split("{{")[0].trim())).toBeVisible();

    const code = await otpFor(doc.signerEmail);
    expect(code).toMatch(/^\d{6}$/);
    await page.getByPlaceholder("000000").fill(code);
    await page.getByRole("button", { name: hi.verify.submit }).tap();

    // The document opens, still in Hindi
    await expect(pageCanvas(page)).toBeVisible();
    const bar = page.getByTestId("mobile-action-bar");
    await expect(page.getByText(hi.consent.text)).toBeVisible();
    await expect(page.getByRole("button", { name: hi.actions.decline })).toBeVisible();
    expect(await fitsScreen(page)).toBe(true);

    // No English wording is left anywhere on the screen, here or in the signature sheet
    const englishOnly = flatten(en).filter((text) => !text.includes("{{") && text.length >= 6 && !flatten(hi).includes(text));
    const expectNoEnglish = async () => {
      const shown = await page.locator("body").innerText();
      expect(englishOnly.filter((text) => shown.includes(text))).toEqual([]);
    };
    await expectNoEnglish();

    await page.getByTestId("field-text").locator("input").fill("पुणे");
    await page.getByTestId("field-text").locator("input").blur();

    await page.getByTestId("field-signature").getByRole("button").tap();
    await expect(page.getByRole("heading", { name: hi.sidebar.studioTitle })).toBeVisible();
    await expectNoEnglish();

    await page.getByRole("tab", { name: hi.sig.tabDraw, exact: true }).tap();
    await expectNoEnglish();
    await drawWithFinger(page, page.locator("canvas.touch-none"));
    await page.getByRole("button", { name: hi.pad.attach }).tap();

    await page.getByRole("checkbox").check();
    await bar.getByRole("button", { name: hi.actions.sign }).tap();

    await expect(page.getByRole("heading", { name: hi.completed.title })).toBeVisible({ timeout: 30_000 });
    await expectNoEnglish();
    expect(await recipientState(doc.token)).toMatchObject({ status: "signed", consent: true, authVerified: true });
  });

  test("the signer can switch the page to another language and back", async ({ page }) => {
    const doc = await seed({ language: "hi", pages: 1 });
    await page.goto(doc.signUrl);

    await expect(page.getByText(hi.consent.text)).toBeVisible();
    await page.getByRole("combobox", { name: hi.header.language }).selectOption("en");
    await expect(page.getByText(en.consent.text)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("combobox", { name: en.header.language }).selectOption("hi");
    await expect(page.getByText(hi.consent.text)).toBeVisible();
  });

  test("a long scanned document shows its first page over a slow connection before the whole file has arrived", async ({ page }) => {
    const doc = await seed({ pages: 12, scanned: true });
    expect(doc.fileBytes).toBeGreaterThan(600_000);

    // Roughly a weak 3G signal: 400 kbit/s down, 300 ms delay
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (150 * 1024) / 8,
    });

    const pieces = [];
    page.on("response", (response) => {
      if (response.url().includes("/uploads/")) pieces.push({ status: response.status(), range: response.headers()["content-range"] || "" });
    });

    const started = Date.now();
    await page.goto(doc.signUrl);
    await expect(pageCanvas(page)).toBeVisible({ timeout: 60_000 });
    const seconds = (Date.now() - started) / 1000;

    // The file was asked for in pieces
    const partial = pieces.filter((piece) => piece.status === 206);
    expect(partial.length).toBeGreaterThan(0);

    // And what had been asked for by the time page 1 appeared is less than the whole file
    const asked = partial.reduce((sum, piece) => {
      const match = /bytes (\d+)-(\d+)\//.exec(piece.range);
      return match ? sum + (Number(match[2]) - Number(match[1]) + 1) : sum;
    }, 0);
    expect(asked).toBeLessThan(doc.fileBytes * 0.6);

    // At this speed the whole file alone would take this long to arrive
    const wholeFileSeconds = doc.fileBytes / ((400 * 1024) / 8);
    test.info().annotations.push({
      type: "timing",
      description: `first page after ${seconds.toFixed(1)}s; file is ${(doc.fileBytes / 1024).toFixed(0)} KB (${wholeFileSeconds.toFixed(1)}s to fetch whole); ${(asked / 1024).toFixed(0)} KB asked for by then`,
    });
    console.log(test.info().annotations.at(-1).description);
  });
});
