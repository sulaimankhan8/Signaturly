# PactDoc — Pending Tasks and Production Roadmap

**Status as of 11 October 2026.** PactDoc is the product name. The apps and emails say PactDoc; the cloud resource names and the older documents still say Signaturly.

The security fixes (phase 1) are almost complete, the core of the trust layer (phase 2) is built, and the code side of phases 3, 4 and 5 is finished and tested. Of phase 6, the public API, webhooks, test mode and embedded signing are built and tested; **Aadhaar eSign is postponed to the next version** (your decision, 11 October 2026) and is switched off. 525 server tests and 56 browser tests passed in the last full run. Four Razorpay tests were added after it and pass with the other billing tests; the full suite has not been run again since. Phases 1 to 3 are committed and pushed on the branch `fix/phase1-security`; phases 4, 5 and 6 are not committed. Nothing is merged to `main` or deployed, and the product is **not safe to put in front of real users** until the blockers below are cleared.

Related documents:

| Document | What it is |
| --- | --- |
| `PACTDOC_IMPLEMENTATION_PLAN.md` | Every task with its id, files and test. The ids below (P1-07, P2-03) refer to it. |
| `docs/reports/PACTDOC_PRODUCT_TECHNOLOGY_AUDIT.md` | The audit findings (C1 to M10) the fixes answer. Do not publish while the repo is public. |
| `docs/reports/PACTDOC_INDIA_STRATEGY_BUILD_PLAN.md` | Market, industries, templates, plans. |
| `docs/reports/PACTDOC_BUSINESS_MARKET_REPORT.md` | Competitors and pricing. |
| `README.md` | How to run everything on your own machine, and where each document is. |
| `docs/archive/` | Documents from before the audit. Not maintained; do not rely on them. |

---

## 1. Where things stand

| Phase | Goal | Tasks | Done | Partly | Not started |
| --- | --- | ---: | ---: | ---: | ---: |
| Setup | Test harness, CI, environments | 13 | 5 | 3 | 5 |
| 0. Emergency | Leaked credentials are dead | 8 | 0 | 1 | 7 |
| 1. Secure | Access-control and abuse bugs fixed | 32 | 29 | 3 | 0 |
| 2. Trust | Sealed PDFs, audit log, jobs, billing | 22 | 9 | 7 | 6 |
| 3. India fit | Languages, WhatsApp and SMS, India hosting, rename | 14 | 9 | 3 | 2 |
| 4. Templates and plans | Template engine, first packs, new pricing | 17 | 13 | 3 | 1 |
| 5. Teams | Workspace-owned documents and roles | 11 | 9 | 2 | 0 |
| 6. Strong signatures and API | Aadhaar eSign (postponed), public API, Enterprise | 15 | 4 | 10 | 1 |
| **Total** | | **132** | **78** | **32** | **22** |

A task counts as done when the test the plan names for it passes. Five of the ten "partly" tasks in phase 6 are the Aadhaar eSign scaffolding, which is postponed.

Where the work lives: branch `fix/phase1-security`. Phases 1 to 3 are in four commits there, pushed to GitHub on 11 October 2026; phases 4, 5 and 6 are uncommitted. `main` is unchanged, so the deployed code is still the code the audit describes. Run the server tests with `npm --prefix server test` and the browser tests with `npm --prefix e2e test` (after `npm --prefix e2e install`; they use the Chrome already on the machine).

Checked on 11 October 2026: 525 server tests, among them an access test generated from the list of routes that calls each of a team's 53 routes as an outsider, viewer, member, admin and owner; 56 browser tests in Chrome, on a 360-pixel phone profile and a desktop one (everything listed before, and now also: buying Business, starting a team, inviting a colleague who joins and uploads into it; switching two-step sign-in on and signing in with a code; joining several PDFs into one document; saving a contact list; making an API key and a webhook; a team's name on the signing page; a signing page refusing to show inside another website); both web apps build.

Found and fixed by writing those tests: a viewer in a team could send from a ready-made template and save a team template; a document or bulk send could be charged to the wrong team when the sender belonged to two; an API key could read documents of another workspace its maker belonged to; a webhook address written as an IPv4 address inside IPv6 passed the private-address check; an Enterprise account could not invite anyone because its seat count started at one; a teammate could not open a team document in the editor.

Not checked: the workspace migration on real data (only on seeded data); single sign-on against a real identity provider (only a simulated one); webhooks against a real receiver (only a simulated one); the frame-blocking headers on the live host; a real payment through Razorpay (only the simulated purchase and signed test events); a real phone in the hand; the seal in Adobe Acrobat; the Hindi wording by a native speaker; the new page routing on the live host (A-21); the browser tests on CI, which have not run because nothing since phase 3 is pushed.

---

## 2. Blockers before any real user

| # | Blocker | Who | Detail |
| --- | --- | --- | --- |
| 1 | Leaked credentials are still live | You | The database password, SMTP password and other values were committed in `.github/workflows/deploy-backend.yml`, `docs/DEPLOYMENT_GUIDE.md`, `scratch/create_deployment_docx.py` and `docs/CLOUD_DEPLOYMENT_DOCKER_GCP_MASTERCLASS.docx`. All four files are now cleaned in the working tree, but the values remain in git history on a public repository. Rotate every one. |
| 2 | Production ran on placeholder secrets | You | The deployed JWT secrets were short, guessable placeholder values and the admin key was the built-in default, which the admin login page also pre-filled. Anyone could have forged a login. The new code refuses to start with such values. |
| 3 | New secrets do not exist yet | You | The deploy now reads 11 secrets from Secret Manager (section 7). Until they are created, a deploy fails. |
| 4 | No backups | You | The free database tier has none. Move to a tier with backups and run one restore. |
| 5 | The fixes are on a branch, not on `main` | You decide | The branch is pushed; `main`, and so whatever is deployed, still has every hole the audit lists. Merging to `main` triggers a deploy, which fails until the secrets exist. |
| 5a | The audit is public | You | The pushed branch contains `PACTDOC_PRODUCT_TECHNOLOGY_AUDIT.md`, which lists each weakness of the deployed code with file and line, and the repository is public. Make the repository private now; it is one setting and undoes nothing. |
| 5b | CI failed on the pushed branch | Code, done locally | Two causes, both fixed in the uncommitted work: the test tools need Node 22 while CI and the server image used Node 20 (which also passed its end of life in April 2026), and one browser test read a code email before it had been queued. The next push should pass. |
| 6 | Legal wording and templates unreviewed | You | A lawyer has not reviewed the terms, privacy notice, consent text or certificates. |
| 6a | Phases 4 to 6 have had no second pair of eyes | You decide | They are tested but uncommitted, and they change who can read and send every document. Commit them to the branch and let CI run before anything is merged. |
| 6b | The workspace migration has not been run on real data | Code, then you | `002-workspaces-2026-10` is tested forwards, twice and backwards on seeded data. Before production: back up, run it on a copy, compare counts. New code treats a document with no workspace as its creator's own, so deploying first and migrating after is safe. |
| 7 | Browser tests do not cover everything | Code | Signing, sending, guided templates and the admin's template page are covered. The dashboard, bulk send, billing, settings and the rest of the admin app are not (A-22). |

---

## 3. Your to-do list

Tasks only the account owner can do, in the order they block things. Section 10 has the steps for each outside service.

- [ ] Buy `pactdoc.com` (section 10, step 1). It looked unregistered on 11 October 2026, and the public repository names it

- [ ] Make the GitHub repository private (P0-01). More urgent since 11 October: the audit document is now in a public branch
- [ ] Change the MongoDB password and review who can reach the database (P0-02)
- [ ] Generate new JWT access and refresh secrets, at least 32 characters each (P0-03)
- [ ] Generate a new admin key and a new SMTP app password (P0-04)
- [ ] Change the password of the account that was hardcoded in the old test scripts, wherever it is used (P0-05)
- [ ] Check the database for misuse: unknown admin users, plan upgrades with no payment (P0-08)
- [ ] Decide: fresh private repository, or rewrite the history of this one (P0-07)
- [ ] Create the Secret Manager secrets and GitHub variables listed in section 7
- [ ] Run `npm --prefix server run seal:generate` once per environment and store both values
- [ ] Create the four Cloud Scheduler jobs listed in section 7
- [ ] Set a real `ADMIN_SECRET_KEY` in your local `server/.env` (the server will not start with the placeholder)
- [ ] Create the admin account with the seed script and a password of your choice; the default password is gone
- [ ] Create separate staging and production projects (S-01)
- [ ] Protect `main`: pull requests only, CI required (S-10)
- [ ] Choose a database tier with backups (P2-18)
- [ ] Choose a transactional email provider and add SPF, DKIM and DMARC for pactdoc.com (P2-13)
- [ ] Engage a contracts lawyer: terms, privacy notice, consent text, certificates, template packs. The terms pop-up shown to new senders makes strong legal statements that nobody has reviewed.
- [ ] Have the lawyer review the eight Starter templates and their state notes first. They are written and working, but hidden in production until a reviewer's name and date are recorded against each, on the Templates page of the admin app (P4-09)
- [ ] Decide whether the Free plan may fill in the Starter templates by answering questions. The plan table says Free has no guided templates but does have the Starter pack; the code currently allows it (A-26)
- [ ] Confirm or change the prices the code proposes beyond Free and Pro: yearly Pro at ₹2,990, extra documents at ₹79 for 10, ₹349 for 50 and ₹1,299 for 200, SMS at 25 paise and WhatsApp at 80 paise a message (A-31)
- [ ] Ask an accountant to confirm how GST is shown: prices include 18% GST, a buyer with no state on file is treated as in your state, and wallet credit is invoiced when it is bought (A-34)
- [ ] Once registered for GST, set `SELLER_LEGAL_NAME`, `SELLER_ADDRESS` and `SELLER_GSTIN`. Until then customers get receipts with no tax shown
- [ ] Create Razorpay keys and try one real payment in Razorpay's test mode before switching billing on (A-32)
- [ ] Make sure the address on the pricing page's "Talk to us" button, sales@pactdoc.com, exists
- [ ] Find a native Hindi speaker to review the signing screens, emails and the signing record (A-13)
- [ ] After the first deploy of the client, open `/`, `/pricing` and a signing link on the live site and confirm each shows the right page (A-21)
- [ ] Register the business and for tax; run a trademark search on PactDoc
- [ ] Interview 20 to 30 small organisations before building phases 4 to 6
- [ ] Decide the account-deletion policy (item A-08 in section 6)

---

## 4. Done

### Phase 1: secure (29 of 32)

