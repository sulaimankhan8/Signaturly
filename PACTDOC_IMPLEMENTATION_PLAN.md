# PactDoc Implementation Plan

Oct 11, 2026 · @sulaiman khan

## Overview

This plan turns the three reports into 132 tasks, 13 for setup and 119 across seven phases: fix every audit finding first, put automated tests under everything, then build the India business approach on top. No task is done until its test passes in CI.

It draws on the Product & Technology Audit (28 findings), the Business & Market Report (pricing and positioning) and the India Strategy & Build Plan (industries, templates, plans, law). Those files sit in the repo root.

| Phase | Goal | Tasks | Estimate, one developer | Exit test |
| --- | --- | --- | --- | --- |
| 0. Emergency | Leaked credentials are dead | 8 | 1 to 2 days | Old credentials fail against the database and API |
| 1. Secure | Every access-control and abuse finding closed | 32 | 2 to 3 weeks | Security regression suite green |
| 2. Trust | Sealed PDFs, complete audit log, reliable jobs, real billing | 22 | 4 to 6 weeks | End-to-end signing suite green; a sealed PDF validates in a PDF tool |
| 3. India fit | Regional languages, WhatsApp and SMS, India hosting, PactDoc name | 14 | 4 to 6 weeks | A Hindi document signs end to end from a WhatsApp link |
| 4. Templates and plans | Template engine, first three packs, new pricing | 17 | 6 to 8 weeks | A rent agreement is generated from answers, signed, and billed on the new plan |
| 5. Teams | Workspace-owned documents and roles | 11 | 6 to 8 weeks | A second team member sees and sends a shared document; an outsider cannot |
| 6. Strong signatures | Aadhaar eSign, public API, Enterprise plan | 15 | 8 to 12 weeks | An Aadhaar-signed document completes in the provider sandbox |

The total is roughly eight to eleven months for one developer. Estimates are my judgement, not measured.

### The rule for done

A task is done when all four hold:

1. The code change is merged through a pull request.
2. A test that fails before the change and passes after it is in the repo.
3. CI is green: lint, unit, integration, build and, for user-facing changes, end-to-end.
4. The change is deployed to staging and checked there before production.

### How to read the task tables

Each task has an id such as `P1-07`. "Fixes" names the audit finding, such as C4 or H3. "Who" is **Code** for work done in the repo and **You** for work only the account owner can do, such as rotating a password or signing a contract. Paths are under `server/src/` unless they start with another folder.

### Order that must not change

Phase 0 before anything. Phase 1 before any real user. The test setup in the next section before the first fix, so every fix lands with its test. Phases 3 to 6 can be reordered by customer demand, except that Aadhaar eSign needs the credit wallet from phase 4.

## Progress as of 11 October 2026

78 of 132 tasks are done and 32 are partly done. Phase 1 is nearly complete, the core of phase 2 is built, and the code side of phases 3, 4 and 5 is finished and tested. Of phase 6, the public API, webhooks, test mode and embedded signing are built and tested, and **Aadhaar eSign is postponed to the next version** by the owner's decision of 11 October 2026: its scaffolding is in the code, switched off. 525 server tests and 56 browser tests pass. Phases 1 to 3 are committed and pushed, and phases 4 to 6 are uncommitted, on branch `fix/phase1-security`; nothing is merged to `main` or deployed. `PENDING_TASKS_AND_PRODUCTION_ROADMAP.md` in the repo root carries the same status with the owner's to-do list and the production configuration; its section 5a lists each phase 5 and 6 task with what is still open.

| Phase | Tasks | Done | Partly | Not started |
| --- | --- | --- | --- | --- |
| Setup | 13 | 5 | 3 | 5 |
| 0. Emergency | 8 | 0 | 1 | 7 |
| 1. Secure | 32 | 29 | 3 | 0 |
| 2. Trust | 22 | 9 | 7 | 6 |
| 3. India fit | 14 | 9 | 3 | 2 |
| 4. Templates and plans | 17 | 13 | 3 | 1 |
| 5. Teams | 11 | 9 | 2 | 0 |
| 6. Strong signatures and API | 15 | 4 | 10 | 1 |
| **Total** | **132** | **78** | **32** | **22** |

Not yet checked: the workspace migration on real data, single sign-on against a real identity provider, a real phone in the hand, the seal in Adobe Acrobat, the Hindi wording by a native speaker, and the client's new routing on the live host.

### Phase 3 so far

The gating question is settled: pdf-lib's own text drawing breaks every Indian script, so text is shaped with HarfBuzz and drawn as glyph outlines. The comparison and the decision are in `docs/decisions/0001-text-rendering-for-indic-scripts.md`.

| Task | Status | Note |
| --- | --- | --- |
| P3-01 | Done | Three approaches rendered and compared for six scripts; decision recorded |
| P3-02 | Done | Field values and the signing record keep Hindi, Marathi, Tamil, Telugu, Kannada, Gujarati and Bengali text |
| P3-03 | Done | Every signer screen in English and Hindi; a test fails on any untranslated word or missing key; a browser test signs end to end in Hindi |
| P3-04 | Done | Language per signer drives emails, messages and the signing record, which repeats its headings in that language beside the English |
| P3-05 | Not started | Needs translators; missing wording falls back to English |
| P3-06 | Done | Phone-only signers, delivery channel per signer, fields linked by number |
| P3-07 | Partly | Messaging interface with development and test providers; no commercial provider yet |
| P3-08 | Partly | WhatsApp uses the same interface and templates; needs business verification |
| P3-09 | Done | One-time code by SMS, named as such in the audit log |
| P3-10 | Done | India date, time and rupee formats |
| P3-11 | Not started | Yours: approve the move to the Mumbai region |
| P3-12 | Partly | Apps, emails, storage keys and package names renamed; cloud resource names, DNS and old documents remain |
| P3-13 | Done | Fits a 360-pixel screen, bottom action bar, finger-drawn signature, per-page code loading, documents fetched in pieces; browser-tested on a phone profile and a throttled connection |
| P3-14 | Done | Landing, pricing, verification and user guide written out as HTML at build time, with a sitemap; template pages join in P4-08 |

Found and fixed during phase 3: about 1 genuine sealed file in 256 was reported as altered, because the signing library's extractor cut short any signature ending in a zero byte. The first browser tests then found that tapping a signature field on the document did nothing, that signers could drag fields the server would stamp elsewhere, and that date fields carried the sender's date in an ambiguous format. The ready-made signature stamp also printed unsupported claims onto documents; it now says only "Electronically signed" and the date.

Setup task S-07 (browser tests) is done as part of this: `e2e/` runs the built client against the real server on a throwaway database, in the Chrome already installed, and is a CI job.

Further tasks added: native review of the Hindi wording and legal approval of the consent sentence per language (A-13); charging messages to the wallet before messaging is switched on in production (A-14); trimming the font packages (A-15); Arabic and Japanese fonts and mixed-direction text for later markets (A-16); an optional invisible text layer because shaped text cannot be selected (A-17); translating the signing record (A-18, now done); translating the server's error replies on signer screens (A-19); speeding up the signing page on a weak signal, measured at 22 seconds to first page at 400 kbit/s (A-20); checking the client's new routing on the live host (A-21); browser tests for the remaining screens (A-22); the language of the stamp wording (A-23); and an unneeded sign-in call on signer pages (A-24).

### Phase 4 so far

Guided templates work from the first question to the sealed copy. The renderer question is settled in `docs/decisions/0002-template-renderer.md`: own layout on the PDF library, in the API process.

