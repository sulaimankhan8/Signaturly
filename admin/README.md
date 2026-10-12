# PactDoc admin app

The operator's app. It is a separate site from the customer app, with its own sign-in.

## What it does

| Screen | For |
| --- | --- |
| Overview | Money received, paying accounts, new accounts, documents by day, and what needs attention |
| Users | Finding an account; its plan, payments and documents; changing its plan; suspending it |
| Documents | Details of any document, its signers, its audit trail and whether the trail's chain is intact; the evidence certificate. Never the document's contents |
| Audit log | Every recorded event, by event, document and date |
| Payments | What the payment providers reported, with invoices |
| Plans | What is sold, for how much, how, and what each plan includes: changing a plan's name, price, period, allowance, level and features; whether it is sold as a subscription, prepaid or both; creating it at Razorpay; adding a plan; retiring one. Also the top-up packs of extra documents |
| Subscriptions | Accounts whose plan renews by itself: plan, what each renewal charges, the next charge, and those with a payment overdue or running out |
| Templates | Guided templates: draft, preview, publish, retire, record a lawyer's review |
| Operations | The state of the service, background jobs and webhook deliveries |
| Admin activity | What admins did here: sign-ins, plan changes, accounts opened, files downloaded |

Every figure is read from the server when the screen opens. Plan names and prices come from the server too; the app holds none of its own.

## Run it

```bash
npm install
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:5000
npm run dev             # http://localhost:5174
```

The API must be running, and an admin account must exist. Make one from the repository root:

```bash
npm run seed:admin -- --email=you@example.com --password="at least 12 characters"
```

Sign in with that email and password and the value of `ADMIN_SECRET_KEY` from `server/.env`. If the account has two-step sign-in, the code is asked for next. On a production server two-step sign-in is required: switch it on for the account in the customer app's Settings first.

## Check it

```bash
npm run lint
npm test        # component tests
npm run build
```

Browser tests of the whole app against the real server are in `../e2e/tests/admin.desktop.spec.js`.

## How it is put together

| Folder | Holds |
| --- | --- |
| `src/pages/` | One file per screen |
| `src/components/ui/` | The shared pieces: buttons, table, dialog, toasts, chart |
| `src/layout/` | The frame every screen sits in |
| `src/auth/` | The session and the guard on every screen |
| `src/api/` | The one API client |
| `src/lib/` | Formatting (rupees, dates in India's time, status names) and hooks |

The session token is kept for the browser tab only and lasts eight hours. Filters and page numbers live in the address, so a screen can be reloaded or linked to.

## Deploy

On Vercel: root directory `admin`, framework Vite, one variable `VITE_API_BASE_URL` set to the API's address. `vercel.json` sends every path to the app and sets the security headers.
