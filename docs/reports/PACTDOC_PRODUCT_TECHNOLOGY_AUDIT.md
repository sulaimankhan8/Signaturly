# PactDoc Product & Technology Audit

Oct 10, 2026 · @sulaiman khan

## Verdict

PactDoc is a feature-rich prototype that is not yet safe to launch: seven issues let an outsider read documents, forge signatures or get paid plans for free. The product surface is broad for a solo build, but the security and legal-evidence layer underneath it is thin. The code still carries the old name, Signaturly, everywhere.

This audit read the whole backend (about 6,000 lines excluding template text) and the key client files. No code was changed. Nothing was run against production.

**Do today, before anything else:** the GitHub repository `sulaimankhan8/Signaturly` is public, and `.github/workflows/deploy-backend.yml:74` contains the live MongoDB connection string with password, both JWT secrets, the admin key and the SMTP password. Anyone can read your database and mint login tokens for any user. Rotate every one of those values, move them to GitHub Secrets or GCP Secret Manager, and treat the current database as exposed. Deleting the line is not enough because it stays in git history.

| # | Critical issue | Effect |
| --- | --- | --- |
| 1 | Production secrets committed to a public repo | Full database and account takeover |
| 2 | `POST /api/billing/dev-upgrade` is open to every logged-in user | Anyone gets Enterprise for free |
| 3 | Razorpay webhook has no signature check; Stripe check is optional and broken | Anyone can upgrade any account with one HTTP request |
| 4 | Signer OTP and passcode are enforced only in the browser | Identity check can be skipped; audit trail then claims it was verified |
| 5 | `/uploads/*` serves every file to anyone | Contracts are readable without login |
| 6 | `POST /api/pdf/sign` never checks document ownership | Any user can stamp content onto another user's document |
| 7 | Signed PDFs carry no cryptographic signature | Documents cannot prove integrity on their own; "tamper-proof" claims are not true yet |

Readiness by area, my judgement from the code:

| Area | State |
| --- | --- |
| Core flow (upload, place fields, send, sign, download) | Works |
| Templates, bulk send, reminders, expiry | Works, with bugs |
| Billing | Simulation only; real payments not safely wired |
| Teams and workspaces | Shell only; documents are not shared with a team |
| Developer API and webhooks | Keys and webhook records are created but never used |
| Security | Not launch-ready |
| Legal evidence | Weaker than the product copy claims |
| Tests and monitoring | Four manual scripts, no automated tests, no error tracking |

## Fix status as of 11 October 2026

20 of the 28 findings are fixed in code and covered by automated tests, 4 are mostly fixed, 2 partly and 2 are open. None of it is deployed, and the leaked credentials are still not rotated. "Fixed" below means fixed on branch `fix/phase1-security` with a passing regression test. The findings themselves, further down, are left as written on 10 October.

| Finding | Status | What remains |
| --- | --- | --- |
| C1 Secrets in a public repo | Open | Rotation and a private repo are the owner's to do. The values are removed from four files but remain in git history. The audit also missed that the deployed JWT secrets were placeholder values and the admin key was the default. |
| C2 Self-upgrade route | Fixed |  |
| C3 Unverified payment webhooks | Fixed |  |
| C4 Signer check skippable | Fixed |  |
| C5 Files public | Fixed |  |
| C6 Self-sign without ownership | Fixed |  |
| C7 No cryptographic seal | Mostly fixed | Completed PDFs are sealed with a service certificate. No trusted timestamp yet; the certificate is self-signed; not yet opened in Adobe Acrobat. |
| H1 Renewals not processed | Fixed | Billing stays switched off in production until checkout is rebuilt |
| H2 Mock checkout fallback | Fixed |  |
| H3 No rate limits | Fixed |  |
| H4 Server fetches signer URLs | Fixed |  |
| H5 Admin auto-promotion | Mostly fixed | Admin 2FA |
| H6 Verification page leaks data | Fixed |  |
| H7 Audit trail not immutable | Fixed |  |
| H8 Signing rules not enforced | Fixed |  |
| H9 Later signers see the unsigned file | Fixed |  |
| H10 Origins, URL tokens, cookies | Fixed |  |
| H11 State in one process | Mostly fixed | Database lock and job queue are in place; the scheduler jobs must be created |
| M1 Non-English text deleted | Open | Phase 3 |
| M2 No upload limits | Fixed |  |
| M3 Quota not atomic | Fixed |  |
| M4 Fields matched by name | Fixed |  |
| M5 Reminder fields dropped | Fixed |  |
| M6 Weak account hygiene | Mostly fixed | Sender 2FA and single sign-on |
| M7 Links never expire | Fixed |  |
| M8 Health check always fails | Fixed |  |
| M9 No tests, CI or error tracking | Partly fixed | 153 API tests and CI exist; browser tests, lint gate and error tracking do not; `nuke-db` still ships in the image |
| M10 No deletion or export | Partly fixed | Export and deletion exist on the server; saved signatures and contacts are still in browser storage |
| Unsupported claims | Fixed | A test keeps the words out |

