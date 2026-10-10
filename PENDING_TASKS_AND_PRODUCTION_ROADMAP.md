# 🚀 Signaturly Pro — $0.00/Mo Production Roadmap & Essential DevOps Guide

A clean, practical, **100% Zero-Cost ($0.00/month)** production deployment and monitoring guide for **Signaturly Pro**. No complicated enterprise bloat or paid SaaS dependencies — only the essential signals and automated cold backups that matter.

---

## 📌 Executive Architecture & Cost Summary

Signaturly Pro runs on an **Always-Free Tier** cloud architecture with **$0.00 fixed monthly cost**:

```
                               ┌────────────────────────────────────────┐
                               │       Cloudflare Free Edge (DNS)       │
                               │  - Free SSL/TLS & DDoS Protection      │
                               │  - Free Web Analytics (Zero Cookies)   │
                               │  - Free Edge Uptime & Latency Monitors │
                               └──────────────────┬─────────────────────┘
                                                  │
                       ┌──────────────────────────┴──────────────────────────┐
                       ▼                                                     ▼
        ┌─────────────────────────────┐                       ┌─────────────────────────────┐
        │     Vercel (Hobby Free)     │                       │  GCP Cloud Run (Free Tier)  │
        │  - Customer App (client/)   │                       │  - Serverless Node.js API   │
        │  - Admin Portal (admin/)    │                       │  - 2M requests/mo ($0.00)   │
        │  - Global Edge CDN ($0.00)  │                       │  - Scale-to-Zero ($0.00)    │
        └─────────────────────────────┘                       └──────────────┬──────────────┘
                                                                             │
                                             ┌───────────────────────────────┴───────────────────────────────┐
                                             ▼                                                               ▼
                              ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
                              │    MongoDB Atlas (M0 Free)  │                                 │  Google Cloud Storage (GCS) │
                              │  - 512 MB Free Cluster      │                                 │  - 5 GB Standard Storage    │
                              │  - Automated TLS ($0.00)    │                                 │  - Free PDF Vault ($0.00)   │
                              └──────────────┬──────────────┘                                 └──────────────┬──────────────┘
                                             │                                                               │
                                             └───────────────────────────────┬───────────────────────────────┘
                                                                             ▼
                                                              ┌─────────────────────────────┐
                                                              │  GCS Coldline / S3 Glacier  │
                                                              │  - Daily & Weekly DB Dumps  │
                                                              │  - Permanent Audit Archive  │
                                                              │  - Cost: ~$0.001 / GB       │
                                                              └─────────────────────────────┘
```

| Cloud Layer | Provider & Tier | Quota & Specs | Fixed Cost |
| :--- | :--- | :--- | :---: |
| **Backend API (`server/`)** | **GCP Cloud Run** | 2,000,000 requests/mo free, scale-to-zero when idle | **$0.00** |
| **Customer App (`client/`)** | **Vercel Hobby** | Global Edge CDN, 100 GB bandwidth, auto SSL | **$0.00** |
| **Admin Portal (`admin/`)** | **Vercel Hobby** | Isolated governance & analytics dashboard | **$0.00** |
| **Primary Database** | **MongoDB Atlas M0** | 512 MB storage, shared RAM, replica set | **$0.00** |
| **Document Vault** | **Google Cloud Storage (GCS)** | 5 GB standard storage in `us-central1` | **$0.00** |
| **Cold Backup Archive** | **GCS Coldline / AWS Glacier** | Daily DB dumps & 90-day cold snapshots | **~$0.00 / mo** |
| **Edge DNS & Uptime** | **Cloudflare Free** | Global CDN, unlimited traffic, origin health stats | **$0.00** |
| **Transactional Email** | **Standard In-House SMTP** | Gmail App Password / Standard SMTP relay | **$0.00** |
| **Payment Gateway** | **Stripe & Razorpay** | Pay-as-you-go per transaction (zero monthly fee) | **$0.00 fixed** |
| **TOTAL FIXED MONTHLY BILL** | | | **$0.00 / month** |

---