| Task | Status | Note |
| --- | --- | --- |
| P4-01 | Done | Definition model; 13 of the 14 old templates converted, the promissory note dropped; start-up sync that never overwrites a stored version |
| P4-02 | Done | Own layout on pdf-lib. Only this option was built and measured: two pages of Hindi in about 0.6 s |
| P4-03 | Done | A4 output, fields placed from the signature block, amounts in words, conditional clauses, identical bytes for identical input |
| P4-04 | Done | Fill-in screen with checks, live preview and saved draft; browser test from answers to two signatures |
| P4-05 | Done | Admin Templates page: draft the next version, edit, preview, publish, retire, record a review; history per version. Structure is edited as JSON |
| P4-06 | Done | One entitlements table; no route names a plan; packs open by tier; bulk-send limit per plan |
| P4-07 | Done | Signature hint, stamp-duty note, state note and review status shown before sending |
| P4-08 | Done | Public library at /t and a page per template, written out at build time from the API's public list; "use this template" leads through sign-up to the questions |
| P4-09 | Partly | Eight Starter templates written and working; lawyer review outstanding, so hidden in production |
| P4-10, P4-11 | Partly | Rentals (9) and housing society (12) drafted and rendering; lawyer review outstanding |
| P4-12 | Not started | Hindi versions |
| P4-13 | Done | One price list; Free 5, Pro Rs. 299 for 50; lifetime closed; migration of existing accounts |
| P4-14 | Done | Every plan metered; packs of extra documents that carry over; safe under simultaneous sends |
| P4-15 | Done | Wallet with ledger; never below zero; messages charged to it |
| P4-16 | Done | Gapless invoice numbers; tax invoice or receipt; GST number capture; PDF download |
| P4-17 | Done | Pricing and billing pages in rupees; Free-plan line on emails and the finished signing page |

Found and fixed during phase 4: a new account's first screen failed with server errors because its subscription was created several times at once; the old templates printed a "legally compliant" banner and an admissibility clause on every document; the old product name was still on screen in three places.

Further tasks added: phone and WhatsApp signers in the fill-in screen (A-25); the owner's decision on guided templates for Free accounts (A-26); a plan for the Business tier (A-27); file size of long documents in Indian scripts (A-28); rebuilding the public pages when a template is published or reviewed (A-29); translating the public template pages and the fill-in screen (A-30); the owner's decision on proposed prices (A-31); a first real Razorpay payment in test mode (A-32); automatic renewal (A-33); an accountant's check of the GST treatment (A-34); running migrations on deploy (A-35); translating the billing page (A-36).

### Phases 5 and 6 so far

Built and tested on 11 October 2026. "Done" means the test this plan names for the task passes.

| Task | Status | Note |
| --- | --- | --- |
| P5-01 | Done | Workspace on documents and saved templates; personal workspace per user; migration 002 tested forwards, twice and backwards on seeded data. Not yet run on real data. Audit entries do not carry the workspace |
| P5-02 | Done | `services/authorize.service.js`: one role-to-action table, used by every route that touches a team's things |
| P5-03 | Done | `tests/security/access-matrix.test.js`, generated from the route files: 152 routes classified, 53 called as outsider, viewer, member, admin and owner |
| P5-04 | Done | Invitations by hashed link, for people with or without an account; seats counted, pending invitations included |
| P5-05 | Partly | Rs. 499 a seat, pooled documents, seats added mid-period for the share of time left, fewer seats from the next purchase. Never tried in the gateway's test mode; no mid-period removal, by design |
| P5-06 | Done | Team name, colour, footer and logo on emails, the signing page and the head of the signing record |
| P5-07 | Done | Contact lists with CSV import; bulk send as one job per row; a 500-row send completes; a failed row is reported and retried |
| P5-08 | Done | Workspace switcher and a team page with activity; browser test of a member working in a team |
| P5-09 | Done | Authenticator-app codes with recovery codes; a team can require it |
| P5-10 | Partly | HR (10) and professional firms (8) packs drafted and rendering; several PDFs joined into one document and signed in one sitting. Lawyer review outstanding |
| P5-11 | Done | A removed member's documents pass to the owner; a lapsed plan makes team workspaces read-only |
| P6-01 | Not started | Postponed with Aadhaar eSign |
| P6-02 to P6-06 | Partly, postponed | Provider interface, signer flow, wallet charge and refund, ordering and fallback, tested against a stand-in provider. Off unless `ESIGN_PROVIDER` is set; the stand-in is refused in production. No licensed provider, and the provider's signature is not placed in the PDF |
| P6-07 | Partly | Lending (8) and real estate (5) drafted and rendering. Promissory note, agreement for sale and sale deed left out on purpose. Lawyer review outstanding |
| P6-08 | Partly | Decision note `docs/decisions/0003-e-stamping.md`: not built now. Needs the owner's confirmation |
| P6-09 | Done | Live and test prefixes, scopes, per-key rate limit; a key is confined to its workspace |
| P6-10 | Partly | `/api/v1` built and tested, with `docs/api/openapi.yaml`. Tests are hand-written, not generated from the OpenAPI file. Routes are in `routes/v1.routes.js`, not a `routes/v1/` folder |
| P6-11 | Done | A receiver that fails twice then succeeds gets one delivery; private and local addresses refused; delivery log and replay |
| P6-12 | Done | Session tokens and a per-team list of sites; the signing page refuses any other frame, checked in a browser |
| P6-13 | Done | Watermark, no billing, no email, separate from live data |
| P6-14 | Partly | `docs/api/README.md`. Examples not run in CI; no request collection |
| P6-15 | Partly | Single sign-on with DNS-proved domains (tested against a simulated provider) and a retention job (tested). Own domain not built |

Where this departed from the plan: Aadhaar eSign (P6-01 to P6-06) is postponed to the next version; P5-01 leaves audit entries without a workspace reference so the hash-chained log is untouched; P5-10's packet of documents is one joined PDF, not separate files in one envelope; P5-05 never takes seats away part-way through a paid period.

Found and fixed while writing the tests: a viewer could send from a ready-made template and save a team template; a send could be charged to the wrong team; an API key could read another workspace's documents; a webhook address written as IPv4 inside IPv6 passed the private-address check; an Enterprise account could not invite anyone; a teammate could not open a team document in the editor.

### Status of every task in the phases already begun

| Task | Status | Note |
| --- | --- | --- |
| S-01 | Not started | Yours: staging and production projects |
| S-02 | Not started | Local compose file |
| S-03, S-04, S-05 | Done | In-memory database harness, helpers, email outbox |
| S-06 | Not started | Component tests |
| S-07 | Done | Playwright in `e2e/`: 28 tests on a phone profile and a desktop one, against the real server on a throwaway database |
| S-08 | Done | CI on every pull request. Lint is not gated: 543 existing errors |
| S-09 | Partly | Tests gate the deploy; no separate staging deploy |
| S-10 | Not started | Yours: branch protection |
| S-11, S-12 | Not started | Migrations tool; logger and error tracking |
| S-13 | Partly | Two credential-bearing scripts deleted; `verify-*.js` and `nuke-db` remain |
| P0-01 to P0-05 | Not confirmed | Yours: private repo and rotation |
| P0-06 | Partly | Workflow reads Secret Manager; the secrets must be created |
| P0-07, P0-08 | Not started | History clean-up; misuse check |
| P1-01 to P1-11 | Done |  |
| P1-12 | Partly | Global guard plus schemas on public and sign-in routes; other routes pending |
| P1-13 to P1-17 | Done |  |
| P1-18 | Partly | Expiry and random tokens done; a new token per reminder was dropped by design |
| P1-19 to P1-24 | Done |  |
| P1-25 | Partly | Admin 2FA still to do |
| P1-26 to P1-32 | Done |  |
| P2-01 | Partly | `@signpdf` chosen and in use; no written note; no timestamp support |
| P2-02 | Partly | Certificate from a secret; key-management service not used |
| P2-03 | Partly | Sealed with the signing record attached; no trusted timestamp; not opened in Acrobat |
| P2-04 to P2-07 | Done |  |
| P2-08 | Partly | Signing record rebuilt; Section 63 certificate still on its old layout |
| P2-09, P2-10 | Done | Queue stored in the database, see design changes below |
| P2-11 | Partly | Endpoints built; scheduler jobs are yours to create |
| P2-12 | Done |  |
| P2-13 | Not started | Needs your email provider |
| P2-14 | Partly | Plan state follows provider events; Razorpay Subscriptions checkout not built |
| P2-15 | Done |  |
| P2-16 | Not started | Billing page |
| P2-17 | Done |  |
| P2-18 | Not started | Yours: database tier with backups |
| P2-19 | Partly | Export and deletion on the server; no screens, retention job or privacy page |
| P2-20, P2-21, P2-22 | Not started | Server-side saved signatures; storage key and access log; sender 2FA |