Five further problems were found and fixed during the work: unchecked request values reaching database lookups, a forged PDF passing verification by quoting a genuine hash, any user able to download any document's audit certificate, templates creatable from another user's document, and non-Latin names crashing certificate generation.

## What exists today

The app is a three-part JavaScript monorepo: a React customer app, a React admin panel and one Express API backed by MongoDB. About 27,500 lines across 230 tracked files.

| Layer | Technology | Notes |
| --- | --- | --- |
| Customer app | React 18, Vite 7, Redux Toolkit, Tailwind, react-pdf / pdf.js | Hosted on Vercel; 24 pages |
| Admin panel | React, Vite, Tailwind | Separate Vercel app; one 1,375-line dashboard page |
| API | Node 20, Express 5, Mongoose 9 | One container on Cloud Run, 512 MB, max 1 instance, scales to zero |
| Database | MongoDB Atlas (free tier) | 11 collections |
| File storage | Local disk or Google Cloud Storage | Switch by env var |
| PDF engine | pdf-lib | Draws images and text onto pages |
| Email | Nodemailer over Gmail SMTP | Falls back to console logging when unset |
| Background work | node-cron and an in-process EventEmitter | No queue, no retries |
| Payments | Stripe and Razorpay, loaded only if keys exist | `stripe` is not in `package.json` |
| CI/CD | One GitHub Action that builds and deploys the API | No lint, test or build check |

Feature inventory, with how complete each one is in the code:

| Feature | State | Detail |
| --- | --- | --- |
| Sign a PDF yourself | Working | Draw, type or upload a signature; initials; background remover |
| Field types | Working | Signature, initials, text, date, checkbox, radio |
| Send to several signers | Working | Parallel or sequential order, custom message, expiry date |
| Signer link | Working | No account needed; decline with reason |
| Signer identity check | Broken | Email OTP and passcode exist but can be bypassed |
| Templates with roles | Working | Custom templates plus a prebuilt library; paid tiers only |
| Bulk send from CSV | Working | One document per row; no quota check |
| Reminders and expiry | Partly | Cron jobs do not run while Cloud Run is scaled to zero |
| Void, resend, change signer email | Working |  |
| Audit trail and certificate PDF | Partly | Only sign events are hash-chained |
| Public verify page | Working | Leaks signer data to anyone with a hash |
| Live status updates | Partly | SSE and polling; in-memory, single instance only |
| Plans and quotas | Partly | Free tier capped at 15 sends a month; paid tiers unlimited |
| Checkout | Simulated | Falls back to a mock upgrade whenever Stripe fails |
| Workspaces and branding | Shell | Members and colours are stored; nothing uses them |
| API keys and webhooks | Shell | Stored, never authenticated or dispatched |
| Admin panel | Working | Users, plans, analytics, evidence certificate |
| Ads on free signing pages | Working | AdSense slot plus in-house ads |

## Errors and risks

There are 7 critical, 11 high and 10 medium findings. Paths are relative to the repo root; `server/src/` is shortened to `src/`.

### Critical: fix before any real user signs anything