| Area | What now holds | Tasks |
| --- | --- | --- |
| Files | Stored files are private. They are served only through short-lived signed links or to the owner by header token. Path traversal is rejected. | P1-07, P1-08, P1-11 |
| Signer checks | OTP and passcode are enforced on the server. The passcode locks after five wrong tries. The audit entry records the method really used. | P1-04, P1-05, P1-06, P1-20 |
| Signing rules | Signing order, document state, viewer role, required fields and field ownership are checked on the server. Consent is stored. The PDF is stamped before the signer is marked signed, under a database lock. | P1-13 to P1-17 |
| Money | Payment webhooks must be signed and are ignored on replay. The self-upgrade route and mock checkout cannot run in production. Billing is off there by default. | P1-01, P1-02, P1-03 |
| Own documents | Only the owner can self-sign, and only an unsent document. Signature images cannot be remote links or file paths. | P1-09, P1-10 |
| Accounts | 10-character passwords, email confirmation before sending, hashed and rotating refresh tokens, hashed single-use reset tokens. | P1-23, P1-24 |
| Admin | No automatic promotion. Admin sessions use their own secret. Configuration is validated at start-up. | P1-26 (and most of P1-25) |
| Platform | Rate limits, security headers, strict origin list, no tokens in URLs, upload limits, atomic plan quota, reminder de-duplication, public health check. | P1-19, P1-21, P1-22, P1-28 to P1-31 |
| Verification page | Returns masked names only: no emails, IP addresses or download link. | P1-27 |
| Wording | Unsupported claims removed, with a test that keeps them out. Adverts removed from the signing page. | P1-32 |

### Phase 2: trust (9 of 22)

| What now holds | Tasks |
| --- | --- |
| The original upload is never overwritten; each signer's stamp is a stored version | P2-04 |
| Verification checks an uploaded file's own hash and its seal, and opens from a QR link | P2-05 |
| One hash-chained, keyed audit log for every event; edits, removals and insertions are detected; entries cannot be changed through the app | P2-06 |
| Deleting a document keeps its record and audit log | P2-07 |
| A job queue stored in the database, with retries and a failure state; emails go through it | P2-09, P2-10 |
| The in-memory live-update stream is gone | P2-12 |
| Renewals, failed charges and cancellations from Stripe and Razorpay drive plan state; a payments ledger exists | P2-15 |
| Admin plan grants record which admin made them | P2-17 |

### Phase 3: India fit (9 of 14)

| What now holds | Tasks |
| --- | --- |
| The rendering question is settled: text is shaped with HarfBuzz and drawn as outlines. The PDF library's own text drawing was tested and breaks every Indian script. Record and comparison image: `docs/decisions/0001-text-rendering-for-indic-scripts.md` | P3-01 |
| Hindi, Marathi, Tamil, Telugu, Kannada, Gujarati and Bengali text is kept in signed PDFs and on the signing record; long values shrink to fit their field | P3-02 |
| A signer can be reached by phone alone. Fields link to them by number. Their link, reminders, completion notice and codes go by SMS or WhatsApp. | P3-06 |
| The one-time code can go by SMS, and the audit log names that method | P3-09 |
| Dates as 11 Oct 2026, evidence times in UTC and India time, rupee amounts with Indian grouping | P3-10 |
| Every screen a signer sees is in English and Hindi: the identity check, the document, the signature panel, declining, the finish screen. A test fails the build if a word is typed straight into one of those screens, or if a language is missing a key. A browser test signs a document from start to finish in Hindi and finds no English left on screen. | P3-03 |
| The signing record repeats its headings and labels in the signers' language beside the English. English stays the text of record; names, times and hashes appear once. | P3-04, A-18 |
| Signing works on a 360-pixel phone: the page is drawn to the width of the screen, the main action sits in a bar at the bottom, signatures are drawn with a finger, pinch-zoom is allowed. A signer downloads the signing page alone, not the whole app, and a long document is fetched in pieces so page 1 appears before the rest has arrived. | P3-13 |
| The landing, pricing, verification and user-guide pages are written out as HTML when the site is built, each with its own title, description and canonical link, plus a generated sitemap. The build fails if one comes out empty. Template pages will join when they exist (P4-08). | P3-14 |

### Phase 4: templates and plans (13 of 17)

| What now holds | Tasks |
| --- | --- |
| A template is data: questions, signers, text with placeholders, a signature hint, state notes, a reviewer, a version. The templates that ship with the code are copied into the database on start-up and never overwrite a stored version. The 14 hand-drawn templates are gone: 13 were converted, each without its closing clause that declared the e-signature valid under three countries' laws, and the promissory note was dropped because the IT Act still excludes it between private individuals. | P4-01 |
| Templates are laid out in the API itself, on the PDF library, with the phase 3 shaping for Indian scripts. A two-page Hindi agreement renders in about 0.6 seconds. Only this option was built and measured; the headless-browser alternative was compared on paper. Record: `docs/decisions/0002-template-renderer.md` | P4-02 |
| Answers plus a template give an A4 PDF with each signer's signature and date placed, amounts in figures and in words (Rs. 1,25,000, Rupees One Lakh Twenty Five Thousand only), dates worked out (eleven months less a day), clauses that appear only when they apply, and the same file byte for byte for the same input. The last clause travels with the signatures, so no page holds signatures alone. | P4-03 |
| A fill-in screen: questions with checks, a preview that redraws as the sender types, a draft saved as they go, then who signs, with names carried over from the answers. A browser test fills in the rent agreement on a free account, sends it, and has landlord and tenant sign, one in English and one in Hindi. | P4-04 |
| One table says what each plan includes. Routes ask it and never name a plan. Template packs open by plan tier, and a locked pack is shown with the plan that opens it. Bulk send is limited per plan (25 recipients on Pro). | P4-06 |
| The admin app has a Templates page: every template with its versions and the number of documents each made. A published version cannot be edited; a change is drafted as the next version, read as a PDF, then published, and documents already sent keep the version they were made from. A draft with a broken placeholder is refused with the reason. A lawyer's review is recorded against one exact version and does not carry over to the next. Every action is kept in the version's history with the admin who took it. Structure (signers, questions, text) is edited as JSON, not in a visual editor. | P4-05 |
| The fill-in screen shows, before anything is sent, whether an ordinary e-signature is usual, whether stamp duty applies, the note for the chosen state, and whether a lawyer has reviewed the template. | P4-07 |
| The site has a public template library at `/t` and a page for each template at `/t/<key>`: what it is for, who signs, what the sender will be asked, the headings it covers, the stamp-duty and state notes, and whether a lawyer has reviewed it. The agreement's wording is not on the public page. "Use this template" leads through sign-up and sign-in to that template's questions. The pages are written out as HTML at build time and listed in the sitemap. | P4-08 |
| One price list holds every plan, pack and price. Free is 5 documents a month; Pro is ₹299 for 50. The lifetime plan cannot be bought, by button or by a payment naming it; accounts that have it keep it. A payment that does not match the price of what it names grants nothing. A migration moves existing accounts over: free accounts to 5 documents, paid accounts keep unlimited documents until the period they paid for ends. | P4-13 |
| Every plan is metered. Packs of extra documents can be bought on any plan; they are used after the month's allowance and carry over to the next month. Sends that arrive together cannot pass the limit, and a send that fails gives its documents back. | P4-14 |
| A prepaid wallet with a ledger. The balance cannot go below zero under any number of simultaneous charges, the ledger always adds up to the balance, and the same payment or message is never applied twice. SMS and WhatsApp messages are paid from it; with an empty wallet the message is not sent. | P4-15, A-14 |
| Every payment gets an invoice, numbered without gaps within the financial year, whose total equals the payment. With your GST number configured it is a tax invoice showing CGST and SGST or IGST by the buyer's state; without it, a receipt with no tax. Customers can add their GST number and download invoices as PDFs. | P4-16 |
| A new pricing page in rupees, fed by the same price list as checkout, and a billing page for plan, usage, extra documents, wallet, invoice details and invoices. Old dollar prices and the lifetime offer are gone from every screen. Emails and the finished signing page for documents sent from a Free account carry "Signed with PactDoc" and an invitation to send one's own; paid accounts' do not. | P4-17 |

### Setup (5 of 13)

Test harness with an in-memory database (S-03), test helpers (S-04), email outbox for tests (S-05), a CI workflow that runs tests, builds and a secret scan on every pull request (S-08), and browser tests in `e2e/` that run the built client against the real server on a throwaway database (S-07), added to CI as their own job.

### Bugs found and fixed that were not in the audit

- Request values were passed unchecked into database lookups on the OTP routes.
- Real-looking credentials were hardcoded in two test scripts (now deleted).
- A forged PDF that quoted a genuine hash was reported as authentic.
- Any signed-in user could download any document's audit certificate.
- A template could be created from another user's document.
- A signer name in a non-Latin script crashed certificate generation.
- A signer whose email was corrected never received the new invitation.
- A document with a viewer could never reach "completed".
- The download button after signing gave the copy from before the signature.
- The document owner was never told a document was complete.
- Names and messages were placed into email HTML without escaping.
- About 1 genuine sealed file in 256 was reported as altered, because the signing library's extractor cut short any signature ending in a zero byte.
- The admin login page pre-filled the default admin key.
- Tapping a signature field on the document did nothing: the tap was swallowed before it reached the page. Only the list in the side panel worked, and a phone has no side panel. Found by the first browser test.
- A date field carried the day the sender prepared the document, not the day of signing, and in the sender's browser format, so 10/11/2026 could mean either month.
- A signer could drag fields around the page. The server ignored the new positions, so the signer saw one layout and the PDF was stamped with another. Fields are now fixed for signers.
- The ready-made signature stamp printed claims onto the document: "digitally verified", "IT Act/ESIGN compliant", "officially signed", and an ID that was the same on every document. It now says "Electronically signed" and the date.
- The PDF reader's worker script was loaded from a third-party network on every page view. It is now served with the app.
- Pinch-zoom was switched off on every page.
- The sitemap and robots file listed pages that do not exist.
- The server image and CI ran on Node 20, which stopped receiving security fixes in April 2026. Both now use Node 22, the version everything is developed and tested on. The image itself has not been rebuilt and tried yet.
- A new account's first screen asked for its subscription several times at once; all but one request failed with a server error. Found by the plan-access tests.
- Every ready-made template printed "LEGALLY COMPLIANT (IT ACT / ESIGN / eIDAS)" across its header and ended with a clause declaring the signature admissible. Both went with the old generator.
- The templates page called the old templates "attorney-vetted" and quoted dollar prices for plans.
- A template draft was lost if the sender left the page within a second and a half of typing, or when a send was refused. It is now saved on the way out.
- The dashboard and settings screens read usage figures the server never sent, and so always showed a limit of 15.
- The landing page's answers still described the old signature stamp's "security hash IDs" and claimed compliance with three countries' laws.
- The old name was still on screen in the navigation bar, the landing page and the admin panel, written across two tags so the name test missed it. The test now reads text with its tags removed. A "Pro" badge beside the logo, shown to every account whatever its plan, is gone too.

---

## 5. Partly done

