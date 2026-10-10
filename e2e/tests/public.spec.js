import { test, expect } from "@playwright/test";

// Plan task P3-14: a public page read without running any script still holds its content.
const PAGES = [
  { path: "/", text: "Sign Agreements", title: /PactDoc/ },
  { path: "/pricing", text: "Choose the Perfect Plan", title: /Pricing/ },
  { path: "/verify", text: "Verify Document", title: /Verify/ },
  { path: "/userguide", text: "User Flow Manual", title: /guide/i },
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

  test("the sitemap lists the public pages and nothing else", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const listed = [...xml.matchAll(/<loc>[^<]*?(\/[^<]*)?<\/loc>/g)].map((m) => new URL(m[0].replace(/<\/?loc>/g, "")).pathname);
    expect(listed.sort()).toEqual(PAGES.map((p) => p.path).sort());
  });
});