| # | Issue | Where | Fix |
| --- | --- | --- | --- |
| C1 | Live MongoDB URI, JWT secrets, admin key and SMTP password are in a public repo. `CORS_ORIGIN=*` is set there too. | `.github/workflows/deploy-backend.yml:74` | Rotate all values. Use GitHub Secrets and `--set-secrets`. Purge history or recreate the repo as private. |
| C2 | Any logged-in user can set their own plan to Enterprise or Lifetime. | `src/routes/billing.routes.js:16`, `src/services/subscription.service.js:198` | Remove the route in production builds. |
| C3 | Razorpay webhook trusts any request. Stripe signature check is skipped when the secret is unset, and cannot pass when set, because the JSON parser consumes the raw body first. | `src/controllers/webhook.controller.js:12,65`, `src/app.js:15` | Verify both signatures. Mount webhook routes before `express.json`. Reject when no secret is configured. |
| C4 | The sign endpoint never checks that the signer passed OTP or passcode. Calling verify-passcode on an OTP signer marks them verified. The audit entry then says "2FA Verified". | `src/services/recipient.service.js:128`, `src/routes/otp.routes.js:74`, `src/services/pdfSign.service.js:316` | Check `authVerified` on the server for session load, file access and signing. Record the real method used. |
| C5 | The file handler ends with an unconditional send, so every stored PDF and signature image is public. Any valid signer token also unlocks every file. | `src/middlewares/file.middleware.js:61,88` | Deny by default. Tie each token to its own document. Serve only short-lived signed URLs. |
| C6 | Self-sign accepts any document id and never compares the owner. A user can alter another user's document, including a completed one. | `src/controllers/sign.controller.js:10`, `src/services/pdfSign.service.js:67` | Check ownership and reject documents that are already sent or completed. |
| C7 | The final PDF is only an image stamped on a page. There is no certificate-based signature, no timestamp and no embedded audit data. | `src/services/pdfSign.service.js:304` | Add a PAdES seal with a trusted timestamp on completion. See the technology section. |

### High

| # | Issue | Where | Fix |
| --- | --- | --- | --- |
| H1 | Paid plans end 30 days after checkout because renewals are never processed. Only two Stripe events are handled. Paying customers get downgraded. | `src/services/subscription.service.js:102`, `src/controllers/webhook.controller.js:24` | Drive plan state from `invoice.paid`, `customer.subscription.updated` and `.deleted`. |
| H2 | Checkout silently falls back to a mock upgrade whenever Stripe errors, and `stripe` is not installed. | `src/services/billing.service.js:98`, `server/package.json` | Fail closed. Add the dependency. Use Stripe Price IDs. |
| H3 | No rate limiting or security headers anywhere. Login, OTP email, passcode and password reset can be hammered. Passcode has no attempt cap. | `src/app.js`, `src/routes/otp.routes.js:80` | Add `helmet` and `express-rate-limit` per IP and per token. |
| H4 | The server fetches any URL a signer submits as a signature image, and will read local file paths. | `src/services/pdfSign.service.js:37-46`, `src/services/storage.service.js:82` | Accept only data URLs or your own storage keys. |
| H5 | Anyone who knows the admin key and has any account is promoted to superadmin permanently. The key has a hardcoded default. Admin and user tokens share one secret. | `src/routes/admin.routes.js:47`, `src/config/env.js:18` | Never auto-promote. Separate secret, required at boot, plus 2FA. |
| H6 | Public verify returns signer names, emails, IP addresses and a download link to anyone holding a hash or a document id. | `src/services/verification.service.js:102,167` | Return valid or invalid, timestamps and masked names only. |
| H7 | The audit trail is not immutable. Deleting a document deletes its log. Most events are written without a hash. Unhashed logs pass verification. The chain has no secret or outside anchor. | `src/controllers/pdf.controller.js:196`, `src/events/consumers/audit.consumer.js:41`, `src/services/auditLedger.service.js:81` | One writer for all events, all chained. Keep logs after deletion. Anchor the final hash in the signed PDF. |
| H8 | Signing rules are not enforced on the server: signing order, declined or completed state, required fields, viewer role. Consent is a browser checkbox that is never stored. The signer is marked signed before the PDF is stamped. | `src/services/recipient.service.js:128-205`, `client/src/pages/SigningPage.jsx:183` | Validate state and fields first, stamp, then mark signed in one transaction. Store consent text, time and IP. |
| H9 | In cloud storage mode the code looks for the signed file on local disk, so later signers see the unsigned original. | `src/controllers/signing.controller.js:23`, `src/controllers/sign.controller.js:43` | Use the storage service's `fileExists`. |
| H10 | Any origin is allowed with credentials. Login tokens are accepted in the URL. The refresh cookie is not `Secure` and is `SameSite=Lax`, so sessions will not survive a reload unless app and API share a parent domain. | `src/app.js:31`, `src/middlewares/auth.middleware.js:12`, `src/controllers/auth.controller.js:24` | Strict origin list. Header-only tokens. `Secure` cookies on `app.` and `api.pactdoc.com`. |
| H11 | Everything stateful lives in one process: signing lock, live updates, event queue, cron. Failed emails are swallowed. Reminders and expiry do not run while scaled to zero. | `src/services/pdfSign.service.js:15`, `src/config/email.js:42`, `src/config/cron.js` | Move jobs to Cloud Tasks or a queue with retries. Trigger cron with Cloud Scheduler. |