### Where the build departed from this plan

| Plan said | Built | Why |
| --- | --- | --- |
| Job queue on Cloud Tasks | Jobs stored in MongoDB, run at once in-process and re-run by a scheduler endpoint | No extra cloud service or dependency; works with scale-to-zero |
| File access by owner token or a signer token scoped to one document | Short-lived signed links issued by the API, plus owner header token | No login or signer token ever appears in a URL |
| New signing token on every reminder | New token only when the signer's email changes | A reminder would have killed the link in the first email |
| Mongoose filter sanitising | A global guard that rejects operator keys in any request | The Mongoose option would have broken the app's own queries |
| Trusted timestamp in the seal | Not included | The chosen library does not add one; tracked as A-01 |
| Four required secrets | Eleven | The audit key, seal certificate and scheduler secret are new |

### Tasks added along the way

| Id | Task | Suggested phase |
| --- | --- | --- |
| A-01 | Trusted timestamp on the seal | 2 |
| A-02 | Seal certificate from a recognised authority | When customers ask |
| A-03 | Open a sealed PDF in Adobe Acrobat; add `pdfsig` validation to CI | 2 |
| A-04 | Screens for account export and deletion, undelivered invitations, sealed badge, resend-confirmation banner | 2 |
| A-05 | Fix the client's 543 lint errors, then gate lint in CI | 2 |
| A-06 | Rebuild the Section 63 evidence certificate from the full log; lawyer review | 2 |
| A-07 | Wipe or migrate development data before launch; old audit entries are unchained | Before launch |
| A-08 | Policy: should other parties keep access to a completed agreement after the owner deletes their account? | You and the lawyer |
| A-09 | Remove dead code: `quota.middleware.js`, `sse.service.js` | 2 |
| A-10 | Non-Latin names print as "?" on the signing record until Unicode fonts land | 3, with P3-02 |
| A-11 | Rewrite the user guide, deployment guide and Word documents after the rename | 3 |
| A-12 | Procedure for rotating the seal certificate | 2 |

### Findings fixed that were not in the audit

- Request values passed unchecked into database lookups on the OTP routes.
- Credentials hardcoded in two test scripts, and the live database credentials repeated in the deployment guide, its generator script and a Word document.
- Production JWT secrets were placeholder values and the admin key was the built-in default.
- A forged PDF quoting a genuine hash was reported as authentic.
- Any signed-in user could download any document's audit certificate.
- A template could be created from another user's document.
- A non-Latin signer name crashed certificate generation.
- A corrected signer email never received a new invitation; a document with a viewer could never complete; the post-signing download gave the unsigned copy; the owner was never told of completion.

## Setup: before the first fix

Put the test harness, a staging environment and CI gates in place first, in about three days, so that every later change is checked automatically. Today there are no automated tests, CI only deploys, and the four manual scripts connect to whatever database `.env` points at.

### Tooling choices

| Need | Choice | Why |
| --- | --- | --- |
| Server unit and integration tests | Vitest, Supertest, `mongodb-memory-server` | Works with the ES modules the server already uses; `app.js` is already exported separately from `server.js`; no shared database needed |
| Client component tests | Vitest, React Testing Library | Same runner as the server; Vite is already the build tool |
| End-to-end tests | Playwright | Drives a real browser through upload, send and sign; runs sender and signer as separate sessions |
| Request validation | Zod schemas per route | One place to reject bad input; schemas double as test fixtures |
| Database migrations | `migrate-mongo` | Later phases change ownership and plan data; changes must be repeatable |
| Secret scanning | Gitleaks in CI and as a pre-commit hook | Stops a repeat of the leaked workflow file |
| Dependency checks | `npm audit` in CI, Dependabot | Flags known vulnerabilities |
| Logging and errors | Pino with field redaction; Sentry | Replaces `console.log` lines that print emails |
| PDF signature check | `pdfsig` from Poppler, in CI | Independent proof that a sealed PDF validates |

### Setup tasks

| Id | Task | Where | Who |
| --- | --- | --- | --- |
| S-01 | Create `staging` and `production` projects with separate databases, buckets and secrets | Google Cloud, MongoDB Atlas | You |
| S-02 | Add `docker-compose.dev.yml` with MongoDB, the API and both web apps for local work | repo root | Code |
| S-03 | Add Vitest and Supertest; a test bootstrap that starts an in-memory MongoDB, uses a temp folder for storage and captures emails in memory | `server/tests/`, `server/vitest.config.js` | Code |
| S-04 | Add test factories for users, documents, recipients and subscriptions | `server/tests/factories/` | Code |
| S-05 | Add an email outbox for tests so OTPs and links can be read back | `config/email.js` | Code |
| S-06 | Add Vitest and Testing Library to the client and admin apps | `client/`, `admin/` | Code |
| S-07 | Add Playwright with a fixture that boots the stack and seeds a sender | `e2e/` | Code |
| S-08 | New CI workflow on every pull request: lint, server tests, client tests, both builds, Gitleaks, `npm audit` | `.github/workflows/ci.yml` | Code |
| S-09 | Make deploy depend on CI passing; deploy `main` to staging, tagged releases to production | `.github/workflows/deploy-backend.yml` | Code |
| S-10 | Protect `main`: pull requests only, CI required | GitHub settings | You |
| S-11 | Add `migrate-mongo` and a `migrations/` folder | `server/` | Code |
| S-12 | Replace `console.log` with a Pino logger that redacts emails, tokens and IP addresses; add Sentry | `utils/logger.js`, all services | Code |
| S-13 | Retire the four manual scripts once their checks are ported to Vitest; remove `nuke-db` from the image | `scripts/`, `server/Dockerfile` | Code |

### Branching

One short branch per task, named by task id. Each pull request contains the fix and its test. Nothing is pushed to `main` directly.

## Phase 0: emergency

Kill every leaked credential within two days; until then, anyone who has read the public repository can open the database and sign in as any user.

| Id | Task | Who |
| --- | --- | --- |
| P0-01 | Make the GitHub repository private | You |
| P0-02 | Change the MongoDB user's password and restrict network access to the API | You |
| P0-03 | Generate new JWT access and refresh secrets. Every user is signed out. | You |
| P0-04 | Generate a new admin key and a new SMTP app password | You |
| P0-05 | Change the password of the account whose email and password are hardcoded in `scripts/test-all-flows.js:27`, anywhere it is used | You |
| P0-06 | Move all values to Secret Manager; deploy with `--set-secrets`; set `CORS_ORIGIN` to the real app and admin addresses | Code |
| P0-07 | Remove the secrets from git history, or start a fresh private repository; confirm with a full-history Gitleaks scan | Code, with your approval for the force-push |
| P0-08 | Check for misuse: database access logs, unexpected admin or superadmin users, plan upgrades with no payment. Decide whether users must be told. | You, with queries from Code |

The hardcoded test password in P0-05 is a new finding, not in the audit.

## Phase 1: secure

Close every access-control and abuse finding from the audit, 32 tasks, each with a regression test that reproduces the attack and proves it now fails. All tasks are code work.

