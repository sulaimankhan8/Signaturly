# PactDoc — Pending Tasks and Production Roadmap

**Status as of 11 October 2026.** PactDoc is the product name; the code, emails and old documents still say Signaturly until the rename in phase 3.

The security fixes (phase 1) are almost complete and the core of the trust layer (phase 2) is built, with 153 automated tests passing. None of it is committed or deployed yet, and the product is **not safe to put in front of real users** until the blockers below are cleared.

Related documents in this folder:

| Document | What it is |
| --- | --- |
| `PACTDOC_IMPLEMENTATION_PLAN.md` | Every task with its id, files and test. The ids below (P1-07, P2-03) refer to it. |
| `PACTDOC_PRODUCT_TECHNOLOGY_AUDIT.md` | The audit findings (C1 to M10) the fixes answer. Do not publish while the repo is public. |
| `PACTDOC_INDIA_STRATEGY_BUILD_PLAN.md` | Market, industries, templates, plans. |
| `PACTDOC_BUSINESS_MARKET_REPORT.md` | Competitors and pricing. |

---

## 1. Where things stand

| Phase | Goal | Tasks | Done | Partly | Not started |
| --- | --- | ---: | ---: | ---: | ---: |
| Setup | Test harness, CI, environments | 13 | 4 | 2 | 7 |
| 0. Emergency | Leaked credentials are dead | 8 | 0 | 1 | 7 |
| 1. Secure | Access-control and abuse bugs fixed | 32 | 29 | 3 | 0 |
| 2. Trust | Sealed PDFs, audit log, jobs, billing | 22 | 9 | 7 | 6 |
| 3. India fit | Languages, WhatsApp and SMS, India hosting, rename | 14 | 0 | 0 | 14 |
| 4. Templates and plans | Template engine, first packs, new pricing | 17 | 0 | 0 | 17 |
| 5. Teams | Workspace-owned documents and roles | 11 | 0 | 0 | 11 |
| 6. Strong signatures and API | Aadhaar eSign, public API, Enterprise | 15 | 0 | 0 | 15 |
| **Total** | | **132** | **42** | **13** | **77** |

Where the work lives: branch `fix/phase1-security`, uncommitted. Run the tests with `npm --prefix server test`.

Checked so far: 153 automated API tests, and both web apps build. Not checked: clicking through the app in a browser, the signing record's printed layout, and how the seal appears in Adobe Acrobat.

---

## 2. Blockers before any real user

| # | Blocker | Who | Detail |
| --- | --- | --- | --- |
| 1 | Leaked credentials are still live | You | The database password, SMTP password and other values were committed in `.github/workflows/deploy-backend.yml`, `docs/DEPLOYMENT_GUIDE.md`, `scratch/create_deployment_docx.py` and `docs/CLOUD_DEPLOYMENT_DOCKER_GCP_MASTERCLASS.docx`. All four files are now cleaned in the working tree, but the values remain in git history on a public repository. Rotate every one. |
| 2 | Production ran on placeholder secrets | You | The deployed JWT secrets were short, guessable placeholder values and the admin key was the built-in default, which the admin login page also pre-filled. Anyone could have forged a login. The new code refuses to start with such values. |
| 3 | New secrets do not exist yet | You | The deploy now reads 11 secrets from Secret Manager (section 7). Until they are created, a deploy fails. |
| 4 | No backups | You | The free database tier has none. Move to a tier with backups and run one restore. |
| 5 | Nothing is committed | You decide | About 100 changed files sit uncommitted on one branch. |
| 6 | Legal wording and templates unreviewed | You | A lawyer has not reviewed the terms, privacy notice, consent text or certificates. |
| 7 | No browser test | Code | The fixes are tested through the API only. A click-through, then Playwright tests, are still owed. |

---

## 3. Your to-do list

Tasks only the account owner can do, in the order they block things.

- [ ] Make the GitHub repository private (P0-01)
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
- [ ] Engage a contracts lawyer: terms, privacy notice, consent text, certificates, template packs
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

### Setup (4 of 13)