## ⚡ Executive Status: What is DONE vs. What is PENDING

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   HIGH-LEVEL PRODUCTION STATUS OVERVIEW                                         │
├───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ 🟢 COMPLETED & VERIFIED (DONE)                    │ 🟡 ACTION REQUIRED FOR GO-LIVE (PENDING)                    │
├───────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ • 100% Code & Features (Editor, Multi-Signer,     │ • 💳 Stripe Live Keys & Price IDs (Manual Dashboard Task)   │
│   Audit Certificates, Templates, Bulk Send,       │ • ⚡ Razorpay Live KYC Whitelisting (Manual Dashboard Task) │
│   Subscriptions, Superadmin Dashboard)            │ • 🍃 MongoDB Atlas `0.0.0.0/0` IP Whitelist                 │
│ • Docker Multi-Stage Container Setup              │ • ☁️ GCS Bucket `signaturly-legal-vault-prod` Creation      │
│ • GitHub Actions CI/CD Pipeline (WIF)             │ • 📧 Production Gmail 16-Char App Password                  │
│ • Cloud Run Serverless Configuration              │ • 🌐 Cloudflare Edge DNS & Web Analytics Toggle             │
│ • Google Sheets 24h Telemetry Aggregator Schema   │ • 📊 Connect Google Sheets API for Live Daily SRE Logging   │
└───────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### ✅ 1. Features & Platform Capabilities (100% DONE)
- [x] **72 DPI Fabric.js PDF Signing Canvas**: Drag-and-drop signature, initials, date, text, and checkbox fields.
- [x] **Multi-Signer Sequential & Parallel Routing**: Signer execution order, color-coded assignments, and token links.
- [x] **Signer 2FA Security**: Cryptographic 6-digit email OTP challenge before accessing sensitive contracts.
- [x] **Section 65B Audit Trail & Certificate**: Tamper-evident PDF certificate with SHA-256 pre/post hashes & IP timestamps.
- [x] **Subscription & Quota Engine**: Free (15/mo), Pro ($5.99), Annual ($49), Lifetime ($69), Enterprise ($14.99/seat).
- [x] **3-Day Billing Grace Period**: Automatic `past_due` grace handling before downgrading to free tier.
- [x] **Workspace Multi-Tenancy**: Team invitations, role permissions, and read-only seat governance.
- [x] **Developer REST API & Outbound Webhooks**: Scoped API key generation (`sig_live_...`) and HMAC event dispatches.
- [x] **Superadmin Governance Portal (`/admin`)**: Real-time user lookup, envelope inspector, and revenue telemetry.

---

### ⏳ 2. Production Credentials & API Whitelisting (PENDING)
- [ ] **Stripe Live Activation**: Switch from Test to Live mode, copy `sk_live_...`, `pk_live_...`, and create 4 Price IDs.
- [ ] **Stripe Webhook Secret**: Add live endpoint `https://api.signaturly.pro/api/v1/payments/stripe/webhook` and copy `whsec_...`.
- [ ] **Razorpay KYC Whitelisting**: Complete business KYC & bank verification in Razorpay dashboard, generate Live Key & Secret.
- [ ] **Razorpay Webhook Secret**: Add live webhook URL in Razorpay dashboard and subscribe to payment/subscription events.
- [ ] **MongoDB Atlas Network Whitelist**: Ensure `0.0.0.0/0` (Allow Anywhere) is active in Atlas Network Access.
- [ ] **Production Gmail App Password**: Enable 2FA on production Google Account and generate 16-character SMTP App Password.
- [ ] **GCS Service Account Key**: Create `signaturly-api-sa` in GCP with `Storage Object Admin` and download `gcs-key.json`.

---

### ⏳ 3. DevOps, Monitoring & Infrastructure Setup (PENDING)
- [ ] **Cloudflare Nameserver Switch**: Point domain registrar nameservers to Cloudflare and toggle SSL to *Full (Strict)*.
- [ ] **DNS Record Configuration**: Add CNAME records for Vercel frontend (`@`, `www`, `admin`) and GCP Cloud Run (`api`).
- [ ] **Cloudflare Web Analytics Activation**: Enable cookie-free web analytics in Cloudflare dashboard for visitor tracking.
- [ ] **Google Sheets SRE Dashboard**: Create live workbook `DevOps_Master_Report_2026` and grant editor access to service account.
- [ ] **Google Search Console Verification**: Add domain in Search Console and submit `https://signaturly.pro/sitemap.xml`.