### Access to money, files and documents

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P1-01 | Remove the dev-upgrade route and the mock checkout fallback outside development and test | C2, H2 | `routes/billing.routes.js`, `services/billing.service.js` | In production mode the route returns 404; a gateway error returns an error, never a mock upgrade |
| P1-02 | Mount webhooks before the JSON parser with the raw body; verify Stripe and Razorpay signatures; refuse when no secret is set; ignore repeated event ids | C3 | `app.js`, `routes/webhook.routes.js`, `controllers/webhook.controller.js` | Unsigned, wrongly signed and replayed events change nothing; a valid event changes the plan once |
| P1-03 | Turn billing off behind a flag in production until the phase 2 rebuild | H1, H2 | `services/billing.service.js`, client pricing pages | With the flag off, checkout returns "not available" and no plan changes |
| P1-04 | Add a verified-signer gate used by session load, file access, sign and decline. Before verification the session returns only the check type. | C4 | new `middlewares/recipient.middleware.js`, `controllers/signing.controller.js` | An OTP signer who skips verification gets 403 on fields, file and sign |
| P1-05 | Passcode check only for passcode signers; no automatic pass; five attempts then lockout | C4, H3 | `routes/otp.routes.js` | Calling it for an OTP signer returns 400 and leaves them unverified; the sixth wrong passcode is locked |
| P1-06 | Store the method and time of the real verification on the recipient and use it in the audit entry | C4 | `models/Recipient.model.js`, `services/pdfSign.service.js:310` | Audit entry says "email link" for an unverified-type signer and "email OTP" only after a passed OTP |
| P1-07 | Replace the file handler: deny by default; allow the owner by header token, or a signer token for that one document; block path traversal; drop the referer rule | C5 | `middlewares/file.middleware.js` | No token, another user's token, another document's signer token and `..` paths all return 403 or 404 |
| P1-08 | Serve files through an authenticated download endpoint or short-lived signed links; stop returning raw `/uploads` paths | C5, H9 | `controllers/pdf.controller.js`, `controllers/signing.controller.js`, `services/storage.service.js` | Returned links expire; an expired link fails |
| P1-09 | Check ownership in self-sign and allow it only on drafts | C6 | `controllers/sign.controller.js`, `services/pdfSign.service.js` | Signing another user's document returns 403; signing a sent or completed one returns 409 |
| P1-10 | Accept signature images only as PNG or JPEG data under a size cap, or the caller's own stored file; remove remote fetch and raw path reads | H4 | `services/pdfSign.service.js:17` | An `http://` value and a file path are rejected; no outbound request is made |
| P1-11 | Reject `..`, absolute paths and other users' folders inside the storage service | H4, C5 | `services/storage.service.js` | Unit tests for each bad path |
| P1-12 | Validate every request body, query and parameter with a schema; turn on Mongoose filter sanitising | New | all routes, `config/db.js` | Sending `{"token": {"$ne": null}}` to the OTP and signing routes returns 400 |

P1-12 closes a gap found while writing this plan: the OTP routes pass a request value straight into a database lookup, so an object in place of a token can match another signer's record.

### Signing rules

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P1-13 | Enforce state on the server: document must be awaiting signature; signer must not have signed or declined; viewers cannot sign; in sequential mode only the current signer may act | H8 | `services/recipient.service.js:128` | Second signer signing first returns 409; signing after decline or void returns 409 or 410 |
| P1-14 | Match fields to signers by id only; require every required field; ignore fields that belong to someone else | H8, M4 | `services/recipient.service.js:158` | Two signers with the same name cannot fill each other's fields; a missing required field returns 422 |
| P1-15 | Require and store consent: text version, time, IP and browser, plus an audit event | H8 | `models/Recipient.model.js`, `controllers/signing.controller.js` | Signing without the consent flag returns 422; the stored record matches |
| P1-16 | Stamp the PDF first, then mark the signer signed; hold a database lock per document; undo on failure | H8, H11 | `services/recipient.service.js`, `services/pdfSign.service.js:15` | A forced stamping failure leaves the signer unsigned; two parallel signers both end up stamped |
| P1-17 | Use the storage service to check for the signed file | H9 | `controllers/signing.controller.js:23`, `controllers/sign.controller.js:43` | With the cloud storage adapter faked, signer two receives the version signer one signed |
| P1-18 | Default link expiry of 30 days; 32-byte random tokens; new token on resend; no links in the bulk-send response | M7 | `services/recipient.service.js`, `services/bulkSend.service.js:140` | An expired token returns 410; the bulk response contains no tokens |

### Accounts, admin and platform

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P1-19 | Security headers and rate limits, stored in the database: login, register, password reset, OTP send and verify, verification page, signing routes | H3 | `app.js`, new `middlewares/rateLimit.middleware.js` | The request past each limit returns 429 |
| P1-20 | OTP from a secure random source; 60-second resend wait; five sends per signer per hour | H3 | `services/otp.service.js:11` | Resend inside the wait returns 429 |
| P1-21 | Strict origin list that fails closed; no wildcard | H10 | `app.js:20` | A request from an unlisted origin gets no allow-origin header |
| P1-22 | Tokens in headers only; a short-lived ticket for the live-updates stream; `Secure` cookies; trust the proxy so IP addresses are real | H10 | `middlewares/auth.middleware.js:12`, `controllers/auth.controller.js:21`, `routes/pdf.routes.js:17` | A token in the query string returns 401; the cookie carries `Secure` in production mode |
| P1-23 | Rotate refresh tokens and store them hashed; hash reset tokens; sign out all sessions on password change | M6 | `models/User.model.js`, `controllers/auth.controller.js` | A used refresh token fails; old sessions fail after a reset |
| P1-24 | Passwords of at least 10 characters; email verification before sending documents | M6 | `services/auth.service.js`, `controllers/auth.controller.js:178` | An unverified account cannot send; a short password returns 422 |
| P1-25 | Admin: no automatic promotion; a separate token secret; admins created only by the seed script; authenticator-app 2FA | H5 | `routes/admin.routes.js:19`, `middleware/admin.middleware.js` | A normal user with the admin key is refused; a user token is refused on admin routes |
| P1-26 | Validate configuration at start-up; refuse to start with a missing or default secret | H5 | `config/env.js` | Start-up fails without each required value |
| P1-27 | Public verification returns only: genuine or not, document title, completion time and masked signer names. No IP addresses, emails or download link. | H6 | `services/verification.service.js` | Response contains no email, IP or URL fields |
| P1-28 | Upload limits: 25 MB files, 2 MB JSON, a real PDF header check, a page cap, clean refusal of encrypted PDFs | M2 | `config/multer.js`, `app.js:15`, `services/pdfUpload.service.js` | Oversize, fake-PDF and encrypted uploads return 413 or 422 |
| P1-29 | Count quota inside the send, atomically; count bulk send | M3 | `middlewares/quota.middleware.js`, `controllers/send.controller.js`, `services/bulkSend.service.js` | Ten parallel sends at the limit allow exactly the remaining number |
| P1-30 | Add reminder fields to the recipient schema; one reminder per signer per window | M5 | `models/Recipient.model.js`, `services/reminder.service.js` | Two reminder runs in one window send one email |
| P1-31 | Public health endpoint; point container health checks at it | M8 | `routes/index.js`, `server/Dockerfile`, `docker-compose.yml` | The endpoint returns 200 without a token |
| P1-32 | Reword every claim the code does not support, in pages, emails, certificates and templates; remove adverts from the signing page | Claims table | `client/src/pages/`, `services/email.service.js`, `services/auditCertificate.service.js`, `services/prebuiltTemplates.service.js`, `client/src/components/ads/` | A test fails if "Merkle", "zero-knowledge", "notarized" or "immutable" appears in shipped text |

## Phase 2: trust

Make a signed PactDoc file able to prove itself, and make the system reliable enough to charge for: 22 tasks across the PDF seal, the audit log, background jobs, billing and data protection.

