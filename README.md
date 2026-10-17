# PactDoc

Send a document for electronic signature and get back a sealed copy with a record of who signed it and when. Built India-first: prices in rupees, signing in English and Hindi, ready-made templates for rentals, housing societies, HR and small firms.

**Status, 11 October 2026:** not in production. The code on this branch is tested but has not been deployed, and it is not safe to put in front of real users until the blockers in [PENDING_TASKS_AND_PRODUCTION_ROADMAP.md](PENDING_TASKS_AND_PRODUCTION_ROADMAP.md) are cleared. No lawyer has reviewed the templates or the legal wording.

## What is in this repository

| Folder | What it is | Runs on |
| --- | --- | --- |
| `server/` | The API: Node 22, Express 5, MongoDB | port 5000 |
| `client/` | The app people use, and the public pages: React 18, Vite | port 5173 |
| `admin/` | The operator's app: users, plans, templates | port 5174 |
| `e2e/` | Browser tests that drive the real app in Chrome | its own ports |
| `docs/` | API reference, decisions, reports, and an archive of older documents | |

Two documents at the top level are kept current:

- [PENDING_TASKS_AND_PRODUCTION_ROADMAP.md](PENDING_TASKS_AND_PRODUCTION_ROADMAP.md): where things stand, what blocks a launch, and how to set up each outside service (section 10).
- [PACTDOC_IMPLEMENTATION_PLAN.md](PACTDOC_IMPLEMENTATION_PLAN.md): every task with its id and its test.

## Run it on your machine

You need Node 22 or newer and a MongoDB database: either a local MongoDB, or a development cluster on MongoDB Atlas. Do not point a development machine at a database that holds real customers' data.

### 1. Install

```bash
npm run install:all
```

### 2. Settings

Each of the three apps reads a `.env` file in its own folder. Copy the examples and fill them in:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp admin/.env.example admin/.env
```

In `server/.env`, for local use, set:

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `development` |
| `APP_URL` | `http://localhost:5173` |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:5174` |
| `MONGO_URI` | your development database |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SECRET_KEY`, `ADMIN_JWT_SECRET` | a different random value for each: `openssl rand -hex 32` |
| `STORAGE_PROVIDER` | `local` (files go to `server/uploads/`) |

The server refuses to start if one of the four secrets is missing or still a placeholder, and says which.

`client/.env` and `admin/.env` each need one line: `VITE_API_BASE_URL=http://localhost:5000`.

Email: with `SMTP_USER` and `SMTP_PASS` set, real emails are sent. Without them, each email is printed in the server's terminal instead, signing link and codes included, which is the easiest way to work locally.

### 3. Start the three apps

Each in its own terminal, from the top folder:

```bash
npm run dev:server    # http://localhost:5000  (check: http://localhost:5000/api/health)
npm run dev:client    # http://localhost:5173
npm run dev:admin     # http://localhost:5174
```

On its first start against a database, the server copies the ready-made templates into it.

### 4. Bring an existing database up to date

If the database has accounts or documents from before October 2026, run the data migrations once. They move accounts to the current plans and put each person's documents in a workspace of their own. Back the database up first.

```bash
npm run migrate
```

### 5. Make an admin account

```bash
npm run seed:admin -- --email=you@example.com --password="at least 12 characters"
```

Sign in to the admin app at http://localhost:5174 with that email and password, and the value of `ADMIN_SECRET_KEY` from `server/.env`. The same account can sign in to the main app, where it is on the Enterprise plan, so every feature is open to it.

On a production server an admin must also have two-step sign-in: switch it on for the account in the main app's Settings before signing in to the admin app.

### What behaves differently on a development machine

| Thing | On your machine | In production |
| --- | --- | --- |
| Payments | No provider is needed. Buying anything asks "simulate this payment?" and then behaves as if it was paid | Razorpay; off until switched on |
| Templates | All 73 are shown, marked "not yet reviewed" | Hidden until a lawyer's review is recorded |
| SMS and WhatsApp | Printed in the server's terminal | Not available yet |
| Scheduled work (reminders, expiry, queued jobs) | Timers inside the server | Called from outside by a scheduler |
| Sealing certificate | Made automatically on first use | Supplied as a secret |
| Aadhaar eSign | Off. Postponed to the next version | Off |

### Things to try

1. Sign up in the app, upload a PDF, place a signature field, send it to another email address of yours.
2. Open the signing link (from the email, or from the server's terminal), sign, and download the sealed copy.
3. Templates: fill in the rent agreement by answering questions and send it.
4. Billing: buy extra documents (simulated) and download the invoice.
5. Teams: on the Team workspaces page, buy Business (simulated), start a team, invite a second account.
6. Settings, Security: switch on two-step sign-in with an authenticator app.
7. With the admin account: Developer settings, make a test API key, then follow [docs/api/README.md](docs/api/README.md).

## Tests

```bash
npm test             # server tests, about 7 minutes
npm run test:e2e     # browser tests, about 7 minutes; needs Google Chrome installed
```

Both use a throwaway in-memory database and never touch the one in `server/.env`. The browser tests build both web apps and start their own copy of everything on ports 5055, 4173, 4174 and 5056.

## Scripts in `server/`

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API and restarts it when a file changes |
| `npm test` | Runs the server tests |
| `npm run migrate` | Runs data migrations that have not run yet |
| `npm run seed:admin -- --email=... --password=...` | Makes or promotes an admin account |
| `npm run seal:generate` | Makes a certificate for sealing PDFs and prints it as two secrets |
| `npm run db:nuke -- --yes-wipe-everything` | **Drops the whole database** in `MONGO_URI` and deletes every uploaded file. Refuses without that flag, and in production |

## Documents

| Where | What |
| --- | --- |
| [PENDING_TASKS_AND_PRODUCTION_ROADMAP.md](PENDING_TASKS_AND_PRODUCTION_ROADMAP.md) | Status, blockers, the owner's to-do list, production settings, service set-up |
| [PACTDOC_IMPLEMENTATION_PLAN.md](PACTDOC_IMPLEMENTATION_PLAN.md) | The 132 tasks, execution progress, and test states |
| [docs/architecture/](docs/architecture/) | Performance audit, design system tokens, PWA/caching strategy, and Next.js migration |
| [docs/api/](docs/api/) | The public API: developer guide and OpenAPI specification |
| [docs/decisions/](docs/decisions/) | Architectural Decision Records (ADRs) |
| [docs/reports/](docs/reports/) | The October 2026 audit, market research, and India strategy |
| [docs/archive/](docs/archive/) | Pre-audit documents (including original deployment guide and early plans) kept for reference |