Test harness with an in-memory database (S-03), test helpers (S-04), email outbox for tests (S-05), and a CI workflow that runs tests, builds and a secret scan on every pull request (S-08).

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

---

## 5. Partly done

| Task | Done | Still to do |
| --- | --- | --- |
| P0-06 Secrets out of the workflow | The workflow reads secrets from Secret Manager | You create the secrets |
| S-09 Deploy gated by tests | Tests must pass before deploy | Separate staging and production deploys |
| S-13 Retire old scripts | The two credential-bearing scripts are deleted | Remove `verify-*.js` and `nuke-db` from the production image |
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
| S-07 | Playwright browser tests | Code |
| S-11 | Database migrations tool | Code |
| S-12 | Structured logger with redaction; error tracking | Code, plus an error-tracking account |
| P2-13 | Transactional email provider and bounce handling | Your provider choice |
| P2-16 | Billing page: plan, invoices, cancel | Code, after P2-14 |
| P2-18 | Database tier with backups; restore drill | You |
| P2-20 | Saved signatures and contacts on the server, not in the browser | Code |
| P2-21 | Storage encryption key and file access log | Code and cloud settings |
| P2-22 | Optional 2FA for senders | Code |

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
| A-10 | Names in non-Latin scripts print as "?" on the signing record until Unicode fonts land | 3 (with P3-02) |
| A-11 | Rewrite the user guide, deployment guide and Word documents after the rename; they describe features inaccurately | 3 |
| A-12 | Rotate-certificate procedure: documents sealed with an old certificate stop showing as "sealed by this service" | 2 |

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

| Name | Example |
| --- | --- |
| `CORS_ORIGIN` | `https://app.pactdoc.com,https://admin.pactdoc.com` (exact origins, never `*`) |
| `APP_URL` | `https://app.pactdoc.com` |
| `GCS_BUCKET_NAME` | your bucket name |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | from your mail provider |

Optional: `BILLING_ENABLED` (off by default in production), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SIGNING_LINK_TTL_DAYS` (30), `FILE_URL_TTL_SECONDS` (3600), `TRUST_PROXY` (1 on Cloud Run).

### Scheduler jobs

Each sends a `POST` with the header `X-Internal-Secret: <INTERNAL_JOB_SECRET>`.

| Path | How often |
| --- | --- |
| `/api/internal/jobs/run` | Every minute |
| `/api/internal/cron/reminders` | Every 4 hours |
| `/api/internal/cron/expirations` | Hourly |
| `/api/internal/cron/subscriptions` | Hourly |

### Web apps

Both use `VITE_API_BASE_URL`, set to the API's address without `/api` (for example `https://api.pactdoc.com`). The app and the API must share a parent domain, or sign-in will not survive a page reload.

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
- The free plan's limit of 15 documents a month is now enforced exactly, and bulk send counts against it.

---

## 9. Later phases

Full task lists are in `PACTDOC_IMPLEMENTATION_PLAN.md`. Each phase is gated by something outside the code.

| Phase | Tasks | First thing to settle | Outside dependency |
| --- | ---: | --- | --- |
| 3. India fit | 14 | Whether the PDF library renders Hindi, Tamil and similar scripts correctly (P3-01) | SMS sender registration, WhatsApp business verification, translators, DNS |
| 4. Templates and plans | 17 | Which engine renders guided templates (P4-02) | Lawyer for template packs; tax registration for invoices |
| 5. Teams | 11 | Access-matrix tests before the data migration (P5-03) | None |
| 6. Strong signatures and API | 15 | Quotes and sandbox access from two eSign providers (P6-01) | Provider contract; registered business |

Market order agreed on 11 October 2026: India first; then the Middle East, South-East Asia and Japan; then Europe and the US. The later markets need right-to-left and CJK text, which should be kept in mind when the font and translation work is done in phase 3.

---

## Appendix: earlier reference material

Everything below was written before the October 2026 audit and has **not been re-verified**. It is kept for the step-by-step account set-up notes. The old status tables that sat here were removed because they marked unfinished features as complete. Where this appendix disagrees with sections 1 to 9 above, the sections above are right.