### Sealed PDF and evidence

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P2-01 | Spike, two days: choose the PDF signing library. Compare `@signpdf` with `@libpdf/core` on PAdES output, timestamp support and pdf-lib compatibility. Write the decision down. | C7 | `docs/decisions/` | A sample file from each validates in `pdfsig` |
| P2-02 | Signing key handling: self-signed certificate file for development; key held in Cloud KMS for staging and production | C7 | new `services/pdfSeal.service.js`, `config/env.js` | Sealing works with both key sources |
| P2-03 | On completion: append the audit certificate pages, sign the whole file with the platform certificate and a trusted timestamp, and make the sealed file the only download | C7 | `services/pdfSeal.service.js`, `services/recipient.service.js` | `pdfsig` reports a valid signature; changing one byte makes it invalid |
| P2-04 | Keep the original untouched and write a new stored version per signer in place of overwriting one `-signed.pdf` | C7, H9 | `services/pdfSign.service.js`, `models/Pdf.model.js` | Three signers produce the original plus three versions; hashes are recorded in order |
| P2-05 | Verification by upload checks the embedded signature and the stored sealed hash; add a QR code and verification link to the certificate page | H6 | `services/verification.service.js`, `services/auditCertificate.service.js` | A sealed file verifies; an edited copy does not |
| P2-06 | One audit writer for every event: hash-chained, numbered in sequence, keyed with a server secret. Remove the unchained writes and the duplicate sign entries. | H7 | `services/auditLedger.service.js`, `events/consumers/audit.consumer.js` | Every stored event has a hash; editing any stored field breaks verification; one sign produces one entry |
| P2-07 | Deleting a document becomes a soft delete; audit entries are kept; bulk deletes on the audit collection are blocked | H7 | `controllers/pdf.controller.js:172`, `models/PdfAudit.model.js` | After deletion the audit entries still exist and verify |
| P2-08 | Build both certificates from the full log, including consent and the real verification method | H7 | `services/auditCertificate.service.js`, `services/bsaCertificate.service.js` | Certificate text matches the log for a mixed OTP and link envelope |

### Background jobs and email

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P2-09 | A job interface with two drivers: in-process for development and tests, Cloud Tasks for staging and production. Handlers must be safe to run twice. | H11 | new `jobs/`, replaces `events/eventBus.js` | A handler run twice with the same job id has one effect |
| P2-10 | Send emails and later webhooks as jobs with retries and a failure list; show "delivery failed" on the document | H11 | `events/consumers/email.consumer.js`, `config/email.js:42` | A failing mail transport is retried, then the document shows the failure |
| P2-11 | Run reminders, expiry and subscription checks from Cloud Scheduler through authenticated internal endpoints; remove `node-cron` | H11 | `config/cron.js`, new `routes/internal.routes.js` | Endpoints refuse calls without the scheduler identity; each run is idempotent |
| P2-12 | Remove the in-memory live-updates stream; keep the existing delta polling endpoint | H11 | `services/sse.service.js`, `client/src/pages/Dashboard.jsx` | Dashboard updates after a signer acts, with two API instances running |
| P2-13 | Move to a transactional email provider on pactdoc.com with SPF, DKIM and DMARC; record bounces against the signer | H11 | `config/email.js`, DNS | A simulated bounce marks the signer's email as failed |

DNS records in P2-13 are yours to add; the rest is code.

### Billing rebuild

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P2-14 | Plan state driven only by provider events. Razorpay Subscriptions as the main gateway for rupees; Stripe optional for dollars. One plan catalogue holding provider plan ids. | H1, H2 | `services/billing.service.js`, `services/subscription.service.js`, `models/Subscription.model.js` | No code path changes a plan except a verified event or an admin action |
| P2-15 | Handle charge, failure, halt and cancel events idempotently; keep a payments ledger | H1 | `controllers/webhook.controller.js`, new `models/Payment.model.js` | A renewal event extends the period; a failed charge starts the grace period; a replay does nothing |
| P2-16 | Billing page: current plan, invoices, change payment method, cancel; emails for failed payment and grace period | H1 | `client/src/pages/Settings.jsx`, `services/email.service.js` | End-to-end: subscribe in the gateway's test mode, see the plan, cancel |
| P2-17 | Record who granted every admin plan change | H5 | `routes/admin.routes.js:312` | An admin grant writes an entry with the admin's id |

### Data protection

| Id | Task | Fixes | Where | Test |
| --- | --- | --- | --- | --- |
| P2-18 | Move to a database tier with backups; write and run a restore drill | Roadmap | Atlas, `docs/runbooks/restore.md` | A restore into a scratch project passes the test suite |
| P2-19 | Account deletion, data export, a retention job for abandoned drafts, a privacy notice page | M10 | new `services/privacy.service.js`, client settings | Deleting an account removes personal data and keeps the legally required audit entries |
| P2-20 | Store saved signatures and contacts on the server, not in the browser | M10 | `client/src/pages/Settings.jsx:137`, `SendDocument.jsx:143`, new models | Saved items appear on a second device; nothing sensitive stays in browser storage |
| P2-21 | Encrypt the storage bucket with a managed key; log every file read | Audit, platform practices | storage configuration, `services/storage.service.js` | Each download writes an access-log entry |
| P2-22 | Optional authenticator-app 2FA for senders | M6 | `controllers/auth.controller.js`, client settings | Login with 2FA enabled fails without the code |

P2-18 needs you to choose and pay for the database tier.

## Phase 3: India fit

Make PactDoc work the way small Indian organisations work: regional languages, phone-first delivery, data hosted in India and the PactDoc name everywhere. 14 tasks.

**One technical risk to settle first.** The PDF library, pdf-lib, may not join and position characters correctly in Devanagari, Tamil and similar scripts. P3-01 tests this before any language work is committed. If it fails, text is rendered by a browser engine and placed in the PDF, which is slower but correct.

| Id | Task | Fixes | Where | Who | Test |
| --- | --- | --- | --- | --- | --- |
| P3-01 | Spike, two days: render Hindi, Marathi, Tamil, Telugu, Kannada, Gujarati and Bengali sample text with pdf-lib and Noto fonts; compare against browser rendering; record the decision | M1 | `docs/decisions/` | Code | Side-by-side images reviewed by a native reader of at least Hindi and Tamil |
| P3-02 | Unicode text in fields: embed the right Noto font per script, subset it, and remove the ASCII filter. Use the fallback renderer if P3-01 says so. | M1 | `services/pdfSign.service.js:121` | Code | Snapshot tests per script; a Hindi name survives signing and sealing |
| P3-03 | Client translation layer with `react-i18next`; move all strings on the signing page, OTP screen and consent screen into it; English and Hindi | Strategy | `client/src/pages/SigningPage.jsx`, `client/src/components/` | Code | A test fails on any hardcoded string in those screens; end-to-end sign in Hindi |
| P3-04 | Language per signer, chosen by the sender and switchable by the signer; emails and certificates follow it | Strategy | `models/Recipient.model.js`, `services/email.service.js`, `services/auditCertificate.service.js` | Code | A Hindi signer receives a Hindi email and a bilingual certificate |
| P3-05 | Add Marathi, Tamil, Telugu, Kannada, Gujarati and Bengali to the signing flow | Strategy | translation files | You commission translators; Code wires them in | Every key exists in every language |
| P3-06 | Signer phone number and delivery channel: email, SMS or WhatsApp. Allow signers with no email. | Strategy | `models/Recipient.model.js`, `services/send.service.js`, `client/src/pages/SendDocument.jsx` | Code | A phone-only signer can be added, receives a link and signs |
| P3-07 | A messaging interface with one SMS provider behind it | Strategy | new `services/messaging/` | Code; You register sender id and message templates with the telecom registry | Messages are sent through a fake provider in tests; failures retry as jobs |
| P3-08 | WhatsApp template messages for sign request, reminder and completion | Strategy | `services/messaging/` | Code; You complete WhatsApp business verification and template approval | Same as P3-07, plus delivery-status callbacks update the signer |
| P3-09 | SMS OTP as a signer check | Strategy | `services/otp.service.js` | Code | OTP by SMS passes the verified-signer gate from P1-04 |
| P3-10 | Indian formats: rupee amounts, day-month-year dates, India time with offset on certificates | Strategy | shared formatting helpers, certificates | Code | Unit tests on the helpers |
| P3-11 | Move the API, storage and database to the Mumbai region; copy data with checksums | Strategy | Cloud Run, bucket, Atlas | Code runs it; You approve the maintenance window | File counts and hashes match after the move; the suite passes against the new region |
| P3-12 | Rename to PactDoc: package names, emails, legal text, API key prefix, bucket names, browser storage keys; serve from `app.`, `api.` and `admin.pactdoc.com` | Roadmap | whole repo, DNS | Code; You add DNS records | A test fails if "Signaturly" appears in shipped text |
| P3-13 | Phone-first signing: usable at 360 pixels wide, touch signature, pages loaded as needed on slow connections | Strategy | `client/src/pages/SigningPage.jsx`, `client/src/components/PdfViewer.jsx` | Code | Playwright run with a phone profile and throttled network |
| P3-14 | Pre-render public pages so search engines can read them: landing, pricing, verification, template pages | Strategy | `client/` build | Code | Fetching a public page without JavaScript returns its content |