| Task | Done | Still to do |
| --- | --- | --- |
| P0-06 Secrets out of the workflow | The workflow reads secrets from Secret Manager | You create the secrets |
| S-09 Deploy gated by tests | Tests must pass before deploy | Separate staging and production deploys |
| S-13 Retire old scripts | The credential-bearing scripts, the two old `verify-*.js` scripts and the `scratch/` folder are deleted. The script that drops the database now refuses to run without an explicit flag, refuses in production, and is left out of the production image | Nothing in code |
| P1-12 Validate all input | A global guard rejects database-operator input; schemas on all public and sign-in routes | Schemas on the remaining signed-in routes |
| P1-18 Link expiry | 30-day expiry, random 64-character tokens, no links in the bulk-send response | A new token on every reminder was dropped by design: only an email change issues a new link |
| P1-25 Admin lock-down | No promotion, separate secret, seeded admins only, login rate limit | Authenticator-app 2FA |
| P2-01 Signing library | `@signpdf` chosen and in use | A written decision note; it does not add timestamps by itself |
| P2-02 Seal key | Certificate loaded from a secret; development certificate generated automatically | Key held in a key-management service |
| P2-03 Seal on completion | Signing record appended, whole file signed, sealed copy is the download, retry job if sealing fails | Trusted timestamp; check in Adobe Acrobat and `pdfsig` |
| P2-08 Certificates from the full log | Signing record rebuilt with real identity check, consent and QR code | The Section 63 evidence certificate still uses its old layout |
| P2-11 Scheduled work | Protected endpoints for jobs, reminders, expiry and subscriptions | You create the Cloud Scheduler jobs |
| P2-14 Provider-driven billing | Plan state changes only through verified events or an admin | Checkout for Razorpay Subscriptions; plan ids in one catalogue |
| P2-19 Privacy | Account export and account deletion on the server | Buttons in the app, a retention job, the privacy notice page |
| P3-07 SMS provider | One messaging interface with development and test providers; refuses to send in production | A commercial provider, sender registration, approved templates |
| P3-08 WhatsApp | Same interface and templates | Business verification, template approval, delivery-status callbacks |
| P3-12 Rename to PactDoc | App name, emails, pages, storage keys, API key prefix and package names all say PactDoc; a test keeps the old name out | Cloud resource names in the deploy workflow, DNS, and the old documents (A-11) |
| P4-09 Starter pack | All eight templates are written, render with every combination of choices, and are open to every plan | Lawyer review. Until then they are marked "not yet reviewed" and hidden in production |
| S-11 Migrations | A small runner (`npm run migrate`) that runs each data migration once, with the plans migration as its first | Running it as a step of every deploy |

---

## 5a. Phases 5 and 6: what is built

Written and tested on 11 October 2026. Every line marked done has the test the plan asked for, and it passes.

### Phase 5: teams (9 done, 2 partly)

| Task | Status | What holds now | Still open |
| --- | --- | --- | --- |
| P5-01 Workspace ownership | Done | Documents and saved templates belong to a workspace; every user has a personal one; the active workspace comes from a header and is ignored unless the user belongs to it. The migration is tested forwards, twice, and backwards. | Running it on real data (blocker 6b). Audit entries do not carry the workspace, to leave the hash-chained log alone. |
| P5-02 One permission helper | Done | Roles viewer, member, admin, owner and one table of the lowest role for each action. | |
| P5-03 Access matrix | Done | Read from the route files, so a new route fails the suite until someone says how it is protected. 152 routes listed; 53 called as outsider and as each role. | |
| P5-04 Invitations | Done | By email, for people with or without an account; only the invited address can accept; expire in 7 days and hold a seat meanwhile. | |
| P5-05 Business plan | Partly | ₹499 a seat, 100 documents a seat pooled; seats added mid-period for the share of the period left; the next period can be bought with fewer seats but not fewer than the people in the team. | Never tried against Razorpay. Seats are not removed part-way through a period, by design. The price is my proposal. |
| P5-06 Branding and shared templates | Done | A team's name, colour, footer and logo on signing emails, the signing page and the head of the signing record. | A logo uploaded as a file does not show in emails. |
| P5-07 Contact lists and bulk send | Done | Lists from typed rows or CSV with a report of rows left out; one job per row; progress, reasons for failures, retry. A 500-person send completes in the test. | The older bulk-send screen still exists beside it. |
| P5-08 Switcher and activity | Done | Workspace picker; team page with members, invitations, roles, branding, rules, activity. | |
| P5-09 Two-step sign-in | Done | Authenticator-app codes with ten recovery codes; each code works once; a team can require it. | Enforced on documents and sending, not on every team route. |
| P5-10 HR and professional packs | Partly | Ten HR and eight professional templates drafted and rendering. Several PDFs can be joined into one document and signed in one sitting. | Lawyer review. The joined papers become one file; they are not sealed separately. |
| P5-11 Downgrade and removal | Done | A removed member's documents pass to the owner; a lapsed plan makes team workspaces read-only. | |

### Phase 6: the API and stronger signatures (4 done, 10 partly, 1 not started)

| Task | Status | What holds now | Still open |
| --- | --- | --- | --- |
| P6-01 Provider quotes | Not started | Postponed with the rest of Aadhaar eSign. | Yours, when you take it up: section 5b. |
| P6-02 to P6-06 Aadhaar eSign | Partly, postponed | The flow, wallet charge and refund, ordering and fallback exist and are tested against a stand-in provider. It is off unless `ESIGN_PROVIDER` is set, and the stand-in is refused in production. | A licensed provider; the provider's signature inside the PDF; sealing after it without breaking it; a button for the fallback. |
| P6-07 Lending and real-estate packs | Partly | Eight lending and five real-estate templates drafted and rendering. Promissory note, agreement for sale and sale deed are left out on purpose. | Lawyer review. |
| P6-08 E-stamping | Partly | Decision note: not built now. `docs/decisions/0003-e-stamping.md` | Your confirmation. |
| P6-09 API keys | Done | Live and test prefixes, scopes, 120 requests a minute a key; a key works only in its own workspace and only while its maker belongs there and the plan includes the API. | |
| P6-10 Public API | Partly | `/api/v1`: upload, send, read, list, void, download link, remind, send from a saved template, manage webhooks. Tested. | Tests generated from `docs/api/openapi.yaml`. Guided templates, contact lists and repeat-safe requests are not in the API. |
| P6-11 Webhooks | Done | Signed deliveries, five attempts with growing waits, a 30-day log, replay with the same event id. Private and local addresses are refused in every spelling tried. | A name that resolves to a public address when checked and a private one a moment later would get through. |
| P6-12 Embedded signing | Done | A 15-minute session for one signer and one listed website; the signing page refuses to draw inside any other site (checked in a browser); each session is written to the audit log. | The headers that forbid framing every other page are set in `client/vercel.json` and unchecked on the live host. |
| P6-13 Test mode | Done | Watermarked, never counted, never emailed; live and test keys cannot see each other's documents. | |
| P6-14 Developer documentation | Partly | `docs/api/README.md` and the OpenAPI file. | The examples are not run automatically. No request collection. |
| P6-15 Enterprise | Partly | Single sign-on limited to DNS-proved domains; a daily retention job that erases finished documents after a set number of days and keeps the audit log. Both tested, the first against a simulated provider. | An organisation's own web address. A dry-run mode for the retention job before it is scheduled. |

### Decisions made while building this that are yours to confirm

1. Business is ₹499 a seat a month with 100 documents a seat, pooled.
2. A member of a team works under the team owner's plan: its features, its allowance and its wallet. The team that holds a document pays for it.
3. Test documents send no email at all, so a test key cannot be used to send free email.
4. Single sign-on creates an account for a new person at a verified domain and gives them a seat as a member.
5. The retention rule erases files for good and keeps the audit log.
6. Seats are never taken away part-way through a paid period; a smaller count applies from the next purchase.
7. Enterprise has no seat limit unless one is set for the account.

### Templates

73 templates are in the code: Starter 8, general business 13, rentals 9, housing society 12, HR 10, professional firms 8, lending 8, real estate 5. All render. Only the 13 general ones carry over from before; none has been reviewed by a lawyer, so all stay hidden in production. Hindi versions (P4-12) are not started.

## 5b. Aadhaar eSign, when you take it up

Postponed to the next version. What it needs, in order:

1. A registered Indian business, with PAN and GST details and a live site with terms and a privacy notice.
2. Quotes and sandbox access from two providers. A reseller (for example Digio, Leegality or SignDesk) is quicker than applying to a licensed provider directly. Ask each for the price per signature, any monthly minimum, how long production approval takes, whether they return the signed PDF, and how they notify your server.
3. The real provider written against the interface in `server/src/services/esign/`, the seal changed to an appended signature, and the result checked in `pdfsig` and Adobe Acrobat. About two to three weeks after sandbox credentials arrive.

The domain: you said you will buy `pactdoc.com`. On 11 October 2026 it had no DNS record, which usually means it is unregistered. The code and these documents name it, and the repository is public, so buy it before someone else does.

---

## 6. Not started, and items added along the way

### Not started in phases already begun

| Task | What | Needs |
| --- | --- | --- |
| P0-01 to P0-05, P0-08 | Rotation and misuse check | You |
| P0-07 | Remove secrets from git history | Your decision on how |
| S-01, S-10 | Staging project; branch protection | You |
| S-02 | Local `docker-compose.dev.yml` | Code |
| S-06 | Component tests for the web apps | Code |
| S-12 | Structured logger with redaction; error tracking | Code, plus an error-tracking account |
| P2-13 | Transactional email provider and bounce handling | Your provider choice |
| P2-16 | Billing page: plan, invoices, cancel | Code, after P2-14 |
| P2-18 | Database tier with backups; restore drill | You |
| P2-20 | Saved signatures and contacts on the server, not in the browser | Code |
| P2-21 | Storage encryption key and file access log | Code and cloud settings |
| P2-22 | Optional 2FA for senders | Code |
| P3-05 | Marathi, Tamil, Telugu, Kannada, Gujarati and Bengali wording | Translators; the keys already fall back to English |
| P3-11 | Move hosting, storage and database to the Mumbai region | Your approval of a maintenance window |
| P4-10 to P4-12 | Rentals pack, housing-society pack, Hindi versions | Lawyer and translator; Code builds the definitions |

### Added along the way (not in the original plan)

