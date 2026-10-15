import { test, expect } from "@playwright/test";
import { draft, seed, signIn, setPlan, invitationFor, pdfFile, authenticatorCode, latestDocumentOf, framedElsewhere, teamDocument } from "./helpers.js";

// Phases 5 and 6 as a person meets them: a team, two-step sign-in, several PDFs as one
// document, contact lists and developer settings.
test.describe("teams, two-step sign-in and developer settings", () => {
  test("an owner buys Business, starts a team and invites a colleague, who joins and works in it", async ({ page, browser }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Buying asks how many people, then asks to simulate the payment
    page.on("dialog", (dialog) => dialog.accept(dialog.type() === "prompt" ? "3" : undefined));

    const owner = await draft({ pages: 1 });
    const colleague = await draft({ pages: 1 });
    await signIn(page, owner);
    await page.goto("/workspaces");

    // A Free account is told what teams need, and can buy it here
    await expect(page.getByTestId("team-list")).toContainText("You are not in a team yet.");
    await page.getByRole("button", { name: "Start a team" }).click();
    // How to pay for the three seats. Prepaid here, so a seat can be added part-way through below.
    const checkout = page.getByTestId("plan-checkout");
    await expect(checkout).toContainText("3 seats");
    await checkout.getByLabel(/Prepaid: one month only/).check();
    await checkout.getByRole("button", { name: "Pay ₹1,497", exact: true }).click();
    await expect(page.getByTestId("payment-return")).toContainText("Payment confirmed");
    await page.getByRole("link", { name: "Back to what you were doing" }).click();
    await page.waitForURL("**/workspaces");

    await page.getByPlaceholder("Team name").fill("Lakeview Society");
    await page.getByRole("button", { name: "Create team" }).click();
    await expect(page.getByRole("heading", { name: "Lakeview Society" })).toBeVisible();
    await expect(page.getByText("You are the owner")).toContainText("1 of 3 seats in use");

    await page.getByPlaceholder("name@company.com").fill(colleague.ownerEmail);
    await page.getByRole("button", { name: "Send invitation", exact: true }).click();
    await expect(page.getByTestId("team-members")).toContainText("Waiting to join");
    await expect(page.getByTestId("team-members")).toContainText(colleague.ownerEmail);
    await expect(page.getByText("You are the owner")).toContainText("2 of 3 seats in use");

    // The colleague opens the link from the email in their own browser
    const token = await invitationFor(colleague.ownerEmail);
    expect(token).toBeTruthy();
    const context = await browser.newContext();
    const theirs = await context.newPage();
    await signIn(theirs, colleague);
    await theirs.goto(`/invite/${token}`);
    await expect(theirs.getByTestId("invitation")).toContainText("Join Lakeview Society");
    await expect(theirs.getByTestId("invitation")).toContainText("member");
    await theirs.getByRole("button", { name: "Join Lakeview Society" }).click();
    await theirs.waitForURL("**/dashboard");

    // They now have two workspaces, and are working in the team
    const switcher = theirs.getByTestId("workspace-switcher");
    await expect(switcher).toBeVisible();
    await expect(switcher.locator("option:checked")).toHaveText("Lakeview Society");

    // What they upload there belongs to the team: the owner sees it in the team's documents
    await theirs.goto("/upload");
    await theirs.locator("#file-input").setInputFiles(await pdfFile("Team notice.pdf"));
    await theirs.getByRole("button", { name: "Upload →", exact: true }).click();
    // After the upload, the sender says who signs
    await theirs.getByRole("button", { name: /Only me/ }).click();
    await theirs.waitForURL("**/editor/**");
    await context.close();

    await page.reload();
    await expect(page.getByTestId("team-members")).toContainText("Member");
    await page.getByTestId("work-in-team").click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Team notice.pdf").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("a person switches two-step sign-in on, and the next sign-in asks for the code", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Security & Password" }).click();

    const section = page.getByTestId("two-factor");
    await expect(section).toContainText("Off");
    await section.getByRole("button", { name: "Switch on" }).click();
    const key = await page.getByTestId("two-factor-key").innerText();
    expect(key.replace(/\s/g, "")).toMatch(/^[A-Z2-7]{32}$/);

    // A wrong code changes nothing
    await section.getByPlaceholder("The six-digit code the app shows").fill("000000");
    await section.getByRole("button", { name: "Confirm" }).click();
    await expect(section).toContainText("Off");

    await section.getByPlaceholder("The six-digit code the app shows").fill(await authenticatorCode(key));
    await section.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("recovery-codes")).toContainText("They are not shown again");
    await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
    await expect(section).toContainText("On");

    // Signing in again: the password alone is not enough
    await page.evaluate(() => window.localStorage.clear());
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByPlaceholder("name@company.com").fill(account.ownerEmail);
    await page.getByPlaceholder("••••••••").fill(account.password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId("two-factor-step")).toBeVisible();
    expect(page.url()).toContain("/login");

    await page.locator("#code").fill(await authenticatorCode(key, 1));
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard");

    expect(errors).toEqual([]);
  });

  test("several PDFs are joined into one document, in the order shown", async ({ page }) => {
    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/upload");

    await page.locator("#file-input").setInputFiles([await pdfFile("Offer letter.pdf", 2), await pdfFile("Leave policy.pdf", 1)]);
    await expect(page.getByTestId("join-note")).toContainText("These 2 files will be joined");
    await expect(page.getByTestId("chosen-files").locator("li")).toHaveCount(2);

    // The second file is moved to the front
    await page.getByTestId("chosen-files").getByTitle("Move up").click();
    await expect(page.getByTestId("chosen-files").locator("li").first()).toContainText("Leave policy.pdf");

    await page.getByRole("button", { name: /Join & Upload/ }).click();
    await page.getByRole("button", { name: /Only me/ }).click();
    await page.waitForURL("**/editor/**");

    const document = await latestDocumentOf(account.ownerEmail);
    expect(document).toMatchObject({ pageCount: 3, fileName: "Leave policy and 1 more.pdf" });
  });

  test("a contact list is saved from pasted rows, and rows that cannot be used are left out", async ({ page }) => {
    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/contacts");

    await expect(page.getByTestId("contact-lists")).toContainText("No lists yet.");
    await page.getByTestId("new-list").click();
    const editor = page.getByTestId("list-editor");
    await editor.getByPlaceholder(/List name/).fill("Block A");
    await editor.locator("textarea").fill("name,email,label\nAsha Rao,asha@example.test,A-101\nRavi Kumar,not-an-email,A-102\nMeera Iyer,meera@example.test,A-103");
    await editor.getByRole("button", { name: "Save list" }).click();

    await expect(page.getByText("Saved. 1 row was left out.")).toBeVisible();
    await expect(page.getByTestId("contact-lists")).toContainText("Block A");
    await expect(page.getByTestId("contact-lists")).toContainText("2 people");

    // Opening it shows what was kept
    await page.getByTestId("contact-lists").getByRole("button", { name: "Edit" }).click();
    await expect(page.getByTestId("list-editor").locator("textarea")).toHaveValue(/Asha Rao, asha@example\.test/);
    await expect(page.getByTestId("list-editor").locator("textarea")).not.toHaveValue(/Ravi/);
  });

  test("a team's signer is told whose document it is, in the email and on the signing page", async ({ page }) => {
    const { signUrl, emailHtml } = await teamDocument();
    expect(emailHtml).toContain("Lakeview Society");
    expect(emailHtml).toContain("#0a7a4b");

    await page.goto(signUrl);
    await expect(page.getByTestId("brand-name")).toHaveText("Sent by Lakeview Society");

    // A document from a person's own account says nothing of the kind
    const own = await seed();
    await page.goto(own.signUrl);
    await expect(page.locator(".react-pdf__Page__canvas").first()).toBeVisible();
    await expect(page.getByTestId("brand-name")).toHaveCount(0);
  });

  test("a signing page placed inside another website shows nothing of the document", async ({ page }) => {
    const { signUrl } = await seed();
    // Some other site puts the signing page in a frame, with no session made for it. The other
    // site is served by the test stack on another port: a made-up public address would be
    // stopped by the browser's own local-network rule before the page's check ever ran.
    const elsewhere = framedElsewhere(signUrl);
    expect(new URL(elsewhere).origin).not.toBe(new URL(signUrl).origin);
    await page.goto(elsewhere);
    await expect(page.getByRole("heading", { name: "Win a prize" })).toBeVisible();

    const frame = page.frameLocator("iframe");
    await expect(frame.getByTestId("frame-refused")).toBeVisible();
    await expect(frame.getByTestId("frame-refused")).toContainText("This page cannot be shown here");
    // Neither the page of the document nor the button that signs it is drawn
    await expect(frame.locator(".react-pdf__Page__canvas")).toHaveCount(0);
    await expect(frame.getByTestId("mobile-action-bar")).toHaveCount(0);

    // Opened by itself, the same link works
    await page.goto(signUrl);
    await expect(page.locator(".react-pdf__Page__canvas").first()).toBeVisible();
  });

  test("a developer makes a test key and a webhook, and each secret is shown once", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const account = await draft({ pages: 1 });
    await signIn(page, account);
    await page.goto("/developer");
    // Not on this plan: said plainly, and nothing can be created
    await expect(page.getByTestId("api-upgrade")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create key" })).toBeDisabled();

    await setPlan(account.ownerEmail, "enterprise");
    await page.reload();
    await expect(page.getByTestId("api-upgrade")).toHaveCount(0);

    await page.getByPlaceholder(/What the key is for/).fill("Billing system");
    await page.getByRole("button", { name: "Create key" }).click();
    const reveal = page.getByTestId("secret-reveal");
    await expect(reveal).toContainText("Your new test key");
    const key = await reveal.locator("code").innerText();
    expect(key).toMatch(/^pd_test_[a-f0-9]{6}_[a-f0-9]{48}$/);
    await reveal.getByRole("button", { name: "I have saved it" }).click();

    // Afterwards only its first characters are on the page
    await expect(page.getByTestId("api-keys")).toContainText("Billing system");
    await expect(page.getByTestId("api-keys")).toContainText(key.slice(0, 14));
    expect(await page.locator("body").innerText()).not.toContain(key);

    // A webhook must be an https address on the public internet
    const hooks = page.getByTestId("webhooks");
    await hooks.getByPlaceholder(/https:\/\/example\.com/).fill("https://127.0.0.1/hook");
    await hooks.getByRole("button", { name: "Add webhook" }).click();
    await expect(page.getByText("Webhook addresses must be reachable from the internet")).toBeVisible();

    await hooks.getByPlaceholder(/https:\/\/example\.com/).fill("https://93.184.216.34/hooks/pactdoc");
    await hooks.getByRole("button", { name: "Add webhook" }).click();
    await expect(page.getByTestId("secret-reveal")).toContainText("Webhook signing secret");
    await expect(page.getByTestId("secret-reveal").locator("code")).toHaveText(/^whsec_[a-f0-9]{48}$/);
    await expect(hooks).toContainText("https://93.184.216.34/hooks/pactdoc");

    await hooks.getByRole("button", { name: "Deliveries" }).click();
    await expect(hooks).toContainText("Nothing has been sent to this address in the last 30 days.");

    expect(errors).toEqual([]);
  });
});