SMS and WhatsApp to Indian numbers need provider accounts and template approvals that can take weeks. Start those applications at the beginning of phase 2.

## Phase 4: templates and plans

Build the guided template engine, ship the first three packs and switch to the new pricing: 17 tasks. This is the phase where the business approach becomes visible to customers.

### Template engine

Today a template is a fixed PDF with field positions, and the 15 prebuilt ones live in a 1,542-line source file. Guided templates need content stored as data and a renderer.

| Id | Task | Where | Test |
| --- | --- | --- | --- |
| P4-01 | Template definition model: clauses, variables, questions, roles, field anchors, and metadata for pack, industry, plan tier, language, state notes, signature-type hint, reviewer and version. Migrate the prebuilt templates into the database. | `models/Template.model.js`, new `models/TemplateDefinition.model.js`, `migrations/` | Migration is repeatable; every old template loads through the new model |
| P4-02 | Spike, three days: choose the renderer. Headless browser in a worker service against pdf-lib layout. The Indic result from P3-01 decides. | `docs/decisions/` | A two-page Hindi rent agreement renders correctly within the memory limit |
| P4-03 | Renderer: answers plus definition produce a PDF with signature fields placed from anchors. Same input gives the same file. | new `services/templateRender.service.js` | Snapshot tests per template; field positions land inside the page |
| P4-04 | Guided fill screen: questions with validation, live preview, saved drafts | new `client/src/pages/TemplateFill.jsx` | End-to-end: answer, preview, send, sign |
| P4-05 | Template admin: create, version, publish and retire without a deploy | `admin/src/pages/` | A published version is used for new documents; old documents keep their version |
| P4-06 | One entitlements service for every feature gate, with per-pack access. Replace the plan lists hardcoded in routes. | new `services/entitlements.service.js`, `routes/template.routes.js`, `routes/bulk.routes.js`, `routes/api.routes.js`, `routes/workspace.routes.js` | A table-driven test of plan against feature for every gate |
| P4-07 | Show the signature-type hint and state notes in the send flow | `client/src/pages/SendDocument.jsx` | The rent agreement shows its stamping note |
| P4-08 | Public page per template with a "use this template" path through sign-up into guided fill | `client/` public pages | The page is readable without JavaScript and the path completes |

### Template content

| Id | Task | Who | Test |
| --- | --- | --- | --- |
| P4-09 | Starter pack, 8 templates | You engage the lawyer; Code builds definitions | Each template renders with sample answers and signs end to end |
| P4-10 | Rentals pack, 9 templates, with notes for five states | Same | Same |
| P4-11 | Housing society pack, 12 templates, plus a saved member list for bulk send | Same | Bulk send to a 200-row list completes as jobs with a progress count |
| P4-12 | Hindi versions of the Starter and Rentals packs | Same, plus a translator | Hindi renders pass the P3-02 snapshot checks |

Every template carries a reviewer name, a review date and a "starting draft, not legal advice" line.

### Plans and pricing

| Id | Task | Where | Test |
| --- | --- | --- | --- |
| P4-13 | New plan catalogue: Free at 5 documents, Pro at ₹299 for 50. Close the lifetime plan to new buyers. Map existing accounts to new plans and keep what they already paid for. | `services/billing.service.js:10`, `services/subscription.service.js:5`, `migrations/` | Migration test over every old plan value; lifetime cannot be bought |
| P4-14 | Meter documents per plan; sell top-up packs | `services/subscription.service.js`, `models/Subscription.model.js` | Allowance, top-up and monthly reset behave correctly across a month boundary |
| P4-15 | Prepaid credit wallet with a ledger, bought through the gateway, debited atomically. Used for SMS and WhatsApp now and Aadhaar eSign later. | new `models/Wallet.model.js`, `models/WalletEntry.model.js`, `services/wallet.service.js` | Parallel debits never go below zero; ledger sum equals balance |
| P4-16 | Tax invoices: tax number capture, tax lines, numbered invoices as PDF | new `services/invoice.service.js` | Invoice numbers are gapless; totals match the payment |
| P4-17 | New pricing page and upgrade prompts; a "Signed with PactDoc" line on free-plan emails and completion pages; an invitation to send a document after signing | `client/src/pages/Pricing.jsx`, `client/src/components/UpgradeModal.jsx`, `client/src/pages/SigningPage.jsx`, `services/email.service.js` | Free-plan emails carry the line and paid ones do not |

P4-16 depends on your tax registration and an accountant confirming the invoice format.

## Phase 5: teams

Move document ownership from the person to the workspace so that societies, firms and employers can work as a team: 11 tasks. This is the riskiest change to existing data, so the cross-tenant test matrix in P5-03 is written before the migration runs in production.

| Id | Task | Where | Test |
| --- | --- | --- | --- |
| P5-01 | Add a workspace reference to documents, templates, contacts and audit entries. Give every user a personal workspace. Migrate existing data. | `models/Pdf.model.js`, `models/Template.model.js`, `models/Workspace.model.js`, `migrations/` | Before and after counts match per user; migration can be rolled back |
| P5-02 | One authorisation helper for every route with owner, admin, member and viewer roles. It replaces the scattered owner-id comparisons. | new `services/authorize.service.js`, all controllers | Unit tests of role against action |
| P5-03 | Cross-tenant test matrix: every route called as outsider, viewer, member and admin | `server/tests/security/` | An outsider gets 403 or 404 on every route; generated from the route list so new routes cannot be missed |
| P5-04 | Invite by email, including people with no account; accept flow; seat count | `controllers/workspace.controller.js:42` | An invited new user signs up into the workspace; an expired invitation fails |
| P5-05 | Business plan at ₹499 per user: seats, proration, pooled document allowance | `services/billing.service.js`, `models/Subscription.model.js` | Adding and removing a seat mid-cycle bills correctly in the gateway's test mode |
| P5-06 | Shared template library; workspace branding on emails, the signing page and certificates | `models/Workspace.model.js:44`, `services/email.service.js`, `client/src/pages/SigningPage.jsx` | A branded workspace's signer sees its logo; another workspace's does not |
| P5-07 | Saved member lists, such as all flats or all staff, with spreadsheet import and bulk send through the job queue | new `models/ContactList.model.js`, `services/bulkSend.service.js` | A 500-row send completes; a failed row is reported and can be retried |
| P5-08 | Workspace switcher and a team activity view | `client/src/components/Navbar.jsx`, `client/src/pages/Dashboard.jsx` | A member sees team documents; a viewer cannot send |
| P5-09 | Workspace policy to require 2FA for all members | `models/Workspace.model.js` | A member without 2FA is sent to set it up |
| P5-10 | HR pack of 10 templates and professional-firms pack of 8; several documents to one signer in a single envelope | template definitions, `services/send.service.js` | An onboarding packet of three documents signs in one session |
| P5-11 | Rules for downgrade and member removal: workspace becomes read-only; a removed member's documents pass to the owner | `services/subscription.service.js`, `controllers/workspace.controller.js:100` | After removal the member has no access and no document is orphaned |

