import { test, expect } from "@playwright/test";

// Plan task P3-14: a public page read without running any script still holds its content.
const PAGES = [
  { path: "/", text: "Sign Agreements", title: /PactDoc/ },
  // The price itself is in the page, not only the heading (plan task P4-17)
  { path: "/pricing", text: "₹299", title: /Pricing/ },
  { path: "/verify", text: "Verify Document", title: /Verify/ },
  { path: "/userguide", text: "User Flow Manual", title: /guide/i },
  // Plan task P4-08: the template library and one page per template
  { path: "/t", text: "Mutual Non-Disclosure Agreement", title: /templates/i },
  { path: "/t/rent-agreement-11-month", text: "Monthly rent, in rupees", title: /Rent Agreement.*template/ },
];

test.describe("public pages", () => {
  for (const { path, text, title } of PAGES) {
    test(`${path} can be read with scripts turned off`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(path);

      await expect(page.locator("#root")).toContainText(text);
      await expect(page).toHaveTitle(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path === "/" ? "/" : path}$`));
      expect((await page.locator('meta[name="description"]').getAttribute("content")).length).toBeGreaterThan(40);
      await context.close();
    });

    test(`${path} keeps its content on screen while the app takes over`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // Record whether the page was ever blank or showed the loading spinner after first paint
      await page.addInitScript(() => {
        window.__emptied = false;
        const watch = () => {
          const root = document.getElementById("root");
          if (!root) return;
          new MutationObserver(() => {
            if (root.innerText.trim().length < 50) window.__emptied = true;
          }).observe(root, { childList: true, subtree: true });
        };
        if (document.getElementById("root")) watch();
        else document.addEventListener("DOMContentLoaded", watch);
      });

      await page.goto(path);
      await expect(page.locator("#root")).toContainText(text);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#root")).toContainText(text);

      expect(await page.evaluate(() => window.__emptied)).toBe(false);
      expect(errors).toEqual([]);
    });
  }

  test("a private route starts from the empty shell, not from the landing page", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/sign/some-token");
    expect((await page.locator("#root").innerText()).trim()).toBe("");
    await context.close();
  });

  test("the sitemap lists the public pages and the template pages, and nothing private", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const listed = [...xml.matchAll(/<loc>[^<]*?(\/[^<]*)?<\/loc>/g)].map((m) => new URL(m[0].replace(/<\/?loc>/g, "")).pathname);

    for (const { path } of PAGES) expect(listed).toContain(path);
    expect(listed.filter((path) => path.startsWith("/t/")).length).toBeGreaterThanOrEqual(21);
    expect(listed.filter((path) => !path.startsWith("/t/")).sort()).toEqual(PAGES.map((p) => p.path).filter((path) => !path.startsWith("/t/")).sort());
  });

  test("a template page says what it is for, who signs, and what to check, with scripts off", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/t/rent-agreement-11-month");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("11-Month Rent Agreement (Basic)");
    await expect(page.locator("#root")).toContainText("Landlord and Tenant");
    await expect(page.locator("#root")).toContainText("Security deposit");
    const notes = page.getByTestId("public-template-notes");
    await expect(notes).toContainText("Stamp duty applies");
    await expect(notes).toContainText("Maharashtra");
    await expect(notes).toContainText("Not yet reviewed by a lawyer");

    // The wording of the agreement itself is not on the public page
    await expect(page.locator("#root")).not.toContainText("interest-free security deposit");

    // The list links to it
    await page.goto("/t");
    await expect(page.getByRole("link", { name: "11-Month Rent Agreement (Basic)" })).toHaveAttribute("href", "/t/rent-agreement-11-month");
    await context.close();
  });

  test("a visitor goes from a template page through sign-up and sign-in to that template's questions", async ({ page }) => {
    const email = `visitor${Date.now()}@example.test`;
    const password = "correct-horse-battery";

    await page.goto("/t/rent-agreement-11-month");
    await page.getByTestId("use-template").click();
    await page.waitForURL(/\/register\?next=/);

    await page.getByPlaceholder("John Doe").fill("Meera Sharma");
    await page.getByPlaceholder("name@company.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.locator('button[type="submit"]').click();

    // Sign-up hands the destination on to sign-in
    await page.waitForURL(/\/login\?next=/);
    // The sign-up page stays on screen until the sign-in page has loaded; wait for the new one
    await expect(page.getByRole("heading", { name: /Sign In/ })).toBeVisible();
    await page.getByPlaceholder("name@company.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/templates/fill/rent-agreement-11-month");
    await expect(page.getByRole("heading", { name: "11-Month Rent Agreement (Basic)" })).toBeVisible();
    await expect(page.getByLabel("Landlord's full name")).toBeVisible();
  });

  test("sign-in does not follow a link that points to another site", async ({ page }) => {
    const { draft } = await import("./helpers.js");
    const account = await draft({ pages: 1 });

    for (const next of ["https://example.com/steal", "//example.com/steal"]) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.getByPlaceholder("name@company.com").fill(account.ownerEmail);
      await page.getByPlaceholder("••••••••").fill(account.password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("**/dashboard");
      expect(new URL(page.url()).host).toBe("localhost:4173");
    }
  });
});