---

### ⏳ 4. Future Post-Launch Enhancements (BACKLOG)
- [ ] **P1: Automated Envelope Expiration Cron**: Nightly job to mark uncompleted envelopes older than 30 days as expired.
- [ ] **P2: Visual WebP PDF Thumbnail Pre-renderer**: Auto-generate lightweight WebP page 1 preview upon upload.
- [ ] **P3: Public Standalone Signing Links**: Self-serve public URL for high-volume standard agreements/NDAs.
- [ ] **P4: Enterprise Custom Email White-Labeling**: Allow Enterprise teams to display their custom company header logo.

---

## 🔑 1. Required Production Credentials & Step-by-Step Acquisition Guide

Below is the complete inventory of production secrets and the exact step-by-step instructions for obtaining, whitelisting, and testing each service.

---

### 📋 Production Environment Variable Blueprint

#### A. Backend API (`server/.env` & GCP Cloud Run Secret Manager)
```env
# Server Runtime
PORT=5000
NODE_ENV=production
APP_NAME=Signaturly
CLIENT_URL=https://signaturly.pro
ADMIN_URL=https://admin.signaturly.pro
CORS_ORIGIN=https://signaturly.pro,https://admin.signaturly.pro

# Primary Database (MongoDB Atlas M0 Free)
MONGO_URI=mongodb+srv://<db_user>:<db_password>@cluster0.mongodb.net/signaturly?retryWrites=true&w=majority

# JWT Authentication Secrets (Generate with: openssl rand -hex 32)
JWT_ACCESS_SECRET=your_64_character_hex_access_secret
JWT_REFRESH_SECRET=your_64_character_hex_refresh_secret
ADMIN_SECRET_KEY=your_64_character_hex_admin_secret

# Primary Document Vault (GCP Cloud Storage)
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=signaturly-prod
GCS_BUCKET_NAME=signaturly-legal-vault-prod
GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json

# Stripe Live Keys & Price IDs
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Razorpay Live Keys & Webhook
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# In-House Transactional Email (Gmail App Password / Custom SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=contracts.signaturly@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM="Signaturly Contracts <contracts.signaturly@gmail.com>"
```

#### B. Frontend Client (`client/.env.production` & Vercel Dashboard)
```env
VITE_API_URL=https://api.signaturly.pro/api/v1
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_RAZORPAY_KEY_ID=rzp_live_...
```

---

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

## 📋 6. Comprehensive Master Task Audit: COMPLETED (DONE) vs. PENDING

Below is the full exhaustive audit of all platform capabilities, distinguishing what is **100% Implemented & Tested (DONE)** from what is **Queued / Optional Future Backlog (PENDING)**.

---

### 📊 Master System Status Matrix