Template content in P5-10 again needs the lawyer.

## Phase 6: strong signatures and API

Add Aadhaar eSign through a provider, open a public API and launch the Enterprise plan: 15 tasks. The provider contract in P6-01 gates the first half, so start it during phase 3.

**A design rule for this phase.** An Aadhaar eSign is a real digital signature inside the PDF. Any later change to the page content breaks it. So all visible stamps for a signer must be written before that signer's Aadhaar signature, every later signature must be added as an incremental update, and the platform seal goes last. P6-04 exists to get this order right.

### Aadhaar eSign

| Id | Task | Where | Who | Test |
| --- | --- | --- | --- | --- |
| P6-01 | Get quotes, minimums and sandbox access from two eSign aggregators; choose one | n/a | You | Written quote and working sandbox credentials |
| P6-02 | Provider interface and a first implementation against the sandbox, so the vendor can be swapped | new `services/esign/` | Code | Contract tests run against a fake provider and, nightly, against the sandbox |
| P6-03 | Signing flow: hand over to the provider, receive the callback, verify the provider's response, store the signed file and certificate details. Never store the Aadhaar number. | `services/esign/`, new `routes/esign.routes.js`, `client/src/pages/SigningPage.jsx` | Code | A forged callback is rejected; the database contains no 12-digit identity number after a full run |
| P6-04 | Mixed envelopes: each signer has a signature type; stamping, Aadhaar signatures and the final seal are applied in a safe order | `services/pdfSign.service.js`, `services/pdfSeal.service.js` | Code | With two Aadhaar signers and one ordinary signer, `pdfsig` shows every signature valid at the end |
| P6-05 | Debit the wallet per Aadhaar signature; refund when the provider fails | `services/wallet.service.js` | Code | A failed provider call leaves the balance unchanged |
| P6-06 | Guidance in the send flow on when to choose Aadhaar eSign; a fallback when the signer has no Aadhaar-linked mobile | `client/src/pages/SendDocument.jsx`, `SigningPage.jsx` | Code | The fallback path is reachable and audited |
| P6-07 | Lending pack of 8 templates and real-estate pack of 5 | template definitions | You engage the lawyer; Code builds | Each renders and completes with Aadhaar eSign in the sandbox |
| P6-08 | Spike on e-stamping partners; build only if a paying customer needs it | `docs/decisions/` | Code, You | Decision note |

### Public API and Enterprise

| Id | Task | Where | Test |
| --- | --- | --- | --- |
| P6-09 | API-key authentication with scopes, test and live key prefixes, and per-key rate limits. Keys are already stored hashed but nothing checks them. | new `middlewares/apiKey.middleware.js`, `models/ApiKey.model.js` | A revoked key, a wrong-scope key and a test key on live data are each refused |
| P6-10 | Versioned REST API: create a document from a file or template, add signers, send, read status, download. Published as an OpenAPI file. | new `routes/v1/` | Contract tests generated from the OpenAPI file |
| P6-11 | Webhook sender: signed payloads, retries with back-off through the job queue, a delivery log with replay. Refuse private network addresses. | new `services/webhookDelivery.service.js`, `models/Webhook.model.js` | A receiver that fails twice then succeeds gets one delivery; a `localhost` address is refused |
| P6-12 | Embedded signing: short-lived session tokens and a per-workspace list of sites allowed to frame the page | `controllers/signing.controller.js`, response headers | A site not on the list cannot frame the page |
| P6-13 | Test mode: watermarked documents, no charges, separate data | `services/entitlements.service.js` | Test-key documents are watermarked and never billed |
| P6-14 | Developer documentation and a request collection | `docs/api/` | Every documented example runs in CI against the sandbox |
| P6-15 | Enterprise plan: single sign-on, custom retention, own domain and branding | `controllers/auth.controller.js`, `models/Workspace.model.js` | Sign-in through a test identity provider; retention job honours the workspace setting |

## Testing

Every feature is covered at three levels: a fast test of its logic, an API test of its rules, and a browser test of the journey. Every audit finding gets its own named regression test. Nothing reaches production on a red build.

### Test layers

| Layer | Tool | Covers | Runs | Target |
| --- | --- | --- | --- | --- |
| Unit | Vitest | Pure logic: coordinates, quota maths, entitlements, hash chain, formatting, wallet ledger | Every pull request | 80% line coverage of `services/` |
| API integration | Vitest, Supertest, in-memory MongoDB | Each route with real middleware: validation, authentication, state rules, database effects | Every pull request | Every route has a success test and a refusal test |
| Security regression | Same | One test per audit finding, reproducing the attack | Every pull request | 28 findings plus the two new ones, all covered |
| Access matrix | Generated from the route list | Every route as anonymous, outsider, viewer, member, admin | Every pull request, from phase 5 | No route missing from the matrix |
| Component | Vitest, Testing Library | Field placement, signature pad, consent screen, OTP screen, guided fill form | Every pull request | Signing-page components covered |
| End-to-end | Playwright | Whole journeys across sender and signer sessions | Merge to `main`; nightly on three browsers and a phone profile | The 16 journeys below |
| PDF validation | `pdfsig`, snapshot comparison | Sealed files validate; rendered pages match stored references per script | Merge to `main` | Every signing journey ends with a validated file |
| Migration | Vitest against seeded old-shape data | Each migration forwards and back | Every pull request that adds one | Counts and checksums match |
| Provider contract | Fake providers in CI; real sandboxes nightly | Payment gateway, email, SMS, WhatsApp, eSign | Nightly | Fakes and sandboxes agree |
| Load smoke | k6 | 50 signers at once; 500-row bulk send; 25 MB upload | Before each production release | No errors; memory stays under the instance limit |
| Manual check | Checklist | What automation cannot judge | Before each production release | Checklist below |

### End-to-end journeys

1. Register, verify email, upload a PDF, sign it yourself, download.
2. Send to one signer by email link; signer signs; both receive the sealed file.
3. Three signers in sequence; the second cannot act before the first.
4. Three signers in parallel signing at the same moment.
5. Signer with email OTP: wrong code, resend, right code, sign.
6. Signer with passcode: lockout after five wrong attempts.
7. Signer declines with a reason; sender is told; nobody else can sign.
8. Sender voids; signer's link shows the document as cancelled.
9. Link expires; signer sees the expiry message.
10. Reminder is sent once per window; signer email is corrected and the old link dies.
11. Template with two roles, used and completed.
12. Bulk send from a spreadsheet; one bad row is reported.
13. Free plan hits its limit; upgrade in the gateway's test mode; limit lifts.
14. Upload a sealed file to the verification page: genuine. Upload an edited copy: not genuine.
15. From phase 3: a Hindi document sent by WhatsApp link, signed on a phone profile.
16. From phase 5: a team member sends from a shared template; an outsider is refused.

### Rules for test data and providers

- Tests never touch staging or production databases. The four old scripts that do are retired in S-13.
- No real credentials, emails or phone numbers in the repository. Gitleaks enforces it.
- Every outside service has a fake used in CI: email, SMS, WhatsApp, payment gateway, eSign provider, cloud storage, timestamp server.
- Payment and eSign tests against real services use only their test modes.

### CI gates