| Id | Task | Suggested phase |
| --- | --- | --- |
| A-01 | Trusted timestamp on the seal | 2 |
| A-02 | Buy a seal certificate from a recognised authority, so PDF readers show the signature as trusted | When customers ask |
| A-03 | Open a sealed PDF in Adobe Acrobat and add `pdfsig` validation to CI | 2 |
| A-04 | App screens for: account export and deletion, "invitation undelivered" flag, "sealed" badge, resend-confirmation banner | 2 |
| A-05 | Fix the client's 543 existing lint errors, then make lint a CI gate | 2 |
| A-06 | Rebuild the Section 63 evidence certificate from the full log and have the lawyer review it | 2 |
| A-07 | Wipe or migrate development data before launch: old audit entries were never chained and show as unconfirmed | Before launch |
| A-08 | Policy decision: when an account is deleted, completed agreements are kept but other parties' links stop. Should those parties keep access? | You and the lawyer |
| A-09 | Remove dead code left by the fixes: `quota.middleware.js`, `sse.service.js` | 2 |
| A-10 | Done in phase 3: non-Latin names now print correctly on the signing record | Done |
| A-11 | Rewrite the user guide, deployment guide and Word documents after the rename; they describe features inaccurately | 3 |
| A-12 | Rotate-certificate procedure: documents sealed with an old certificate stop showing as "sealed by this service" | 2 |
| A-13 | Have a native speaker review the Hindi wording, and the lawyer approve the consent sentence in each language | Before launch |
| A-14 | Done in phase 4: SMS and WhatsApp messages are paid from the sender's wallet | Done |
| A-15 | Trim the font packages: about 28 MB ships, only Regular and Bold are used | 3 |
| A-16 | Fonts for Arabic and Japanese, and correct ordering of mixed right-to-left text, for the later markets | After India launch |
| A-17 | Shaped text is not selectable in the PDF; consider an invisible text layer if customers ask | Later |
| A-18 | Done in phase 3: the signing record repeats its headings in the signer's language | Done |
| A-19 | Error replies from the server on the signing screens (wrong code, expired link, too many tries) are in English only. Send a code with each and translate it in the app. | 3 |
| A-20 | Speed up the signing page on a weak signal. Measured at 400 kbit/s: 22 seconds to the first page of a 1.7 MB document. The PDF reader's worker (about 1 MB before compression) and 17 font families loaded on every page are the largest pieces. | 3 |
| A-21 | Check the client's new routing on the live host: `/` and `/pricing` must serve their ready-made pages and every other path must reach `/app.html`. Tested locally against a stand-in host only. | First deploy |
| A-22 | Browser tests for the dashboard, templates, bulk send, billing, settings and the admin app | 2 |
| A-23 | The wording on the signature stamp ("Electronically signed") is English whatever the signer's language. Decide whether it should follow the language. | With the lawyer |
| A-24 | The signing page asks the server to restore a sender's login on every visit and logs a harmless error. Skip that call on signer and public pages. | 3 |
| A-25 | The fill-in screen reaches signers by email only. Add mobile number and WhatsApp or SMS, as the ordinary send screen has. | 4 |
| A-26 | Your decision: may Free accounts fill in the Starter templates by answering questions? Allowed today. | You |
| A-27 | The Business tier is defined in the plan table but no plan buys it yet; it arrives with the new plans (P4-13) and workspaces for teams (phase 5). | 4 |
| A-28 | Text in Indian scripts makes PDFs about 150 KB a page. Fine for a few pages; look again before offering long templates in those scripts. | Later |
| A-29 | Public template pages are written when the client is built, from the API's list at that moment. A template published or reviewed later gets its page only at the next build. Trigger a client rebuild from the admin app when a template is published, reviewed or retired (a deploy hook). | 4 |
| A-30 | The public template pages and the fill-in screen are in English only. Translate them with the other sender screens. | With P4-12 |
| A-31 | Your decision: the prices the code proposes beyond Free and Pro (yearly Pro, extra-document packs, message prices, the Enterprise "from" price). All are in `server/src/config/plans.js`. | You |
| A-32 | Razorpay checkout is written but has never met Razorpay: order creation and the payment window need a test-mode trial. The old Stripe checkout, which charged in dollars, was removed; Stripe's webhook handlers remain. | Before billing is switched on |
| A-33 | A plan bought today is prepaid for one month or year and does not renew by itself. Automatic renewal needs Razorpay Subscriptions with a UPI or card mandate (the rest of P2-14). | 2 |
| A-34 | An accountant should confirm the GST treatment in invoices, and whether wallet credit should be invoiced when bought or when spent. | Before billing is switched on |
| A-35 | Run `npm run migrate` as a step of every deploy. | First deploy |
| A-36 | The billing page is in English only, and has no "cancel plan" because plans do not renew. Revisit both with A-33. | 4 |

---

## 7. Production configuration (current and correct)

### Secrets, in Google Secret Manager

| Name | What it is | How to create |
| --- | --- | --- |
| `MONGO_URI` | Database connection string | From Atlas, after changing the password |
| `JWT_ACCESS_SECRET` | Signs login tokens | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Signs refresh tokens | `openssl rand -hex 32` |
| `ADMIN_SECRET_KEY` | Typed at admin login | `openssl rand -hex 32` |
| `ADMIN_JWT_SECRET` | Signs admin sessions; must differ from the access secret | `openssl rand -hex 32` |
| `AUDIT_HMAC_KEY` | Keys the audit log's hash chain. Never change it once in use. | `openssl rand -hex 32` |
| `SEAL_P12_BASE64` | Certificate that seals completed PDFs | `npm --prefix server run seal:generate` |
| `SEAL_P12_PASSWORD` | Password for that certificate | Printed by the same command |
| `INTERNAL_JOB_SECRET` | Lets the scheduler call the internal endpoints | `openssl rand -hex 32` |
| `SMTP_USER` | Mail account | From your mail provider |
| `SMTP_PASS` | Mail password | From your mail provider |

The server refuses to start in production if any of these is missing, apart from the certificate password and the two mail values. It also refuses known placeholder values, and token secrets shorter than 32 characters.

### Plain settings, as GitHub repository variables

The deploy stops with a message naming the variable if one of these four rows is missing.

| Name | Example |
| --- | --- |
| `CORS_ORIGIN` | `https://app.pactdoc.com,https://admin.pactdoc.com` (exact origins, never `*`) |
| `APP_URL` | `https://app.pactdoc.com` |
| `GCS_BUCKET_NAME` | your bucket name |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | from your mail provider |

Optional variables, passed to the server only when they have a value:

| Name | What it does |
| --- | --- |
| `BILLING_ENABLED` | `true` switches paid plans on. Off by default in production |
| `RAZORPAY_KEY_ID` | Sells plans, extra documents and wallet credit through Razorpay. Needs the two Razorpay secrets below |
| `SELLER_LEGAL_NAME`, `SELLER_ADDRESS`, `SELLER_GSTIN`, `SELLER_STATE_CODE` | Printed on invoices. Without a GST number, receipts are issued |
| `API_URL` | The API's public address, for example `https://api.pactdoc.com`. Needed for single sign-on |
| `TEMPLATES_ALLOW_UNREVIEWED` | `true` shows templates no lawyer has reviewed. Leave unset for real customers |
| `USAGE_CHARGING_ENABLED` | Takes each SMS or WhatsApp message from the sender's wallet. On by default in production |
| `MESSAGING_ENABLED`, `MESSAGING_PROVIDER` | SMS and WhatsApp. Leave unset: only development providers exist |
| `SIGNING_LINK_TTL_DAYS`, `FILE_URL_TTL_SECONDS`, `TRUST_PROXY` | Defaults are 30, 3600 and 1 |
| `OPTIONAL_SECRETS` | The names of the optional secrets you have created, separated by commas |

Optional secrets, in Secret Manager like the others. The deploy mounts only the ones named in `OPTIONAL_SECRETS`, because asking for a secret that does not exist fails the deploy.

| Name | What it is |
| --- | --- |
| `RAZORPAY_KEY_SECRET` | The secret half of the Razorpay key |
| `RAZORPAY_WEBHOOK_SECRET` | The passphrase you type when adding the webhook in Razorpay |
| `DATA_ENCRYPTION_KEY` | Encrypts two-step sign-in keys and single sign-on secrets. `openssl rand -hex 32`. Set it before the first user switches two-step sign-in on, and never change it: without it the audit key is used, and changing either makes what was encrypted unreadable |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Not needed: nothing in the app takes a Stripe payment today (section 10, step 9) |
| `FILE_URL_SECRET` | Signs file links. Defaults to the access secret |

Until 11 October 2026 the deploy passed none of the optional settings, so the Razorpay keys could not have reached the server whatever was configured. It also listed the plain settings on the command line in a way that broke on a sender address containing `@`. Both are fixed in `.github/workflows/deploy-backend.yml` and `.github/scripts/cloud_run_settings.py`; the script has been run locally, the workflow has not yet run on GitHub.

`ESIGN_PROVIDER` is deliberately not passed: Aadhaar eSign is postponed.

### Scheduler jobs

Each sends a `POST` with the header `X-Internal-Secret: <INTERNAL_JOB_SECRET>`.

| Path | How often |
| --- | --- |
| `/api/internal/jobs/run` | Every minute |
| `/api/internal/cron/reminders` | Every 4 hours |
| `/api/internal/cron/expirations` | Hourly |
| `/api/internal/cron/subscriptions` | Hourly |
| `/api/internal/cron/retention` | Daily. It erases files for good: give it a dry run first (not built yet) |

### Web apps

Both use `VITE_API_BASE_URL`, set to the API's address without `/api` (for example `https://api.pactdoc.com`). The app and the API must share a parent domain, or sign-in will not survive a page reload.

The client build (`npm run build`) now does two things: it builds the app, then writes the public pages out as HTML. In `client/dist`, `index.html` is the landing page, `pricing/`, `verify/` and `userguide/` hold the other public pages, and `app.html` is the empty shell for everything else. The host must send unknown paths to `/app.html`; `client/vercel.json` does this. Set `VITE_SITE_URL` if the public address is not `https://pactdoc.com`: it is used for canonical links and the sitemap. While it builds, the client asks the API at `VITE_API_BASE_URL` which templates are on offer and writes a page for each; if the API cannot be reached the build still succeeds, prints a warning, and leaves the template pages out.

### Payment webhooks

`/api/webhooks/stripe` and `/api/webhooks/razorpay`. Both reject unsigned requests, and reject everything when no webhook secret is configured.

---

## 8. What changed for people using the app