Known corrections:

| The appendix says | Correct |
| --- | --- |
| Env names `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` | The code reads `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| `VITE_API_URL=https://api.../api/v1` | `VITE_API_BASE_URL=https://api...` with no path; there is no `/api/v1` |
| Webhook URLs under `/api/v1/payments/...` | `/api/webhooks/stripe` and `/api/webhooks/razorpay` |
| Download a `gcs-key.json` service-account key | Not needed. On Cloud Run the service's own identity is used. Do not create key files. |
| Allow database access from `0.0.0.0/0` | That leaves the password as the only barrier. Acceptable only with a strong, rotated password; restrict by address once a fixed outbound address is affordable. |
| Secrets passed with `--set-env-vars` | Secrets come from Secret Manager with `--set-secrets`; see section 7 |
| Everything runs at $0.00 a month | True for a demo only. Production needs a database tier with backups and a transactional email service. |
| Domain `signaturly.pro` | The product is PactDoc; plan for `app.`, `api.` and `admin.pactdoc.com` |
| "Section 65B" certificates | The current law is Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 |
| Workspaces, developer API and webhooks are complete | They are shells; see phases 5 and 6 |

### 🛠️ Step-by-Step Credentials Acquisition Playbook

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CREDENTIALS ACQUISITION & ACTIVATION WORKFLOW                                    │
├────────────────────┬──────────────────────────────────┬─────────────────────────────────────────────────────────┤
│ Provider           │ Portal Link                      │ Key Deliverables & Action Items                         │
├────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 1. 💳 Stripe       │ dashboard.stripe.com             │ Live Secret Key, Webhook Secret (`whsec`), 4 Price IDs │
│ 2. ⚡ Razorpay     │ dashboard.razorpay.com           │ KYC Activation, Live Key ID & Secret, Webhook Secret    │
│ 3. 🍃 MongoDB      │ cloud.mongodb.com                │ M0 Free Cluster, DB User, `0.0.0.0/0` Network Whitelist │
│ 4. ☁️ Google Cloud │ console.cloud.google.com         │ Service Account JSON Key, GCS Bucket `us-central1`      │
│ 5. 📧 Gmail SMTP   │ myaccount.google.com/security    │ 2FA Setup + 16-character App Password                   │
│ 6. 🌐 Cloudflare   │ dash.cloudflare.com              │ Nameservers, SSL Full/Strict, Web Analytics Toggle      │
│ 7. 🚀 Vercel       │ vercel.com/dashboard             │ SPA Environment Variables, Custom Domain CNAMEs         │
└────────────────────┴──────────────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

#### 1. 💳 Stripe (Live Payments, Subscriptions & Webhooks)