### Medium

| # | Issue | Where |
| --- | --- | --- |
| M1 | Non-ASCII text is stripped before drawing, so Hindi, Arabic and accented names vanish from signed PDFs. | `src/services/pdfSign.service.js:121` |
| M2 | No upload size limit, 50 MB JSON bodies and whole PDFs held in memory on a 512 MB instance. Only the MIME header is checked. | `src/config/multer.js:4`, `src/app.js:15` |
| M3 | Quota is counted after sending and not atomically. Bulk send is never counted. | `src/controllers/send.controller.js:27`, `src/controllers/bulk.controller.js` |
| M4 | Fields are matched to signers by name as well as id, so two signers with the same name can fill each other's fields. | `src/services/recipient.service.js:162` |
| M5 | Reminder counters are written to fields the schema does not have, so they are dropped. | `src/services/reminder.service.js:32`, `src/models/Recipient.model.js` |
| M6 | Weak account hygiene: 6-character passwords, no email verification, no 2FA or SSO, refresh and reset tokens stored in plain text, no rotation. | `src/controllers/auth.controller.js:178`, `src/models/User.model.js:26` |
| M7 | Signing links never expire unless the sender sets a date. Bulk send returns every signing link in the response. | `src/services/bulkSend.service.js:140` |
| M8 | The container health check calls a route that needs login, so it always fails. | `server/Dockerfile`, `docker-compose.yml` |
| M9 | No automated tests, no lint or build step in CI, no error tracking. `nuke-db` scripts ship inside the production image. Logs print user emails. | `server/package.json`, `src/scripts/` |
| M10 | No account deletion, data export or retention policy. Saved signatures and contacts sit in browser `localStorage`. | `client/src/pages/Settings.jsx:137`, `SendDocument.jsx:143` |

### Claims the code does not support

Product text, emails and certificates say things a customer's lawyer could challenge. Change the wording or build the feature.

| Claim in the product | What the code does |
| --- | --- |
| "Merkle" audit certificate and "immutable ledger" | A simple hash chain over sign events only, deletable with the document |
| "Zero-knowledge" admin | Admins can list all documents and files are stored unencrypted |
| "Email OTP & Timestamp" for every signer | Hardcoded string, shown even when no OTP was used |
| eIDAS "notarized evidentiary certificates" | No qualified or advanced signature; simple electronic signature only |
| "Digital signature" | An image drawn on the page, with no certificate |

## Feature gaps versus competitors

The largest gaps are a cryptographic seal on the PDF, a working API, real team accounts and language support. Prices and features below were read from vendor pages on 10 October 2026.