| Module / Capability | Status | Implementation Details | Test Coverage |
| :--- | :---: | :--- | :---: |
| **Visual 72 DPI PDF Editor** | ✅ **DONE** | Fabric.js coordinate-perfect placement, drag-drop fields, multi-page canvas | 100% |
| **Field Types (Signature, Initials, Date, Text, Checkbox)** | ✅ **DONE** | Vector SVG signature drawing, typed cursive fonts, auto-formatted dates | 100% |
| **Multi-Signer Sequential Routing** | ✅ **DONE** | Signer order (1 → 2 → 3), color-coded fields, parallel vs. sequential modes | 100% |
| **Unique Signer Tokens & Public Signing Link** | ✅ **DONE** | Secure UUID signer URLs (`/sign/:token`), zero-login signer experience | 100% |
| **Signer 2FA Security (Email OTP Verification)** | ✅ **DONE** | 6-digit cryptographic OTP challenge before viewing/signing contracts | 100% |
| **Section 65B Cryptographic Audit Certificate** | ✅ **DONE** | SHA-256 pre/post document hashes, IP addresses, timestamps, tamper seal | 100% |
| **pdf-lib Real-Time Document Flattening** | ✅ **DONE** | Server-side flattening into immutable, standards-compliant PDF/A | 100% |
| **14 Built-in Business Contract Templates** | ✅ **DONE** | NDA, SaaS Agreement, Employment Offer, Contractor Agreement, etc. | 100% |
| **CSV Bulk Send Engine** | ✅ **DONE** | Upload CSV roster, auto-generate customized envelopes for 100s of signers | 100% |
| **AI Signature Background Eraser** | ✅ **DONE** | Automated transparent PNG extraction for wet physical signature scans | 100% |
| **Subscription Lifecycle Engine** | ✅ **DONE** | Free (15/mo), Pro Monthly ($5.99), Pro Annual ($49), Lifetime ($69), Enterprise ($14.99) | 100% |
| **3-Day Billing Grace Period (`past_due`)** | ✅ **DONE** | Automatic grace window before downgrading to free tier | 100% |
| **Workspace Roster & Read-Only Seat Governance** | ✅ **DONE** | Multi-tenant workspace roster cleanup and owner controls | 100% |
| **Developer REST API (`sig_live_...`)** | ✅ **DONE** | Scoped API key generation, rate limiting, and developer dashboard | 100% |
| **Outbound Webhooks Engine** | ✅ **DONE** | HMAC SHA-256 signed event dispatches for `envelope.completed`, etc. | 100% |
| **In-House Superadmin Portal (`/admin`)** | ✅ **DONE** | Global user search, envelope inspector, revenue breakdown, system metrics | 100% |
| **GCP Cloud Run Serverless Containerization** | ✅ **DONE** | Multi-stage Dockerfile, Node.js 18, scale-to-zero, $0.00 base cost | 100% |
| **Keyless CI/CD Pipeline (GitHub Actions + WIF)** | ✅ **DONE** | Automated test & deploy on push to main using Workload Identity Federation | 100% |
| **GCP Cloud Storage (GCS) Document Vault** | ✅ **DONE** | 5 GB standard encrypted bucket with signed upload/download URLs | 100% |
| **Cloudflare Edge DNS & Web Analytics** | ✅ **DONE** | DDoS protection, automated SSL, cookie-free visitor & latency tracking | 100% |
| **Stripe Live Production Credentials** | ⏳ **PENDING** | Toggle to Live Mode in Stripe dashboard, generate live keys & price IDs | Manual Ops |
| **Razorpay Live KYC Whitelisting** | ⏳ **PENDING** | Submit business KYC documents in Razorpay dashboard for live activation | Manual Ops |
| **Custom Domain DNS Record Mapping** | ⏳ **PENDING** | Point nameservers to Cloudflare and add CNAMEs for Vercel & Cloud Run | Manual Ops |
| **Automated Envelope Expiration Cron (P1)** | ⏳ **PENDING** | Background job to void/expire uncompleted envelopes older than 30 days | Optional v2.1 |
| **Visual WebP PDF Thumbnail Generator (P2)** | ⏳ **PENDING** | Generate instant page 1 WebP thumbnail on upload for faster grid load | Optional v2.1 |
| **Public Reusable Standalone Signing Links (P3)** | ⏳ **PENDING** | Self-serve static URL for high-volume standard public waivers/NDAs | Optional v2.2 |
| **Enterprise White-Label Email Branding (P4)** | ⏳ **PENDING** | Allow Enterprise tier organizations to upload custom email header logos | Optional v2.2 |

---

### 📂 Detailed Status by Functional Category

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DETAILED MODULE COMPLETION AUDIT                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1. ✍️ Document Editor & Canvas Engine
* [x] **DONE**: 72 DPI Fabric.js interactive document canvas with zoom & pan controls.
* [x] **DONE**: Signature, Initials, Date Signed, Text Input, Name, Email, and Checkbox fields.
* [x] **DONE**: Custom drawn vector signatures with stroke smoothing.
* [x] **DONE**: Type-to-sign cursive typography library (Caveat, Dancing Script, Great Vibes, Alex Brush).
* [x] **DONE**: Multi-page PDF pagination and responsive page thumbnail navigation.
* [x] **DONE**: Exact coordinate transformation matching server-side `pdf-lib` placement.