1. **Activate Live Mode**:
   - Log in to [Stripe Dashboard](https://dashboard.stripe.com).
   - Toggle off **Test Mode** (switch to **Live Mode** in the top right).
   - Complete your business profile (Business name, Tax ID / PAN / EIN, payout bank account).
2. **Obtain API Keys**:
   - Navigate to **Developers** → **API keys**.
   - Copy **Publishable key** (`pk_live_...`) → set in `VITE_STRIPE_PUBLISHABLE_KEY`.
   - Click **Reveal live key** to copy **Secret key** (`sk_live_...`) → set in `STRIPE_SECRET_KEY`.
3. **Create the 4 Product Price IDs**:
   - Go to **Product catalog** → **Add product**:
     * **Product 1**: Name: `Signaturly Pro Monthly` | Pricing model: Standard recurring | Price: `$5.99` / month → Copy `price_...` into `STRIPE_PRO_MONTHLY_PRICE_ID`.
     * **Product 2**: Name: `Signaturly Pro Annual` | Pricing model: Standard recurring | Price: `$49.00` / year → Copy `price_...` into `STRIPE_PRO_ANNUAL_PRICE_ID`.
     * **Product 3**: Name: `Signaturly Lifetime` | Pricing model: One-time payment | Price: `$69.00` → Copy `price_...` into `STRIPE_LIFETIME_PRICE_ID`.
     * **Product 4**: Name: `Signaturly Enterprise` | Pricing model: Standard recurring | Price: `$14.99` / month / seat → Copy `price_...` into `STRIPE_ENTERPRISE_PRICE_ID`.
4. **Configure Webhook Endpoint**:
   - Navigate to **Developers** → **Webhooks** → **Add an endpoint**.
   - **Endpoint URL**: `https://api.signaturly.pro/api/v1/payments/stripe/webhook`
   - **Select Events to listen for**:
     * `checkout.session.completed`
     * `customer.subscription.created`
     * `customer.subscription.updated`
     * `customer.subscription.deleted`
     * `invoice.payment_succeeded`
     * `invoice.payment_failed`
   - Click **Add endpoint** → Click **Reveal Signing secret** (`whsec_...`) → set in `STRIPE_WEBHOOK_SECRET`.

---

#### 2. ⚡ Razorpay (Live Payments & KYC Whitelisting)

1. **Activate Live Account (KYC Whitelisting)**:
   - Log in to [Razorpay Dashboard](https://dashboard.razorpay.com).
   - Complete KYC Verification under **Account & Settings** → **Business Profile** (Upload GST/PAN, Bank Statement, and Website Terms/Refund Policy).
   - Once Razorpay team marks KYC as **Activated**, switch to **Live Mode**.
2. **Generate Live API Key**:
   - Go to **Account & Settings** → **API Keys** → **Generate Live Key**.
   - Download the key details or copy immediately:
     * **Key ID** (`rzp_live_...`) → set in `RAZORPAY_KEY_ID` (backend) & `VITE_RAZORPAY_KEY_ID` (frontend).
     * **Key Secret** → set in `RAZORPAY_KEY_SECRET`.
3. **Configure Webhooks**:
   - Go to **Account & Settings** → **Webhooks** → **Add New Webhook**.
   - **Webhook URL**: `https://api.signaturly.pro/api/v1/payments/razorpay/webhook`
   - **Secret**: Enter a strong custom passphrase (e.g. 32-character random string) → set in `RAZORPAY_WEBHOOK_SECRET`.
   - **Active Events**:
     * `payment.captured`
     * `payment.failed`
     * `subscription.charged`
     * `subscription.halted`
     * `subscription.cancelled`

---

#### 3. 🍃 MongoDB Atlas (M0 Always-Free Database & IP Whitelist)

1. **Create Free M0 Cluster**:
   - Log in to [MongoDB Atlas](https://cloud.mongodb.com).
   - Click **Create Deployment** → Select **M0 Free (Shared)**.
   - Choose Cloud Provider **Google Cloud** or **AWS** in region **`us-central1` (Iowa)** (matches Cloud Run region for zero latency).
2. **Create Database User**:
   - Go to **Security** → **Database Access** → **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `signaturly_admin`.
   - Password: Click *Autogenerate Secure Password* and copy it.
   - Database User Privileges: `Read and write to any database`.
3. **Configure Network Whitelist (Crucial for Cloud Run)**:
   - Go to **Security** → **Network Access** → **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - *Why*: Google Cloud Run uses dynamic serverless IP ranges. Atlas TLS encryption + username/password authentication keeps the connection secure.
4. **Obtain Connection String**:
   - Go to **Databases** → Click **Connect** on Cluster0 → **Drivers** (Node.js).
   - Copy connection string:
     ```
     mongodb+srv://signaturly_admin:<password>@cluster0.xxxxx.mongodb.net/signaturly?retryWrites=true&w=majority
     ```
   - Replace `<password>` with the password you created → set in `MONGO_URI`.

---

#### 4. ☁️ Google Cloud Platform (GCP Cloud Run & Storage Vault)

1. **Create GCP Project**:
   - Open [Google Cloud Console](https://console.cloud.google.com).
   - Create a new project: `signaturly-prod`.
2. **Enable Essential APIs**:
   - In the search bar, enable:
     * **Cloud Run Admin API**
     * **Artifact Registry API**
     * **Cloud Storage API**
     * **Cloud Monitoring API**
3. **Create GCS Storage Bucket (PDF Vault)**:
   - Go to **Cloud Storage** → **Buckets** → **Create**.
   - Name: `signaturly-legal-vault-prod` (globally unique).
   - Location: `us-central1` (Standard storage class).
   - Access control: **Uniform** (Enforce public access prevention).
4. **Create Service Account & Key**:
   - Go to **IAM & Admin** → **Service Accounts** → **Create Service Account**.
   - Name: `signaturly-api-sa`.
   - Grant Roles:
     * `Storage Object Admin` (to read/write signed contract PDFs).
     * `Artifact Registry Reader` (to pull container images).
     * `Monitoring Viewer` (for automated health & metrics collection).
   - Click the created Service Account → **Keys** tab → **Add Key** → **Create new key (JSON)**.
   - Save the downloaded JSON file as `gcs-key.json` and upload to Cloud Run / Secret Manager.

---

#### 5. 📧 Transactional Email (Google App Password / In-House SMTP)

1. **Enable 2-Step Verification**:
   - Log in to your production Gmail account (e.g. `contracts.signaturly@gmail.com`).
   - Go to [Google Account Security](https://myaccount.google.com/security) → Turn ON **2-Step Verification**.
2. **Generate App Password**:
   - In the Google Account search bar, type **App passwords**.
   - App name: `Signaturly Production`.
   - Click **Create**.
   - Google will generate a 16-character code (e.g. `abcd efgh ijkl mnop`).
3. **Configure Environment Variables**:
   - `EMAIL_HOST=smtp.gmail.com`
   - `EMAIL_PORT=465`
   - `EMAIL_SECURE=true`
   - `EMAIL_USER=contracts.signaturly@gmail.com`
   - `EMAIL_PASS=abcdefghijklmnop` (without spaces)

---

#### 6. 🌐 Cloudflare (Edge DNS, SSL & Web Analytics)

1. **Add Domain**:
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → Click **Add Site** → Enter `signaturly.pro` → Select **Free Plan**.
   - Copy the two assigned Cloudflare Nameservers (e.g. `dave.ns.cloudflare.com`, `emma.ns.cloudflare.com`).
   - In your domain registrar (GoDaddy, Namecheap, Google Domains), replace existing nameservers with Cloudflare's.
2. **Configure DNS Records**:
   - `CNAME` | `@` | `cname.vercel-dns.com` | Proxied (Orange Cloud ☁️)
   - `CNAME` | `www` | `cname.vercel-dns.com` | Proxied (Orange Cloud ☁️)
   - `CNAME` | `admin` | `cname.vercel-dns.com` | Proxied (Orange Cloud ☁️)
   - `CNAME` | `api` | `signaturly-api-xxxx.a.run.app` | Proxied (Orange Cloud ☁️)
3. **Set SSL & Web Analytics**:
   - Go to **SSL/TLS** → Set encryption mode to **Full (Strict)**.
   - Go to **Analytics & Logs** → **Web Analytics** → Click **Enable Web Analytics** for instant, cookie-free visitor tracking.

---

#### 7. 🚀 Vercel (Frontend Client & Admin Deployments)

1. **Import Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) → Click **Add New...** → **Project**.
   - Select your Git repository `Signaturly`.
2. **Deploy Customer App**:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Environment Variables**:
     * `VITE_API_URL` = `https://api.signaturly.pro/api/v1`
     * `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
     * `VITE_RAZORPAY_KEY_ID` = `rzp_live_...`
   - Click **Deploy** → In Project Settings → **Domains** → Add `signaturly.pro` and `www.signaturly.pro`.
3. **Deploy Admin Portal**:
   - Create a second project from the same repository.
   - **Root Directory**: `admin`
   - **Framework Preset**: `Vite`
   - **Environment Variables**:
     * `VITE_API_URL` = `https://api.signaturly.pro/api/v1`
   - Add domain `admin.signaturly.pro`.

---

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