| Capability | Who offers it | PactDoc today | Priority |
| --- | --- | --- | --- |
| Certificate seal on the finished PDF, with timestamp | [Documenso](https://docs.documenso.com/developers/self-hosting/signing-certificate), [DocuSeal](https://github.com/docusealco/docuseal), DocuSign | Missing | Must have |
| Enforced signer checks: email OTP, SMS, ID document | [DocuSeal](https://www.docuseal.com/pricing) charges $2 per ID check and $0.20 per SMS | OTP built but bypassable; no SMS or ID | Must fix |
| Public API, embedded signing, signed webhooks | DocuSeal at $0.20 per completed document; [Documenso](https://documenso.com/pricing) Platform at $250 a month | Keys and webhook records only | High |
| Shared team workspace, roles, SSO | Documenso Teams, DocuSeal Pro (SAML), [Dropbox Sign](https://sign.dropbox.com/info/pricing) Premium | Member list only; documents stay personal | High |
| Signing in many languages | DocuSeal signs in 14 languages | English only; non-Latin text is deleted | High |
| Aadhaar eSign and e-stamping for India | [Zoho Sign](https://www.zoho.com/sign/pricing.html), Leegality, Digio | Missing | High if India is the home market |
| Sender 2FA and email verification | All major vendors | Missing | High |
| Shareable signing link or public form | DocuSeal free tier, DocuSign Business Pro | Missing | Medium |
| More field types: dropdown, attachment, formula, conditional | DocuSeal has 12 types; conditional fields on Pro | 6 types | Medium |
| Word and image upload, documents generated from data | DocuSeal (DOCX and HTML templates), PandaDoc | PDF only | Medium |
| Integrations: Drive, Zapier, HubSpot, Salesforce | Dropbox Sign, Documenso (Zapier) | None | Medium |
| Witness, delegate, approver and CC roles | Zoho Sign Standard | Role names stored, not enforced | Medium |
| Server-side contacts, folders, search | All | Contacts in browser storage only | Medium |
| Payment collection at signing | DocuSeal, Zoho Sign Enterprise | Missing | Later |
| Qualified signatures (EU QES) | DocuSeal at $2 to $4 each; Documenso via a trust provider | Missing | Later |
| AI field detection and contract summaries | DocuSeal ($100 a month add-on), DocuSign IAM | Missing | Later, possible differentiator |
| SOC 2 or ISO 27001, data residency | DocuSign, Dropbox Sign Premium | None | Later |

PactDoc already has four things the cheap tiers of rivals often lack: CSV bulk send, a public verification page, a prebuilt template library and an India evidence certificate. They are worth keeping once the base is secure.

## How competitor technology works

Every serious e-signature product rests on the same four layers: proof of intent, proof of identity, a tamper-evident file and an evidence record. PactDoc has a version of the first and fourth, a broken second and no third. Points without a link are general industry knowledge, not read from a source today.

| Layer | What competitors do | PactDoc |
| --- | --- | --- |
| Intent and consent | Signer accepts an electronic-records disclosure; the text, time and IP are stored with the envelope | Checkbox in the browser, not stored |
| Identity | Emailed link by default; optional OTP, SMS, knowledge questions or ID document, each logged | Emailed link; OTP and passcode not enforced |
| Tamper-evident file | On completion the platform signs the PDF with its own X.509 certificate and adds a trusted timestamp. Any later edit breaks the signature in any PDF reader. | Image drawn on the page; hash kept only in the database |
| Evidence record | A certificate page listing every event, attached to or delivered with the PDF. DocuSign calls it the [Certificate of Completion](https://www.docusign.com/trust/security/esignature). | Separate certificate PDF built from a partial log |

**The seal is the part to copy first.** Documenso signs with a `.p12` certificate file, a Google Cloud HSM key, or a third-party trust provider for advanced and qualified signatures. Its docs note that a [self-signed certificate](https://docs.documenso.com/developers/self-hosting/signing-certificate) proves integrity but shows a warning in Adobe Acrobat, because it is not on Adobe's trust list. A certificate bought from a listed authority removes the warning. Documenso's repo is tagged for the PAdES standard, the PDF signature format used across the EU.

**Signature levels.** EU law has three tiers: simple, advanced and qualified. Typed or drawn signatures with an audit trail are simple. Qualified signatures need a licensed trust provider and an identity check, which is why DocuSeal resells them at $2 to $4 each. US law (ESIGN, UETA) does not tier signatures. In India, ordinary e-signatures support contract validity, but Aadhaar eSign and certificate-based signatures carry stronger legal presumptions and can only be issued through licensed providers. Have a lawyer confirm this for the document types you target.

**Stacks of the two open-source leaders**, both AGPL-3.0, both readable on GitHub:

|  | [Documenso](https://github.com/documenso/documenso) | [DocuSeal](https://github.com/docusealco/docuseal) |
| --- | --- | --- |
| GitHub stars | 15.4k | 18.7k |
| Language and framework | TypeScript, React Router, Hono, tRPC | Ruby on Rails, Vue |
| Database | PostgreSQL with Prisma | SQLite, PostgreSQL or MySQL |
| PDF | pdf-lib fork plus a dedicated signing library | Built-in signing and signature verification |
| Tests | Playwright end-to-end | Not checked |
| Storage | Not checked | Disk, S3, Google Cloud Storage, Azure |

**Platform practices** PactDoc lacks: document encryption at rest (DocuSign states AES-256), SOC 2 and ISO 27001 audits, job queues with retries for email and webhooks, HMAC-signed webhooks, a free API sandbox, and end-to-end tests on the signing flow.

**What this means in practice.** PactDoc already uses pdf-lib, the same base Documenso builds on. Adding a seal is a contained change: sign the final PDF with a platform certificate, add a timestamp, and store the sealed file as the only downloadable copy. Start with a self-signed certificate, move the key into Google Cloud KMS, then buy an Adobe-trusted certificate once revenue justifies it.

## What can and cannot be done

The current architecture can carry a secure product for individuals and small businesses, but not teams, an API business or enterprise buyers without structural work.

| Goal | With today's architecture? | What it takes |
| --- | --- | --- |
| Launch simple e-signing for individuals and freelancers | Yes, after the critical fixes | Roadmap phase 1 |
| Legally valid simple e-signatures for ordinary contracts in the US, EU and India | Yes | Stored consent, enforced signer checks, one complete audit log |
| Tamper-evident sealed PDFs | Yes | A PDF signing library on top of pdf-lib, a certificate and a timestamp service |
| Signing in Hindi, Arabic and other scripts | Yes | Embed Unicode fonts in pdf-lib and stop stripping characters |
| Real subscriptions | Yes | Rebuild the Stripe and Razorpay lifecycle around their events |
| Public API, embedded signing, webhooks | Partly | API-key authentication, a webhook sender with retries, docs and a sandbox |
| More than one server instance | No | Move the signing lock, live updates, events and cron out of the process |
| Large PDFs or heavy volume | No | Stream files, raise memory, process stamping in a worker |
| Company accounts with shared documents | No | Documents belong to one user. Ownership must move to the workspace, with roles checked on every route. |
| Aadhaar eSign | Not by yourself | Integrate a licensed provider such as eMudhra, Digio or Leegality |
| EU qualified signatures | Not by yourself | Integrate a qualified trust service provider |
| Selling to enterprises | No | SSO, audit certifications, data residency, uptime commitments |
| Regulated use such as HIPAA or 21 CFR Part 11 | No | Dedicated compliance programme |
| "Zero-knowledge" storage | No | The server must read PDFs to stamp them. Offer encryption at rest and strict access logs instead. |
| Running at $0 a month | Demo only | The free database tier has no backups and Gmail SMTP is not built for transactional mail |

## Roadmap

Fix security first, then legal evidence, then growth features. Time ranges are my estimates for one developer.

### Phase 1: make it safe (1 to 2 weeks)

1. Rotate every leaked secret, move them to a secret store, and make the repo private or rewrite its history.
2. Remove the dev-upgrade route and the mock checkout fallback from production.
3. Verify Stripe and Razorpay webhook signatures and reject unsigned calls.
4. Enforce signer verification, signing order, document state and required fields on the server.
5. Lock down `/uploads`: deny by default, scope each token to its document.
6. Add ownership checks to self-sign and block changes to sent or completed documents.
7. Add rate limits, security headers, a strict origin list and `Secure` cookies.
8. Fix the cloud-storage path bug so later signers see earlier signatures.
9. Stop fetching signer-supplied URLs.
10. Reword every claim the code does not support, and rename Signaturly to PactDoc throughout.

### Phase 2: make it trustworthy (4 to 8 weeks)

1. Seal completed PDFs with a certificate and trusted timestamp.
2. Write one hash-chained audit log for all events, including stored consent, and keep it after deletion.
3. Rebuild subscriptions on payment-provider events, with a customer portal.
4. Move email to a transactional provider on the pactdoc.com domain with SPF, DKIM and DMARC.
5. Move jobs to a queue with retries and trigger schedules externally.
6. Add Unicode font support.
7. Add email verification, sender 2FA and stronger password rules.
8. Add end-to-end tests for send and sign, run lint, build and tests in CI, and add error tracking.
9. Move to a database tier with backups and write a restore drill.
10. Publish privacy, retention and account-deletion flows.

### Phase 3: make it sell (the following quarter)

1. Workspace-owned documents with roles.
2. Public API, signed webhooks and embedded signing.
3. Shareable signing links and public forms.
4. Aadhaar eSign and SMS OTP through a provider.
5. Integrations: Google Drive, Zapier, then one CRM.
6. More field types, Word upload, server-side contacts and folders.
7. AI field detection.
8. SOC 2 readiness, once business customers ask for it.

## Sources

Vendor pages opened on 10 October 2026: [Documenso pricing](https://documenso.com/pricing), [Documenso signing certificate docs](https://docs.documenso.com/developers/self-hosting/signing-certificate), [Documenso on GitHub](https://github.com/documenso/documenso), [DocuSeal pricing](https://www.docuseal.com/pricing), [DocuSeal on GitHub](https://github.com/docusealco/docuseal), [Zoho Sign pricing](https://www.zoho.com/sign/pricing.html), [Dropbox Sign pricing](https://sign.dropbox.com/info/pricing), [DocuSign eSignature security](https://www.docusign.com/trust/security/esignature). Code findings come from the repository at commit `fbb1a4d`.
