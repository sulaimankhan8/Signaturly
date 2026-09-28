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

## 🔑 1. Required Production Credentials Checklist

Set these in your GCP Cloud Run & Vercel Environment Variables:

### A. Stripe & Razorpay (Live Keys)
```env
# Stripe Live Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Razorpay Live Keys
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

### B. In-House Transactional Email (Standard SMTP / Gmail Relay)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-production-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM="Signaturly Contracts <your-production-email@gmail.com>"
```

### C. Google Cloud Storage & Cold Archive Vault
```env
GCS_BUCKET_NAME=signaturly-legal-vault-prod
GCS_PROJECT_ID=signaturly-prod
GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

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
│ • GCS Bucket Storage API         │                                 │                                   │
│   (Vault MB, Backup Status)      │                                 │ 🛡️ AUDIT: GCS Cold Storage Vault  │
│ • In-House Node Express Probes   │                                 │   `gs://signflow-ops-vault/csv/`  │
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

### 💾 2. Where the Data Is Stored (3-Tier Storage Strategy)

To achieve **100% zero-cost** while ensuring both instant visual access and immutable compliance logging, data is routed to 3 destinations:

#### Tier 1: Primary Live SRE Dashboard — **Google Sheets via Google Sheets API** (Live & Visual)
* **Format**: Google Sheets Workbook (`DevOps_Master_Report_2026`).
* **Why**:
  * **$0.00 Cost**: Zero server maintenance or database costs.
  * **Instant Collaboration**: Accessible to engineers and stakeholders on mobile or desktop.
  * **Automated Formatting**: Conditional formatting automatically highlights `RED` for 5xx errors or `YELLOW` for high CPU peaks.
  * **Native Trend Charts**: Automatically plots 30-day uptime and latency trendlines without needing Grafana.

#### Tier 2: Historical Database Archive — **MongoDB `system_metrics_daily` Collection** (Queryable API)
* **Format**: Structured JSON documents inside the existing MongoDB Atlas cluster.
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

#### Tier 3: Immutable Audit Trail — **GCS Coldline Storage Vault** (Disaster Recovery & Compliance)
* **Format**: Daily CSV and JSON exports saved into `gs://signflow-ops-vault/daily-reports/YYYY-MM-DD.csv`.
* **Why**: Provides an immutable, permanent historical record of system reliability and SLAs.

---

### 🚀 3. Operational Execution Workflow (How It Runs Every Night)

```
00:01 UTC ──► GitHub Actions Cron Workflow Triggers
               │
               ├── 1. Queries Cloudflare API for yesterday's 24h traffic & latency
               ├── 2. Queries GCP Cloud Monitoring for container CPU & RAM
               ├── 3. Pings MongoDB Atlas for connection pool & storage metrics
               ├── 4. Verifies GCS Coldline snapshot existence
               │
               ├── 5. Appends 1 Row to Google Sheets (`DevOps_Master_Report_2026`)
               ├── 6. Writes JSON document to MongoDB `system_metrics_daily`
               └── 7. Sends summary notification to Discord / Telegram / Slack webhook:
                      "🟢 Sep 28 DevOps Check: 99.95% Uptime | 0 Errors | ₹0.00 Spend"
```

---

## 🔍 5. SEO, Search Console & Google Indexing

1. **`client/public/robots.txt`** (Configured):
   - Allows search engines to index `/`, `/pricing`, `/compliance`, and `/verify`.
   - Protects private routes (`/dashboard`, `/editor/*`, `/workspaces`, `/sign/*`) from crawler exposure.
2. **`client/public/sitemap.xml`** (Configured):
   - Canonical `https://signaturly.pro/` URLs with weekly update frequencies.
3. **Google Search Console**:
   - Add site property `https://signaturly.pro` in [search.google.com/search-console](https://search.google.com/search-console).
   - Paste verification code into `client/index.html`.
   - Submit `https://signaturly.pro/sitemap.xml` in the Sitemaps tab.

---

## 💡 6. What is ALREADY Completed vs. Next Logical Suggestions

### ✅ Completed & Tested Modules (100% Passing Tests):
1. **Fabric.js Visual Signing Canvas**: Signature placement, initials, date, and text fields.
2. **Section 65B Audit Trail**: Cryptographic SHA-256 tamper-evident PDF certificates.
3. **Subscription Lifecycle & Quota Engine**:
   - Free (15/mo), Pro Monthly ($5.99), Pro Annual ($49), Lifetime ($69), Enterprise ($14.99/seat).
   - 3-Day Grace period (`past_due`) before automatic downgrade to `free`.
   - Workspace roster cleanup (owners can delete members in read-only mode).
4. **Developer REST API & Webhooks**: `sig_live_...` scoped API key generation and event dispatches.
5. **UI & Navbar Proportions**: Zero layout shifts, SVG iconography, persistent dashboard banner dismissals.

---

### 🚀 Recommended Next Phase Improvements:
- **P1: Automated Envelope Expiration Cron**: Mark envelopes older than 30/60 days as expired with email alerts.
- **P2: Visual PDF Thumbnail Pre-renderer**: Low-res WebP preview thumbnail generated on upload for document cards.
- **P3: Public Standalone Signing Links**: Self-service public URL for recurring standard NDAs/Waivers.
- **P4: Custom Email White-Labeling**: Allow Enterprise teams to display their own company logo in signing emails.

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