- Everyone is signed out once when this ships, because sessions are stored differently.
- New passwords need 10 characters. New accounts must confirm their email before sending documents.
- A document that is out for signature cannot be re-sent or deleted; void it first.
- Signers must tick the consent box, and the server now checks it.
- Signing links expire after 30 days.
- Completed documents download as a sealed copy with the signing record attached.
- Deleting a document hides it but keeps its audit log.
- Paid plans cannot be bought in production until billing is switched on.
- The Free plan allows 5 documents a month (it was 15), and Pro allows 50 (it was unlimited). Bulk send counts against the allowance. An account that already paid for an unlimited period keeps it until that period ends.
- The lifetime plan can no longer be bought. Accounts that have it keep Pro features and unlimited documents.
- Extra documents can be bought in packs on any plan, and are kept until used.
- There is a billing page (`/billing`) with usage, extra documents, wallet, invoice details and invoices. Prices everywhere are in rupees.
- The product is called PactDoc everywhere in the apps and emails. Signatures and contacts saved in the browser under the old name are not carried over.
- Senders can choose each signer's language (English or Hindi) and can send by SMS or WhatsApp once a provider is connected.
- Typed names and values in Indian scripts now appear in the signed PDF. They are drawn as shapes, so they cannot be selected or copied.
- A signer who was sent the document in Hindi sees every screen in Hindi and can switch language on the page. Their signing record carries Hindi headings beside the English.
- On a phone, the signing page fits the screen and its main button sits in a bar at the bottom.
- Signers can no longer move or resize fields.
- A date field shows the day of signing, written as 11 Oct 2026. Senders see it empty when placing it.
- The ready-made signature stamp now reads "Electronically signed" with the date, and makes no other claim.
- Signatures and initials have no placeholder name any more: a signer with no name on file must type one.
- The template library is new. A template is filled in by answering questions and sent from one screen; the old "copy to my templates" and "use now" buttons on ready-made templates are gone, along with the 14 old templates themselves.
- Free accounts can use the eight Starter templates. The other packs show which plan opens them.
- One bulk send reaches at most 25 recipients on Pro.
- In production the template library is empty until a lawyer's review is recorded against a template. That is done on the admin app's new Templates page, which also creates, versions, publishes and retires templates.
- The server now needs Node 22.
- Documents sent from a Free account show "Signed with PactDoc" in their emails and on the finished signing page.
- Anyone can browse the templates on offer at `/t` without an account. Signing up from a template page leads straight to that template after sign-in.

---

## 9. Later phases

Full task lists are in `PACTDOC_IMPLEMENTATION_PLAN.md`. Each phase is gated by something outside the code.

| Phase | Tasks | First thing to settle | Outside dependency |
| --- | ---: | --- | --- |
| 3. India fit | 14 (9 done, 3 partly) | The code is done. What is left waits on others: a messaging provider (P3-07, P3-08), translators for six more languages (P3-05), the Mumbai move (P3-11), cloud names and DNS for the rename (P3-12). | SMS sender registration, WhatsApp business verification, translators, DNS, Mumbai move |
| 4. Templates and plans | 17 (13 done, 3 partly) | The code is done and the Rentals and housing-society packs are drafted. What is left is the Hindi versions (P4-12) and the lawyer's review of every template. | Lawyer for template packs; tax registration for invoices |
| 5. Teams | 11 (9 done, 2 partly) | The code is done and tested. What is left: a first Razorpay payment for a seat plan, and the lawyer's review of the HR and professional packs. | Lawyer |
| 6. Strong signatures and API | 15 (4 done, 10 partly) | The API side is done and tested. Aadhaar eSign is postponed to the next version (section 5b). | Provider contract; registered business |

Market order agreed on 11 October 2026: India first; then the Middle East, South-East Asia and Japan; then Europe and the US. The later markets need right-to-left and CJK text, which should be kept in mind when the font and translation work is done in phase 3.

---

## 10. Setting up each outside service, step by step

This replaces the older "credentials playbook", which had the wrong setting names, addresses and prices. Every name and address below was checked against the code on 11 October 2026. The steps inside each provider's own dashboard are from memory of those dashboards and their menus change, so follow the intent where a label differs.

**Do these in order.** Each step says what you end up holding and where it goes: a *secret* goes into Google Secret Manager, a *variable* into the GitHub repository's variables (Settings, then Secrets and variables, then Actions, then Variables). Never paste a secret into a file in the repository, a chat or a document.

| Step | Service | You end up with | Needed for |
| --- | --- | --- | --- |
| 1 | Domain | `pactdoc.com` | Everything public |
| 2 | GitHub | A private repository with its variables | Deploying |
| 3 | MongoDB Atlas | `MONGO_URI` | The server starting |
| 4 | Google Cloud | The secrets, a bucket, scheduler jobs | The server starting |
| 5 | Email | `SMTP_*` and DNS records | Signing emails |
| 6 | Seal certificate | `SEAL_P12_BASE64`, `SEAL_P12_PASSWORD` | The server starting |
| 7 | Vercel | The app and the admin app online | People using it |
| 8 | Razorpay | Three values and a webhook | Taking money |
| 9 | Stripe | Nothing yet | Not used today |
| 10 | First run | Migrations run, an admin account | Operating it |

### Step 1: the domain

1. Buy `pactdoc.com` at any registrar.
2. Decide the three addresses. The rest of this document assumes:
   - `app.pactdoc.com` for the app (it also serves the landing, pricing and template pages),
   - `api.pactdoc.com` for the server,
   - `admin.pactdoc.com` for the admin app.
3. Point `pactdoc.com` and `www.pactdoc.com` at the app as well, as redirects to `app.pactdoc.com`. If you would sooner have the site on the bare domain, use `https://pactdoc.com` wherever `app.pactdoc.com` appears below, in `APP_URL`, `CORS_ORIGIN` and `VITE_SITE_URL` alike. Pick one: an address people sign in on must be in `CORS_ORIGIN`.

The app and the server must share the parent domain (`pactdoc.com`), or sign-in does not survive a page reload.

### Step 2: GitHub

1. Make the repository private: Settings, General, Danger Zone, Change visibility. Do this first.
2. Add these variables:

   | Variable | Value |
   | --- | --- |
   | `APP_URL` | `https://app.pactdoc.com` |
   | `CORS_ORIGIN` | `https://app.pactdoc.com,https://admin.pactdoc.com` |
   | `GCS_BUCKET_NAME` | the bucket from step 4 |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | from step 5 |
   | `API_URL` | `https://api.pactdoc.com` |

3. Protect `main`: Settings, Branches, add a rule requiring a pull request and the CI checks.

The link that lets GitHub deploy to Google Cloud without a key file already exists in the workflow. `docs/DEPLOYMENT_GUIDE.md` describes how it was made, should it need making again in a new project.

### Step 3: MongoDB Atlas