| When | What must pass |
| --- | --- |
| Pull request | Lint, unit, API integration, security regression, access matrix, component tests, both builds, Gitleaks, `npm audit` at high severity |
| Merge to `main` | All of the above, end-to-end on one browser, PDF validation, deploy to staging, smoke test on staging |
| Nightly | End-to-end on three browsers and a phone profile, provider sandboxes, full-history secret scan |
| Production release | Green nightly, load smoke, manual checklist, a tagged release |

### Manual checklist before each production release

- [ ] Sign on a real Android phone over mobile data
- [ ] Open the sealed PDF in Adobe Acrobat Reader and read the signature panel
- [ ] Read the request, reminder and completion emails in Gmail and Outlook
- [ ] Print a Hindi document and check the text
- [ ] Restore last night's backup into a scratch project
- [ ] Walk the pricing page and one real low-value payment, then refund it

### When a new bug appears

Write a failing test that reproduces it, fix it, and keep the test. Security bugs also get a line in the traceability table.

## Traceability: finding to task to test

All 28 audit findings, the claims table and two new findings map to at least one task and one named regression test. Test paths are under `server/tests/`.

| Finding | What it is | Tasks | Regression test |
| --- | --- | --- | --- |
| C1 | Secrets in a public repo | P0-01 to P0-07, S-08 | Gitleaks full-history scan |
| C2 | Open self-upgrade route | P1-01 | `security/c2-dev-upgrade.test.js` |
| C3 | Unverified payment webhooks | P1-02 | `security/c3-webhook-signature.test.js` |
| C4 | Signer check skippable | P1-04, P1-05, P1-06 | `security/c4-signer-gate.test.js` |
| C5 | Files public | P1-07, P1-08, P1-11 | `security/c5-file-access.test.js` |
| C6 | Self-sign without ownership | P1-09 | `security/c6-sign-ownership.test.js` |
| C7 | No cryptographic seal | P2-01 to P2-04 | `pdf/seal-validates.test.js` |
| H1 | Renewals never processed | P1-03, P2-14, P2-15, P2-16 | `billing/renewal-lifecycle.test.js` |
| H2 | Mock checkout fallback | P1-01, P1-03, P2-14 | `billing/no-mock-fallback.test.js` |
| H3 | No rate limits | P1-05, P1-19, P1-20 | `security/h3-rate-limits.test.js` |
| H4 | Server fetches signer URLs | P1-10, P1-11 | `security/h4-signature-input.test.js` |
| H5 | Admin auto-promotion | P1-25, P1-26, P2-17 | `security/h5-admin.test.js` |
| H6 | Verification page leaks data | P1-27, P2-05 | `security/h6-verify-response.test.js` |
| H7 | Audit trail not immutable | P2-06, P2-07, P2-08 | `audit/chain-integrity.test.js` |
| H8 | Signing rules not enforced | P1-13 to P1-16 | `signing/state-rules.test.js` |
| H9 | Later signers see the unsigned file | P1-08, P1-17, P2-04 | `signing/cloud-storage-version.test.js` |
| H10 | Open origins, URL tokens, weak cookies | P1-21, P1-22 | `security/h10-origin-and-tokens.test.js` |
| H11 | State in one process | P1-16, P2-09 to P2-13 | `jobs/idempotency.test.js`, `signing/parallel-lock.test.js` |
| M1 | Non-English text deleted | P3-01, P3-02 | `pdf/unicode-fields.test.js` |
| M2 | No upload limits | P1-28 | `uploads/limits.test.js` |
| M3 | Quota not atomic | P1-29 | `billing/quota-atomic.test.js` |
| M4 | Fields matched by name | P1-14 | `signing/field-ownership.test.js` |
| M5 | Reminder fields dropped | P1-30 | `reminders/dedupe.test.js` |
| M6 | Weak account hygiene | P1-23, P1-24, P2-22 | `auth/tokens-and-passwords.test.js` |
| M7 | Links never expire | P1-18 | `signing/link-expiry.test.js` |
| M8 | Health check always fails | P1-31 | `platform/health.test.js` |
| M9 | No tests, CI or error tracking | S-03 to S-13 | The CI workflow itself |
| M10 | No deletion or export; data in browser storage | P2-19, P2-20 | `privacy/delete-and-export.test.js` |
| Claims | Product text the code does not support | P1-32 | `content/banned-claims.test.js` |
| New 1 | Real-looking credentials hardcoded in a test script | P0-05, S-13 | Gitleaks |
| New 2 | Request values passed unchecked into database lookups | P1-12 | `security/input-validation.test.js` |

## Release, non-code work, risks and decisions

### Release process

| Step | Rule |
| --- | --- |
| Environments | Local, staging and production, each with its own database, bucket and secrets |
| Deploy | Merge to `main` deploys to staging automatically. A tagged release deploys to production after the gates in the testing section. |
| Migrations | Run before the new code, after a fresh backup. Every migration has a tested reverse. |
| Feature flags | Billing, WhatsApp, Aadhaar eSign and the API each sit behind a flag, off by default in production |
| Rollback | Route traffic back to the previous Cloud Run revision; reverse the migration if one ran |
| Monitoring | Error tracking, an uptime check on the health endpoint, alerts on error rate, failed jobs and failed payment events |
| Incidents | A written runbook covering who is told and when, including the 72-hour breach report |

### Work only you can do

| Item | Start | Blocks |
| --- | --- | --- |
| Rotate credentials and make the repo private | Today | Everything |
| Create staging and production cloud projects | Setup | All deploys |
| Interview 20 to 30 small organisations | Now, alongside phases 0 to 2 | The decision to build phases 4 to 6 |
| Trademark search on PactDoc; secure the domain | Phase 1 | P3-12 |
| Engage a contracts lawyer: terms, privacy notice, template packs | Phase 1 | P1-32 wording, P4-09 onward |
| Register the business and for tax | Phase 2 | Payment gateway live mode, P4-16, P6-01 |
| Choose and pay for database, email and hosting tiers | Phase 2 | P2-13, P2-18 |
| DNS records for pactdoc.com | Phase 2 | P2-13, P3-12 |
| SMS sender registration and WhatsApp business verification | Start of phase 2 | P3-07, P3-08 |
| Commission translations | Phase 3 | P3-05, P4-12 |
| Quotes and sandbox access from two eSign aggregators | Phase 3 | All Aadhaar tasks |
| Recruit 20 to 30 beta organisations | End of phase 2 | Public launch |

### Risks

| Risk | Effect | Response |
| --- | --- | --- |
| Regional scripts do not render correctly in pdf-lib | Phase 3 and the template renderer slip | The two spikes, P3-01 and P4-02, run early; the browser-engine fallback is known |
| Provider approvals take longer than the code | WhatsApp, SMS or Aadhaar features wait | Start applications one phase early; ship email-only first |
| The workspace migration damages ownership data | Users lose or gain access wrongly | Access matrix written first; migration rehearsed on a copy of production; reverse migration tested |
| Eight to eleven months is a long time for one person | Loss of momentum before revenue | Public launch at the end of phase 3 or early phase 4; let interviews decide the order after that |
| Nobody will pay | Phases 4 to 6 are wasted | Interviews and the private beta are the gate; stop and rethink if the signals in the India strategy fail |
| Lawyer or tax steps stall | Templates and live payments wait | Engage them in phase 1, not when needed |

### Decisions I need from you

- [ ] Is India the launch market? Answered 11 October: yes. Then the Middle East, South-East Asia and Japan, then Europe and the US.
- [ ] Does the current database hold real users or only your test accounts? Answered 11 October: development data only.
- [ ] Fresh private repository, or rewrite the history of the current one?
- [ ] Razorpay only at launch, or Stripe for dollar customers as well?
- [ ] Has anyone bought the lifetime plan? If so, what do they keep?
- [ ] Rough monthly budget for hosting, email and the lawyer.
- [ ] Should implementation start now with the setup tasks and phase 1? Answered 11 October: yes; see Progress.