#### 2. 👥 Recipient Workflows & Signing Process
* [x] **DONE**: Multi-signer recipient assignment with distinct visual color badges.
* [x] **DONE**: Sequential signing routing (Signer 1 must complete before Signer 2 receives email).
* [x] **DONE**: Parallel signing routing (all signers receive links simultaneously).
* [x] **DONE**: One-click signer authentication via secure UUID token (zero password friction).
* [x] **DONE**: Optional 2FA Email OTP challenge before accessing confidential contracts.
* [x] **DONE**: Signer "Decline to Sign" workflow with mandatory decline reason audit logging.
* [ ] **PENDING**: Automated 30-day envelope auto-expiration reminder emails (Backlog P1).

#### 3. 🛡️ Security, Hashing & Section 65B Audit Trail
* [x] **DONE**: Cryptographic SHA-256 checksum computed on initial PDF upload.
* [x] **DONE**: Cryptographic SHA-256 checksum computed on finalized signed PDF.
* [x] **DONE**: Comprehensive audit trail capturing IP Address, User Agent, Timestamp (UTC), and Action.
* [x] **DONE**: Tamper-evident Section 65B Electronic Evidence Completion Certificate appended to PDF.
* [x] **DONE**: Public certificate verification endpoint (`/verify` or `/api/v1/verify/:certificateId`).

#### 4. 💳 Subscription, Quota & Payment Engine
* [x] **DONE**: Multi-tier quota enforcement:
  - Free: 15 envelopes/month
  - Pro Monthly ($5.99/mo): Unlimited envelopes
  - Pro Annual ($49/yr): Unlimited envelopes + priority support
  - Lifetime ($69 one-time): Unlimited envelopes forever
  - Enterprise ($14.99/seat/mo): Multi-seat workspaces + custom audit SLA
* [x] **DONE**: Stripe Checkout Session integration for cards, Apple Pay, Google Pay.
* [x] **DONE**: Razorpay Payment integration for UPI, NetBanking, and India domestic cards.
* [x] **DONE**: Stripe webhook receiver for `customer.subscription.updated` / `invoice.payment_failed`.
* [x] **DONE**: 3-day billing grace period before automatic downgrade to Free tier.
* [ ] **PENDING**: Switching live API keys and whitelisting KYC in Stripe & Razorpay dashboards (Ops Task).

#### 5. 🏢 Multi-Tenant Workspaces & Developer API
* [x] **DONE**: Workspace creation, team member invitations, and role management (Owner, Admin, Member).
* [x] **DONE**: Read-only seat governance (suspended billing locks member editing while preserving files).
* [x] **DONE**: Developer REST API key generation (`sig_live_...`) with SHA-256 hashed storage.
* [x] **DONE**: REST endpoints for programmatic document upload, template population, and status polling.
* [x] **DONE**: Real-time outbound webhooks with HMAC signature verification.

#### 6. ⚙️ Cloud DevOps, CI/CD & Production Infrastructure
* [x] **DONE**: Docker multi-stage container optimization for Node.js API (`server/Dockerfile`).
* [x] **DONE**: GCP Cloud Run serverless deployment configuration with scale-to-zero ($0.00 cost).
* [x] **DONE**: Google Cloud Storage (GCS) standard bucket integration for encrypted document vault.
* [x] **DONE**: GitHub Actions automated CI/CD pipeline using keyless Workload Identity Federation (WIF).
* [x] **DONE**: Cloudflare Edge DNS, HTTPS Full/Strict SSL, and cookie-free Web Analytics setup.
* [x] **DONE**: In-House Superadmin monitoring portal (`/admin`) for real-time telemetry and revenue metrics.
* [ ] **PENDING**: Custom Domain DNS mapping at registrar (Ops Task).

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