1. In [Atlas](https://cloud.mongodb.com), create a cluster on a tier that has backups. The free tier has none and is for development only.
2. Put it in the same region as the server. The workflow deploys to `us-central1` today; the move to Mumbai is plan task P3-11, and the database should move with it.
3. Database Access: create a user with a generated password and read-write access to one database only.
4. Network Access: Cloud Run has no fixed outbound address on the cheapest set-up, so access from anywhere is the usual choice. That leaves the password as the only barrier, so keep it long and change it if it is ever exposed.
5. Connect, Drivers: copy the connection string, put the password in, and name the database at the end, for example `.../pactdoc_prod?retryWrites=true&w=majority`.
6. Store it as the secret `MONGO_URI` (step 4).
7. Turn backups on and restore one once, to a scratch cluster, before any customer's data is in it.

### Step 4: Google Cloud

The project and the deploy link already exist (their ids are at the top of the workflow). What is left:

1. Enable the APIs: Cloud Run, Artifact Registry, Secret Manager, Cloud Scheduler, Cloud Storage.
2. Create the bucket for documents: uniform access control, public access prevention on, same region as the server. Its name is the variable `GCS_BUCKET_NAME`.
3. Give the account the service runs as two roles: Storage Object Admin on that bucket, and Secret Manager Secret Accessor. No key file is needed or wanted.
4. Create the secrets. The eleven the server needs are in section 7. For a random one:

   ```
   openssl rand -hex 32 | tr -d '\n' | gcloud secrets create JWT_ACCESS_SECRET --data-file=-
   ```

   Repeat for `JWT_REFRESH_SECRET`, `ADMIN_SECRET_KEY`, `ADMIN_JWT_SECRET`, `AUDIT_HMAC_KEY` and `INTERNAL_JOB_SECRET`, each with its own value. Create `DATA_ENCRYPTION_KEY` the same way and name it in the variable `OPTIONAL_SECRETS`. Write `ADMIN_SECRET_KEY` down somewhere safe: you type it when signing in to the admin app.
5. After the first deploy, map `api.pactdoc.com` to the service (Cloud Run, Manage custom domains) and add the DNS record it shows you.
6. Create the scheduler jobs. Each is a POST with one header; the four to create now are in section 7. For example:

   ```
   gcloud scheduler jobs create http pactdoc-jobs --location=us-central1 \
     --schedule="* * * * *" --http-method=POST \
     --uri="https://api.pactdoc.com/api/internal/jobs/run" \
     --headers="X-Internal-Secret=THE_VALUE_OF_INTERNAL_JOB_SECRET"
   ```

   Leave the retention job out until it has a dry-run mode.

### Step 5: email

1. Choose a transactional email service that gives SMTP details. A personal Gmail account is fine for trying things and will be rate-limited and marked as spam in real use.
2. In it, verify `pactdoc.com` as a sending domain. It gives you DNS records: add the SPF and DKIM records it shows, and a DMARC record starting at `v=DMARC1; p=none; rua=mailto:you@pactdoc.com`.
3. Variables: `SMTP_HOST`, `SMTP_PORT` (587 or 465), `SMTP_FROM` (for example `PactDoc <noreply@pactdoc.com>`).
4. Secrets: `SMTP_USER` and `SMTP_PASS`.
5. Create the mailbox `sales@pactdoc.com`: the pricing page's "Talk to us" button writes to it.

### Step 6: the certificate that seals signed PDFs

1. On your own machine: `npm --prefix server run seal:generate`. It prints two values.
2. Store them as the secrets `SEAL_P12_BASE64` and `SEAL_P12_PASSWORD`. Run it once for staging and once for production; do not reuse one in the other.

This certificate is one you issue yourself, so PDF readers show the seal as valid but from an unknown signer. A certificate from a recognised authority is a later purchase.

### Step 7: Vercel, for the two web apps

1. Import the repository twice, as two projects.
2. The app: root directory `client`, framework Vite, build command `npm run build`, output `dist`. Environment variables:
   - `VITE_API_BASE_URL` = `https://api.pactdoc.com` (no path after it),
   - `VITE_SITE_URL` = `https://app.pactdoc.com` (used for the sitemap and canonical links).
   Add the domain `app.pactdoc.com`, and `pactdoc.com` and `www.pactdoc.com` as redirects to it.
3. The admin app: root directory `admin`, framework Vite. One variable, `VITE_API_BASE_URL`, the same value. Add the domain `admin.pactdoc.com`.
4. Add the DNS records Vercel shows for each domain. If the DNS is at Cloudflare, set those records to "DNS only" so Vercel can issue its certificates.
5. Deploy the server first. The app's build asks the server which templates are on offer and writes a page for each; if the server is not up, the build still succeeds and the template pages are left out until the next build.

Neither app needs a Razorpay or Stripe key: the server hands the app what it needs when a payment starts.

### Step 8: Razorpay

Do the whole of this in Razorpay's **test mode** first. It has never been run against Razorpay (item A-32).

1. Create the account at [Razorpay](https://dashboard.razorpay.com). Test mode works at once; live mode needs their KYC: business details, PAN, bank account, and a site with terms, privacy and refund pages.
2. Account and Settings, API Keys, generate a key (in test mode, a test key).
   - Key Id (`rzp_test_...`, later `rzp_live_...`): the variable `RAZORPAY_KEY_ID`.
   - Key Secret: the secret `RAZORPAY_KEY_SECRET`.
3. Account and Settings, Webhooks, add a webhook.
   - URL: `https://api.pactdoc.com/api/webhooks/razorpay`
   - Secret: make one up (`openssl rand -hex 32`) and store the same value as the secret `RAZORPAY_WEBHOOK_SECRET`.
   - Events: tick `payment.captured`. It is the one that grants what was bought.
4. Variables: `BILLING_ENABLED` = `true`, and `OPTIONAL_SECRETS` = `RAZORPAY_KEY_SECRET,RAZORPAY_WEBHOOK_SECRET` (add `DATA_ENCRYPTION_KEY` to the list if you made it in step 4).
5. Deploy. The deploy refuses to go ahead if the key id is set and either secret is not named.
6. Try it: sign in to the app, open Billing, buy 10 extra documents with one of Razorpay's test cards. Within a few seconds the documents should appear, and an invoice under Invoices. If the payment succeeds and nothing appears, look at the webhook's delivery log in Razorpay: a 4xx means the webhook secret does not match.
7. Only then generate live keys, replace the two key values, and add a second webhook in live mode with the same URL and a new secret.

How a payment is granted, so you can reason about a problem: the server creates an order at Razorpay and writes on it who is buying and what. When Razorpay reports the payment captured, the server reads that order back from Razorpay and grants what the order says, only if the amount paid equals the price. What the browser claims is ignored.

Plans bought this way are prepaid for one period and do not renew by themselves. Razorpay Subscriptions (automatic renewal) are not wired up (item A-33).

### Step 9: Stripe

Nothing to set up. Stripe was the plan when prices were in dollars; with the India-first plans in rupees, checkout goes through Razorpay only, and nothing in the app can start a Stripe payment. The server still has an endpoint that understands Stripe's notices (`/api/webhooks/stripe`), and it answers 503 until `STRIPE_WEBHOOK_SECRET` is set. Leave both Stripe secrets unset.

When you sell outside India, Stripe needs building, not just configuring: prices in other currencies, a Stripe checkout, and tax handling for each market. That is a task for the phase after India.

### Step 10: the first run

1. Push to `main` (or run the workflow by hand). The tests run first; nothing deploys if they fail.
2. Open `https://api.pactdoc.com/api/health`. It should answer `{"status":"ok"}`. If the service will not start, its log names the setting that is missing or still a placeholder.
3. Run the data migrations once, from your machine, against the production database, after a backup:

   ```
   MONGO_URI="the production connection string" npm --prefix server run migrate
   ```

   They are not run by the deploy (item A-35).
4. Create the admin account:

   ```
   MONGO_URI="the production connection string" npm --prefix server run seed:admin -- --email=you@pactdoc.com --password="at least 12 characters"
   ```

   Sign in at `https://admin.pactdoc.com` with that email and password and the `ADMIN_SECRET_KEY` value.
5. In the app, sign up, upload a PDF, send it to yourself, sign it, and download the sealed copy.
6. Open `/`, `/pricing` and a signing link on the live site and confirm each shows the right page (item A-21).

### Not available to set up yet

| Service | State |
| --- | --- |
| SMS and WhatsApp | The code can send through a provider, but no commercial provider is written. Needs a provider, sender registration and approved message templates (P3-07, P3-08) |
| Aadhaar eSign | Postponed to the next version: section 5b |
| Single sign-on | Nothing to set up on your side beyond `API_URL` and `DATA_ENCRYPTION_KEY`. Each Enterprise customer enters their own identity provider's details on their team page |
| Analytics, Search Console | The notes in the appendix still apply; nothing in the code depends on them |

---

## Appendix: earlier reference material

Everything below was written before the October 2026 audit and has **not been re-verified**. It is kept for its notes on backups, monitoring and search. The account set-up steps that sat here were wrong in many details and have been replaced by section 10; the old text is in the repository's history. Where this appendix disagrees with the sections above, the sections above are right.

Known corrections to what remains:

| The appendix says | Correct |
| --- | --- |
| Everything runs at $0.00 a month | True for a demo only. Production needs a database tier with backups and a transactional email service. |
| Domain `signaturly.pro`, product "Signaturly" | The product is PactDoc, at `pactdoc.com` |
| "Section 65B" certificates | The current law is Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 |
| Env names starting `EMAIL_`, and `VITE_API_URL` | The code reads `SMTP_*` and `VITE_API_BASE_URL` |

## 🗄️ 2. Automated Cold Backups & Snapshot Strategy (GCS Coldline / AWS Glacier)

To prevent data loss and meet legal compliance for Section 65B audit retention:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AUTOMATED BACKUP & SNAPSHOT CADENCE                                    │
├───────────────────┬─────────────────────────┬──────────────────────────┬───────────────────────────────┤
│ Backup Type       │ Frequency               │ Storage Target           │ Retention Policy              │
├───────────────────┼─────────────────────────┼──────────────────────────┼───────────────────────────────┤
│ 📦 Daily DB Dump  │ Every 24h (02:00 UTC)   │ GCS Coldline / S3 Bucket │ Retained for 7 Days (Auto-del)│
│ 🗃️ Weekly Snapshot│ Every Sunday (03:00 UTC)│ GCS Archive / S3 Glacier │ Retained for 90 Days          │
│ 📄 PDF Contract   │ Real-time upon signing  │ GCS Standard + SHA-256   │ Permanent Legal Vault         │
└───────────────────┴─────────────────────────┴──────────────────────────┴───────────────────────────────┘
```

### Automated Backup Script (`server/src/scripts/backup-db.sh`):
```bash
#!/bin/bash
# Stream compressed MongoDB dump directly to Google Cloud Storage (Zero local disk waste)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="signaturly_backup_${TIMESTAMP}.gz"

echo "Starting automated MongoDB backup..."
mongodump --uri="$MONGO_URI" --archive --gzip | gsutil cp - gs://signaturly-backups-coldline/daily/$BACKUP_NAME

# Auto-cleanup daily dumps older than 7 days
gsutil -m rm $(gsutil ls gs://signaturly-backups-coldline/daily/*.gz | head -n -7) 2>/dev/null || true
echo "Backup ${BACKUP_NAME} uploaded to GCS Coldline successfully."
```
* **Cost**: Storing 50 DB snapshots in GCS Coldline costs **less than $0.01 / month**.

---

## 📊 3. Essential DevOps: The 5 Core Metrics That Actually Matter

Rather than tracking dozens of noisy charts, focus on **5 essential signals** using 100% free built-in dashboards:

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ 1. UPTIME & HEALTH      │ 2. LATENCY (SPEED)      │ 3. ERROR RATE (5xx)     │ 4. SERVER RAM / CPU     │ 5. EMAIL & PAYMENTS     │
├─────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ Target: ≥ 99.9%         │ p95 Target: < 300ms     │ Target: < 0.1% errors   │ RAM: < 400 MB           │ Delivery: ≥ 99%         │
│ Checked via Cloudflare  │ Checked via Cloudflare  │ Checked via Cloudflare  │ Checked via Cloud Run   │ Checked via Node Logs & │
│ /api/health probe       │ & Cloud Run Metrics     │ & Server Logs           │ Console Metrics         │ Stripe Webhooks         │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### 🎯 Key Metrics & Where to Check Them (100% Free):

| Metric | Target / Good | Warning Threshold | Where to Check It (Zero-Cost Dashboard) |
| :--- | :---: | :---: | :--- |
| **Site Availability (Uptime)** | `99.9%` | `< 99.5%` | **Cloudflare Free Health Checks** or **UptimeRobot Free** (Pings `/api/health` every 5 min) |
| **p95 Latency (Response Time)** | `< 300ms` | `> 1.5s` | **Cloudflare Dashboard** → Analytics → HTTP Traffic → Performance (Origin Latency) |
| **Success Rate vs 5xx Errors** | `> 99.5% 2xx` | `> 0.5% 5xx` | **Cloudflare Dashboard** → Analytics → Status Codes (Pie chart of 2xx/4xx/5xx) |
| **Cloud Run RAM Utilization** | `< 400 MB` | `> 800 MB` | **GCP Cloud Run Console** → `signaturly-api` → Metrics tab (Container Memory) |
| **Active DB Connections** | `5 - 15 conns` | `> 35 conns` | **MongoDB Atlas Dashboard** → Cluster0 → Metrics → Connection Count |
| **Email Relay Status** | `100% Sent` | `< 98.0%` | **In-House Node Logs** (GCP Cloud Logging / PM2 logs) |
| **Stripe/Razorpay Webhooks** | `100% Success` | `< 98.0%` | **Stripe Dashboard** → Developers → Webhooks → Delivery Success Rate |
| **Signed Envelopes Volume** | *Live Tracking* | — | **Signaturly In-House Admin Portal** (`/admin/dashboard` or `GET /api/v1/analytics/summary`) |

---

## ☀️ 4. Production DevOps & Infrastructure Monitoring Framework

> **Operational Distinction**: Business, User Growth, Subscriptions, and Envelope KPIs are already monitored in real-time inside the **In-House Admin Portal** (`/admin/dashboard`). 
> 
> The **DevOps Master Framework & Spreadsheets** focus exclusively on **Systems Engineering, Compute/Container Health, Edge Traffic, Database/Storage Quotas, Security, Releases, Incidents, and Cloud Cost (₹)** across discrete **24-hour audit windows**.

---

### 🏛️ The 6 Core DevOps & Infrastructure Monitoring Layers

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              DEVOPS & INFRASTRUCTURE OBSERVABILITY                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: COMPUTE & DOCKER RUNTIME    → GCP Cloud Run, Ops Agent, Container CPU/RAM, Restarts, OOM   │
│  Layer 2: EDGE NETWORK & API TRAFFIC  → Cloudflare Requests, RPS, p50/p95/p99 Latency, 2xx/4xx/5xx %  │
│  Layer 3: DATABASE & STORAGE CAPACITY → MongoDB Atlas Connections, Query Latency, GCS Vault Storage    │
│  Layer 4: BACKUPS & DISASTER RECOVERY → Automated GCS Coldline Snapshots, RPO, Verification Status     │
│  Layer 5: SECURITY, RELEASES & WAF    → Cloudflare Threat Mitigation, Rate Limits, Docker Git SHA      │
│  Layer 6: RELIABILITY, SLA & FINANCES → 24h Uptime %, Incidents (P0/P1), Daily Prorated Spend (₹0.00)  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 📋 Detailed DevOps Metric Taxonomy & Data Sources

#### 1. ⚙️ Compute & Docker Container Health (GCP Cloud Run / Ops Agent)
| Metric Field | 24h Aggregation | What It Tracks & Why It Matters | Healthy Target | Warning Trigger | Telemetry Source |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`CPU Avg %`** | Mean over 24h | Container background processing baseline | `< 15.0%` | `> 60.0%` | GCP Cloud Run / Ops Agent |
| **`CPU Peak %`** | Max 1-min spike | Peak compute during heavy PDF rendering / signing | `< 40.0%` | `> 80.0%` | GCP Cloud Monitoring Spike |
| **`RAM Avg %`** | Mean over 24h | Average working set memory consumption | `< 35.0%` | `> 70.0%` | GCP Cloud Run Container RAM |
| **`RAM Peak %`** | Max memory used | Buffer surge during multi-page PDF uploads | `< 50.0%` | `> 85.0%` (OOM risk) | Container Working Set Bytes |
| **`System Load`** | 24h Rolling | OS kernel process scheduling queue pressure | `< 1.5` | `> 4.0` | Ops Agent `system/cpu/load` |
| **`File Descriptors`**| Peak in 24h | Open socket & file handles used by Node.js | `< 250` | `> 800` (Leak risk) | Node `getActiveResourcesInfo` |
| **`Container Restarts`**| 24h Count | Count of container crash-loops | **`0`** | **`≥ 1`** (Critical P1) | Docker Engine / Cloud Run |
| **`OOMKilled Events`**| 24h Count | Linux kernel Out-Of-Memory terminations | **`0`** | **`≥ 1`** (Critical P0) | Container Exit Code `137` |
| **`Active Instances`**| Min / Max / Avg | Auto-scaling container count (Scale-to-Zero) | `0 (idle) - 2` | `> 5` (Cost alert) | GCP Cloud Run Service Metrics |

---

#### 2. 🌐 Edge Network, Traffic & Latency (Cloudflare Analytics)
| Metric Field | 24h Aggregation | What It Tracks & Why It Matters | Healthy Target | Warning Trigger | Telemetry Source |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`Total Requests`** | 24h Total Count| Total HTTP transactions across all endpoints | — | Sudden 50% drop/spike | Cloudflare Traffic Analytics |
| **`Throughput (RPS)`**| Avg & Peak 24h | Real-time traffic load and traffic spikes | `5 - 50 RPS` | `> 200 RPS` | Cloudflare Edge Analytics |
| **`Traffic Ingress (MB)`**| 24h Sum | Inbound data transfer (PDF uploads) | Baseline | `> 3x daily avg` | Cloudflare / GCP Network In |
| **`Traffic Egress (MB)`** | 24h Sum | Outbound data transfer (signed PDF downloads) | Baseline | `> 3x daily avg` | Cloudflare / GCP Network Out |
| **`P50 Latency (ms)`** | Median 24h | Median user-experienced API response time | `< 80 ms` | `> 250 ms` | Cloudflare Origin Performance |
| **`P95 Latency (ms)`** | 95th Percentile | Response time for 95% of API requests | `< 250 ms` | `> 800 ms` | Cloudflare Origin Latency p95 |
| **`P99 Latency (ms)`** | 99th Percentile | Tail latency during multi-party PDF signing | `< 600 ms` | `> 2000 ms` | Cloudflare Origin Latency p99 |
| **`2xx Success Count`**| 24h Sum | Successful HTTP responses (`200 OK`, `201 Created`)| `> 99.5%` | `< 98.0%` | Cloudflare Status Codes |
| **`4xx Client Errors`**| 24h Sum & % | Client errors (`400 Bad Request`, `401 Auth`) | `< 1.0%` | `> 5.0%` | Express Middleware Logs |
| **`5xx Server Errors`**| 24h Sum & % | Fatal backend exceptions (`500 Crash`, `502`) | **`0.00%`** | **`> 0.10%`** (Critical) | Cloudflare Status Codes / PM2 |

---

#### 3. 🗄️ Database & Storage Capacity (MongoDB Atlas M0 + GCS Vault)
| Metric Field | 24h Aggregation | What It Tracks & Why It Matters | Healthy Target | Warning Trigger | Telemetry Source |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`DB Health Status`**| Current / 24h | MongoDB cluster availability & node health | **`Healthy (ok: 1)`**| **`Degraded / Down`** | MongoDB Atlas Status Probe |
| **`Active DB Conns`** | Avg & Peak 24h | Active connections in pool (M0 limit: 500) | `5 - 20 conns` | `> 50 conns` | MongoDB Atlas Metrics |
| **`Avg Query Latency`**| Mean over 24h | Database query execution time | `< 15 ms` | `> 80 ms` | MongoDB Profiler |
| **`Slow Queries (>100ms)`**| 24h Sum | Unindexed or slow database queries | `< 5` | `> 25` | Atlas Performance Advisor |
| **`Failed Queries`** | 24h Sum | Write collisions, connection drops, timeouts | **`0`** | **`≥ 1`** | MongoDB Node Driver Logs |
| **`Atlas Storage %`** | Current % Used | MongoDB Atlas Free Tier storage (512 MB quota)| `< 40.0%` | `> 70.0%` (358 MB) | Atlas Cluster Storage Metric |
| **`GCS Storage (MB)`** | Current Total | Total encrypted PDF storage in GCS Vault | `< 2,500 MB` | `> 4,500 MB` (5GB free)| Google Cloud Storage Console |
| **`GCS Operations`** | 24h Class A & B | Storage upload/download API operations | Within free limit| `> 80% free quota` | GCP Storage Metrics |

---

#### 4. 🛡️ Security, CI/CD Releases & Backups
| Metric Field | 24h Aggregation | What It Tracks & Why It Matters | Healthy Target | Warning Trigger | Telemetry Source |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`Backup Status`** | Daily Status | Overnight automated MongoDB dump to GCS Coldline | **`Success`** | **`Missing / Failed`** | GCS Coldline Vault Log |
| **`WAF Blocked Threats`**| 24h Sum | Malicious SQLi, XSS, bots & DDoS blocks | Baseline | `> 500 / hr` (Attack) | Cloudflare Security Events |
| **`Rate-Limited IPs`** | 24h Count | Abusive actors blocked by API rate limiters | `< 10` | `> 100` | Express Rate-Limit / Cloudflare |
| **`Deployments`** | 24h Tag / SHA | Production releases deployed via CI/CD | `Git SHA` or `None`| Failed deploy | GitHub Actions CI/CD |
| **`Docker Image Digest`**| Current SHA | Immutable container digest running in prod | Verified SHA | Untracked image | GCP Artifact Registry |

---

#### 5. ⏱️ Reliability, SLA, Incidents & Infrastructure Cost
| Metric Field | 24h Aggregation | What It Tracks & Why It Matters | Healthy Target | Warning Trigger | Telemetry Source |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`Uptime %`** | 24h Availability | `(1 - (Downtime Seconds / 86400)) * 100` | **`≥ 99.90%`** | **`< 99.50%`** | Cloudflare / UptimeRobot |
| **`Incidents (P0/P1)`**| 24h Count | Customer-impacting outages or data issues | **`0`** | **`≥ 1`** (P0 Alert) | Incident Management Log |
| **`Downtime (mins)`** | 24h Minutes | Total minutes of unavailable service | **`0 mins`** | **`> 5 mins`** | Uptime Monitor Log |
| **`Daily Infra Cost`** | 24h Prorated Spend| Cloud hosting bill for the 24h period | **`₹0.00 / $0.00`** | **`> ₹0.00`** (Tier breach)| GCP Billing / Atlas Invoices |
| **`Month-to-Date Cost`**| Cumulative ₹/$ | Running total of infrastructure costs | **`₹0.00 / $0.00`** | `> Budget (₹800)` | Cloud Billing Consolidation |
| **`Overall Status`** | Composite State | High-level operational flag (`Green`/`OK`/`Yellow`/`Red`)| **`Green`** | **`Yellow` / `Red`** | Automated Evaluation Rule |

---

### 🏢 Multi-Project Organization & Scope

To ensure clear operational isolation, metrics are partitioned into **4 Project Tiers**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                PROJECT TIERS & COMPONENT ASSIGNMENTS                                   │
├────────────┬─────────────────────────────┬─────────────────────────────────┬───────────────────────────┤
│ Project ID │ Project Name                │ Runtime Environment             │ Scope & Responsibilities  │
├────────────┼─────────────────────────────┼─────────────────────────────────┼───────────────────────────┤
│ **PRJ-01** │ `signflow-backend-api`      │ GCP Cloud Run (Docker Container)│ Core REST API, PDF Engine,│
│            │                             │ Node.js 18 + Express + PM2      │ Auth, Email, Webhooks     │
├────────────┼─────────────────────────────┼─────────────────────────────────┼───────────────────────────┤
│ **PRJ-02** │ `signflow-frontend-web`     │ Vercel Global Edge Network      │ React/Vite Customer App,  │
│            │                             │ Global CDN + Edge Middleware    │ Admin Portal, Landing Page│
├────────────┼─────────────────────────────┼─────────────────────────────────┼───────────────────────────┤
│ **PRJ-03** │ `signflow-db-vault`         │ MongoDB Atlas M0 + GCS Bucket   │ Document Metadata, User DB│
│            │                             │ Coldline Encrypted Backup Vault │ PDF Vault, Daily Snapshots│
├────────────┼─────────────────────────────┼─────────────────────────────────┼───────────────────────────┤
│ **PRJ-ALL**│ `entire-platform-rollup`    │ Aggregated Platform Overview    │ Platform SLA, Global Rev, │
│            │                             │ End-to-End Holistic Health      │ Total Incidents, Cost (₹) │
└────────────┴─────────────────────────────┴─────────────────────────────────┴───────────────────────────┘
```

---

### 📊 Master Spreadsheet Reporting Schema

The operational tracking workbook (`DevOps_Master_Report_2026.xlsx`) structures these fields into 4 sheets:

#### 1. Sheet 1: Daily Check-up (24-Hour Windows — Days 1 to 30/31)
* **Columns**:
  `Date` | `Uptime %` | `CPU Avg %` | `CPU Peak %` | `RAM Avg %` | `Disk %` | `Traffic` | `Requests` | `Error %` | `P95 (ms)` | `DB Health` | `Backup` | `Security` | `Deployment` | `Incidents` | `Daily Cost (₹)` | `Status` | `Project ID`

#### 2. Sheet 2: Weekly Summary — All Projects (Weeks 1 to 5)
* **Columns**:
  `Project ID` | `Project Name` | `Week` | `Start Date` | `End Date` | `Avg Uptime %` | `Avg CPU %` | `Max CPU %` | `Avg RAM %` | `Max Disk %` | `Total Traffic` | `Total Requests` | `Avg Error %` | `Avg P95 (ms)` | `Incidents` | `Weekly Cost (₹)` | `Status` | `Weekly Summary / Trend` | `Action / Owner`

#### 3. Sheet 3: Monthly Summary — All Projects
* **Columns**:
  `Project ID` | `Project Name` | `Monthly Uptime %` | `Avg CPU %` | `Max CPU %` | `Avg RAM %` | `Max Disk %` | `Monthly Traffic` | `Monthly Requests` | `Avg Error %` | `Avg P95 (ms)` | `Total Incidents` | `Actual Cost (₹)` | `Budget (₹)` | `Expected Month-End Cost (₹)` | `Variance vs Budget (₹)` | `Variance %` | `Cost Status` | `Overall Status` | `Monthly Summary` | `Recommendation` | `Next Month Action`

#### 4. Sheet 4: Dated Notes / Actions Log
* **Columns**:
  `Date` | `Project ID` | `Project Name` | `Category` | `Observation / Issue` | `Impact` | `Action / Recommendation` | `Owner` | `Due Date` | `Status`

---

---

### ⚙️ How We Accomplish Data Collection & Where It Is Stored

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          END-TO-END DATA COLLECTION & STORAGE PIPELINE                                 │
├──────────────────────────────────┬─────────────────────────────────┬───────────────────────────────────┤
│ 1. DATA SOURCES (Collection)     │ 2. DAILY AGGREGATOR ENGINE      │ 3. STORAGE & REPORTING DESTINATION│
├──────────────────────────────────┼─────────────────────────────────┼───────────────────────────────────┤
│ • Cloudflare GraphQL API         │                                 │ 📄 PRIMARY: Google Sheets Live    │
│   (Traffic, Requests, Latency)   │ ⚙️ GitHub Actions Scheduled     │   (`DevOps_Master_Report_2026`)   │
│ • GCP Cloud Monitoring API       │    Workflow / Cloud Scheduler   │   (Color-coded, automated charts) │
│   (Cloud Run CPU, RAM, Restarts) │    Runs Daily at 00:01 UTC      │                                   │
│ • MongoDB Atlas Data API         │    Computes 24h Windows         │ 🗄️ DATABASE: MongoDB Collection   │
│   (DB Health, Connections, Size) │    (00:00:00 to 23:59:59 UTC)   │   `system_metrics_daily` (JSON)   │
│ • In-House Node Express Probes   │                                 │                                   │
└──────────────────────────────────┴─────────────────────────────────┴───────────────────────────────────┘
```

---

### 📥 1. How the 4 Automated Collectors Work (Data Ingestion)

1. **Cloudflare Edge Collector (`Collector_Cloudflare`)**:
   * Calls Cloudflare's GraphQL Analytics API using your free API Token and Zone ID.
   * Extracts total 24h request counts, status code distribution (`2xx`, `4xx`, `5xx`), `p50`/`p95`/`p99` origin latency, and blocked WAF security events.
2. **GCP Cloud Run Collector (`Collector_CloudRun`)**:
   * Calls Google Cloud Monitoring API (`projects.timeSeries.list`) using your GitHub Actions Workload Identity Federation (WIF).
   * Calculates 24h average CPU, 24h maximum 1-minute CPU peak, RAM working set bytes, container restart count, and active instance count.
3. **MongoDB Atlas Collector (`Collector_MongoDB`)**:
   * Pings MongoDB Atlas cluster for server status (`db.serverStatus()`).
   * Reads active connection pool count, slow query logs (>100ms), and storage footprint (out of 512 MB).
4. **Storage & Backup Collector (`Collector_Storage`)**:
   * Queries Google Cloud Storage for total encrypted PDF vault size (out of 5 GB free limit).
   * Inspects `gs://signflow-backups/mongodb-snapshots/` to verify if the previous night's backup archive timestamp exists and is verified (`Success` vs `Missing`).

---

### 💾 2. Where the Data Is Stored (Streamlined 2-Tier Strategy — MongoDB & GCP)

To achieve **100% zero-cost** and maximum simplicity with zero extra bucket maintenance, data is kept directly in your existing **MongoDB & GCP** infrastructure:

#### Tier 1: Primary Visual SRE Dashboard — **Google Sheets via Google Sheets API** (Live & Visual)
* **Format**: Google Sheets Workbook (`DevOps_Master_Report_2026`).
* **Why**:
  * **$0.00 Cost**: Zero server maintenance or database overhead.
  * **Instant Collaboration**: Accessible to engineers and stakeholders on mobile or desktop without custom frontend builds.
  * **Automated Formatting**: Conditional formatting automatically highlights `RED` for 5xx errors or `YELLOW` for high CPU peaks.
  * **Native Trend Charts**: Automatically plots 30-day uptime and latency trendlines without needing Grafana.

#### Tier 2: Historical Database Archive — **MongoDB `system_metrics_daily` Collection** (Direct Queryable API)
* **Format**: Structured JSON documents inside your existing MongoDB Atlas cluster.
* **Why**: Uses your existing MongoDB database directly without provisioning extra GCS coldline buckets or maintaining CSV export sync scripts. Fast to query from your admin portal or backend API.
* **Schema**:
  ```json
  {
    "date": "2026-09-28",
    "projectId": "PRJ-01",
    "projectName": "signflow-backend-api",
    "uptimePercent": 99.95,
    "cpuAvgPercent": 1.60,
    "cpuPeakPercent": 6.80,
    "ramAvgPercent": 6.30,
    "diskPercent": 25.20,
    "trafficMB": 225.1,
    "requestsCount": 5100,
    "errorPercent": 0.00,
    "p95LatencyMs": 120,
    "dbHealth": "Healthy",
    "backupStatus": "Success",
    "securityStatus": "Secure",
    "deployment": "None",
    "incidentsCount": 0,
    "dailyCostINR": 0.00,
    "status": "Green"
  }
  ```

---

### 🚀 3. Operational Execution Workflow (How It Runs Every Night)

```
00:01 UTC ──► GitHub Actions Cron Workflow Triggers
               │
               ├── 1. Queries Cloudflare API for yesterday's 24h traffic & latency
               ├── 2. Queries GCP Cloud Monitoring for container CPU & RAM
               ├── 3. Pings MongoDB Atlas for connection pool & storage metrics
               │
               ├── 4. Appends 1 Row to Google Sheets (`DevOps_Master_Report_2026`)
               ├── 5. Writes JSON document to MongoDB `system_metrics_daily`
               └── 6. Sends summary notification to Discord / Telegram / Slack webhook:
                      "🟢 Sep 28 DevOps Check: 99.95% Uptime | 0 Errors | ₹0.00 Spend"
```

---

## 🔍 5. SEO, Search Console, Web Analytics & Indexing

1. **🌐 Cloudflare Web Analytics (100% Free & Zero-Cookie)**:
   - **How it works**: Automatically tracks unlimited visitors, page views, visit duration, referrers, and top countries via Cloudflare Edge (Orange Cloud proxy) without injecting cookies or needing GDPR cookie popups.
   - **Setup**: In Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics** → Toggle **Enable** (Auto-injected by Edge Proxy or via beacon token).
2. **`client/public/robots.txt`** (Configured):
   - Allows search engines to index `/`, `/pricing`, `/compliance`, and `/verify`.
   - Protects private routes (`/dashboard`, `/editor/*`, `/workspaces`, `/sign/*`) from crawler exposure.
3. **`client/public/sitemap.xml`** (Configured):
   - Canonical `https://signaturly.pro/` URLs with weekly update frequencies.
4. **Google Search Console**:
   - Add site property `https://signaturly.pro` in [search.google.com/search-console](https://search.google.com/search-console).
   - Paste verification code into `client/index.html` (or verify via Cloudflare DNS TXT record).
   - Submit `https://signaturly.pro/sitemap.xml` in the Sitemaps tab.

---

## 🏷️ 7. Brand Name & Domain Suggestions (Replacing Taken `Signaturly.com`)

Because `signaturly.com` is already an existing commercial SaaS trademark, launching under an original, distinctive name protects against trademark infringement (USPTO conflicts) and improves search engine ranking.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 RECOMMENDED BRAND NAMES & DOMAIN STRATEGIES                                      │
├─────────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────────┤
│ Brand Name          │ Recommended TLD Domains       │ Brand Identity & Positioning                               │
├─────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 1. 🌊 **SignFlow**  │ `signflow.pro` / `signflow.app`│ Fast, modern e-signature workflows with zero friction.     │
│ 2. ⚡ **SignlyPro** │ `signlypro.com` / `signly.pro`│ Direct natural evolution, short, memorable, authoritative. │
│ 3. 🛡️ **DocSeal**   │ `docseal.pro` / `docseal.io`  │ Emphasizes legally sealed, tamper-evident documents.       │
│ 4. ⚖️ **LexSign**   │ `lexsign.pro` / `lexsign.legal`│ "Lex" (Latin for Law). Premium legal & enterprise prestige.│
│ 5. 🤝 **Pactly**    │ `pactly.pro` / `pactly.io`    │ "Pact" (Agreement/Contract). Friendly, modern B2B SaaS.    │
│ 6. 🔒 **SignVault** │ `signvault.pro` / `signvault.co`│ Highlights permanent Section 65B cold storage & security.  │
│ 7. ✨ **Sealify**   │ `sealify.pro` / `sealify.app` │ Modern tech startup feel (like Spotify, Shopify).          │
│ 8. 📜 **CertiSeal** │ `certiseal.pro` / `certiseal.io`│ Cryptographic SHA-256 certificate proof branding.          │
│ 9. ✒️ **InkSign**   │ `inksign.pro` / `inksign.io`  │ Minimalist, tactile, clean document execution.             │
│ 10. 🚀 **SignForge**│ `signforge.pro` / `signforge.dev`│ Developer-first REST API & automated signing pipelines.   │
└─────────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### 💡 Top 3 Recommendations & Why:

1. **`SignFlow` (`signflow.pro` / `signflow.app`)**
   - **Why it wins**: Highlights speed, signature queues, and seamless document routing. Sounds like a multi-million dollar SaaS brand (similar to Webflow, StackFlow).
   - **Tagline**: *"The frictionless e-signature workflow for modern teams."*

2. **`SignlyPro` (`signlypro.com` / `signly.pro`)**
   - **Why it wins**: Retains the familiar, friendly naming structure without infringing on `signaturly.com`. Strong `.com` viability as `signlypro.com`.
   - **Tagline**: *"Legally binding e-signatures and audit trails in seconds."*

3. **`DocSeal` (`docseal.pro` / `docseal.io`)**
   - **Why it wins**: Crisp, 2-syllable name that directly communicates what the product does: signs and seals PDF documents with Section 65B legal certificates.
   - **Tagline**: *"Sign, seal, and verify agreements with cryptographic proof."*
