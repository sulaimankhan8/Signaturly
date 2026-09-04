# 🚀 Signaturly Pro — Cloud Deployment, Docker, GCP & CI/CD Master Manual

---

## 📌 Table of Contents
1. [Cost Architecture ($0.00 / Month Free-Tier Matrix)](#1-cost-architecture-000--month-free-tier-matrix)
2. [Docker Deep Dive & Container Architecture Crash Course](#2-docker-deep-dive--container-architecture-crash-course)
3. [GCP Architecture Breakdown (Cloud Run, Artifact Registry, GCS, IAM)](#3-gcp-architecture-breakdown)
4. [Step-by-Step GCP Deployment Playbook (Every Command & Flag Explained)](#4-step-by-step-gcp-deployment-playbook)
5. [GitHub Actions CI/CD Pipeline (Sequential Execution Breakdown)](#5-github-actions-cicd-pipeline-sequential-execution-breakdown)
6. [Keyless Security: Workload Identity Federation (WIF) Explained](#6-keyless-security-workload-identity-federation-wif-explained)
7. [Frontend Deployment on Vercel & SPA Routing (`vercel.json`)](#7-frontend-deployment-on-vercel--spa-routing-verceljson)
8. [Environment Variables Reference (`.env.production`)](#8-environment-variables-reference-envproduction)
9. [Disaster Recovery, Tear Down & Project Migration Guide](#9-disaster-recovery-tear-down--project-migration-guide)

---

## 💰 1. Cost Architecture ($0.00 / Month Free-Tier Matrix)

Signaturly Pro is engineered to run at **$0.00 / month** in production by taking full advantage of the **Always-Free Tiers** of Google Cloud Platform, MongoDB Atlas, and Vercel Global Edge Network.

### 📊 Monthly Cost Breakdown Matrix

| Layer / Component | Provider & Tier | Quota & Specifications | Monthly Cost |
| :--- | :--- | :--- | :---: |
| **Backend API (`server/`)** | **GCP Cloud Run** (Serverless) | • 2,000,000 free requests/mo<br>• 360,000 GB-sec memory / 180,000 vCPU-sec<br>• Scale-to-Zero ($0.00 compute when idle) | **$0.00** |
| **Document Vault Storage** | **Google Cloud Storage (GCS)** | • 5 GB Standard Storage free in US regions (`us-central1`)<br>• 5,000 upload operations / 50,000 download ops | **$0.00** |
| **Container Registry** | **GCP Artifact Registry** | 500 MB free storage for container images | **$0.00** |
| **Customer App (`client/`)** | **Vercel Hobby Tier** | Global Edge CDN, 100 GB bandwidth, Automated SSL | **$0.00** |
| **Admin Portal (`admin/`)** | **Vercel Hobby Tier** | Isolated governance portal on Vercel CDN | **$0.00** |
| **Database** | **MongoDB Atlas M0** | 512 MB storage, shared RAM, TLS encrypted | **$0.00** |
| **SSL / TLS Certificates** | **Google & Vercel Managed** | Auto-renewing Let's Encrypt / Google RSA certificates | **$0.00** |
| **TOTAL ESTIMATED MONTHLY BILL** | | | **$0.00 / ₹0** |

---

## 🐳 2. Docker Deep Dive & Container Architecture Crash Course

### A. The Core Metaphor
* **`Dockerfile`** = The **recipe** (plain-text instructions).
* **Docker Image** = The **baked cake** (immutable snapshot with code, runtime, and libraries).
* **Artifact Registry** = The **cloud refrigerator** where your baked images are safely stored.
* **Docker Container** = A **slice being eaten right now** (an active process executing in memory).

```
 [Dockerfile]  ──(build)──>  [Docker Image]  ──(push/pull)──>  [Artifact Registry]
  (Recipe)                     (Baked Template)                 (Cloud Storage)
                                      │
                                    (run)
                                      ▼
                              [Docker Container]
                              (Running Process)
```

---

### B. Multi-Stage Builds & Security Hardening
In `server/Dockerfile`, we use a **3-stage multi-stage build** designed for enterprise security and sub-second cold starts:

```dockerfile
# ==============================================================================
# STAGE 1: Base Runtime Environment
# ==============================================================================
FROM node:20-slim AS base

# Install Debian native cryptographic libraries needed for PDF digital signatures & SHA-256 hashing
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# ==============================================================================
# STAGE 2: Dependency Builder
# ==============================================================================
FROM base AS dependencies
# npm ci ensures exact matching dependencies from package-lock.json with zero dev packages
RUN npm ci --only=production

# ==============================================================================
# STAGE 3: Final Production Runner
# ==============================================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules from dependencies stage (leaves build tools behind)
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Create uploads folder and grant ownership to non-root node user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Switch away from root to non-root user (security hardening)
USER node

EXPOSE 5000

# Health check to ensure container is healthy before serving web traffic
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/templates/public || exit 1

CMD ["node", "src/server.js"]
```

#### Why This Matters:
1. **Zero Bloat**: Build utilities are discarded in Stage 2. The final image is lightweight, reducing cold start latency.
2. **Non-Root Hardening (`USER node`)**: By default, Docker containers run as `root`. If an attacker were to exploit a Node.js vulnerability, `USER node` restricts them from modifying the container system or breaking out into the host OS.
3. **Layer Caching**: Changing application code in `src/` does not re-trigger `npm install`. Docker uses cached dependency layers to complete builds in seconds.

---

## ☁️ 3. GCP Architecture Breakdown

```
                                  USER BROWSER
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │  Vercel Global CDN    │             │  Vercel Global CDN    │
        │  Customer Web Client  │             │  Superadmin Portal    │
        │  (React / Vite SPA)   │             │  (Governance UI)      │
        └───────────┬───────────┘             └───────────┬───────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │ HTTPS REST API Requests
                                       ▼
                    ┌─────────────────────────────────────┐
                    │      Google Cloud Run (Serverless)  │
                    │      Container: signaturly-api      │
                    │      Auto scales: 0 ↔ 1 instance    │
                    └───────────┬──────────────────┬──────┘
                                │                  │
               Signed URL Uploads / Downloads      │ Database Queries
                                │                  │ (Agreements, Signers, Hashes)
                                ▼                  ▼
        ┌───────────────────────────────┐  ┌───────────────────────────────┐
        │ Google Cloud Storage (GCS)    │  │ MongoDB Atlas M0 (Free Tier)  │
        │ Private Bucket (5GB Free)     │  │ TLS Encrypted Cloud Database  │
        └───────────────────────────────┘  └───────────────────────────────┘
```

### 1. Google Cloud Run (Serverless Compute)
* **Scale-to-Zero ($0.00 Idle)**: When there are no active document creation or signing requests, Cloud Run shuts down all container instances. You pay **$0.00** for idle time.
* **Cold Starts**: When a new request arrives, Cloud Run spins up a container in ~1.5 seconds.
* **Dynamic Port Allocation**: Cloud Run automatically injects a `PORT` environment variable (`8080`) into the container. The Express server automatically listens on `process.env.PORT`.

### 2. Google Artifact Registry (Container Registry)
* Next-generation container storage in Google Cloud.
* Standardized URI format:
  `[REGION]-docker.pkg.dev/[PROJECT_ID]/[REPOSITORY_NAME]/[IMAGE_NAME]:[TAG]`

### 3. Google Cloud Storage (GCS) & Signed URLs
* **Why GCS instead of container disk?** Cloud Run containers are **ephemeral** (temporary). If a container scales to 0 or restarts, local disk files are deleted.
* **The GCS Architecture**:
  1. PDF documents are uploaded directly to the private GCS bucket (`gs://signaturly-vault-...`).
  2. When a recipient opens an agreement to sign, the backend generates a **Time-Limited Signed URL** (valid for 15 minutes) using Google's cryptographic V4 signature.
  3. The PDF streams securely to the browser with zero public bucket exposure.

### 4. IAM & Service Accounts (Identity and Access Management)
* **Service Account**: A robot identity that performs automated cloud tasks (e.g., `github-actions-deployer`).
* **IAM Roles**: Badges granting specific capabilities:
  * `roles/run.admin`: Permission to deploy revisions to Cloud Run.
  * `roles/artifactregistry.writer`: Permission to upload built Docker images.
  * `roles/iam.serviceAccountUser`: Permission to run workloads as a designated service account.
  * `roles/storage.admin`: Permission to create and manage vault storage buckets.

---

## 🛠️ 4. Step-by-Step GCP Deployment Playbook (Every Command Explained)

Here is the exact sequential breakdown of every command used during deployment:

### Step 4.1: Enable GCP Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  logging.googleapis.com \
  --project=project-9aac115a-73f9-4e8a-9a7
```
* **`run.googleapis.com`**: Enables the Cloud Run serverless engine.
* **`artifactregistry.googleapis.com`**: Enables the Docker container image repository.
* **`cloudbuild.googleapis.com`**: Enables cloud-side container compilation.
* **`storage.googleapis.com`**: Enables Google Cloud Storage for PDF vaulting.
* **`iamcredentials.googleapis.com`**: Enables Workload Identity Federation OIDC token exchanges.
* **`logging.googleapis.com`**: Enables streaming build and server logs.

---

### Step 4.2: Grant IAM Roles to the Default Cloud Build Account
```bash
# Grant storage access to upload source code tarballs
gcloud projects add-iam-policy-binding project-9aac115a-73f9-4e8a-9a7 \
  --member="serviceAccount:774331940137-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"

# Grant permission to push images into Artifact Registry
gcloud projects add-iam-policy-binding project-9aac115a-73f9-4e8a-9a7 \
  --member="serviceAccount:774331940137-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Grant logging permissions for real-time build output
gcloud projects add-iam-policy-binding project-9aac115a-73f9-4e8a-9a7 \
  --member="serviceAccount:774331940137-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

---

### Step 4.3: Create the Always-Free GCS Storage Bucket
```bash
gcloud storage buckets create gs://signaturly-vault-project-9aac115a-73f9-4e8a-9a7 \
  --location=us-central1 \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access
```
* `gs://...`: Google Storage URI protocol.
* `--location=us-central1`: **Crucial**: US multi-regions/regions qualify for the **5 GB Standard Storage Always-Free Tier**.
* `--default-storage-class=STANDARD`: Highest performance storage tier for instant PDF rendering.
* `--uniform-bucket-level-access`: Enforces IAM-only permissions, eliminating object-level access leaks.

---

### Step 4.4: Create the Artifact Registry Docker Repository
```bash
gcloud artifacts repositories create signaturly-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Signaturly Docker Repository" \
  --project=project-9aac115a-73f9-4e8a-9a7
```
* `repositories create signaturly-repo`: Creates the named container registry.
* `--repository-format=docker`: Formats the store specifically for OCI / Docker container images.
* `--location=us-central1`: Colocated in the same region as Cloud Run for zero-latency network pulls and zero egress bandwidth costs.

---

### Step 4.5: Cloud-Side Image Build with Google Cloud Build
```bash
cd ~/Signaturly/server

gcloud builds submit --tag us-central1-docker.pkg.dev/project-9aac115a-73f9-4e8a-9a7/signaturly-repo/signaturly-api:latest
```
* `builds submit`: Packages local server source code, securely uploads it to GCP, compiles the Dockerfile on Google's high-speed build infrastructure, and pushes the finished image to Artifact Registry.

---

### Step 4.6: Deploy to Cloud Run (With Zero-Cost Defense Safeguards)
```bash
gcloud run deploy signaturly-api \
  --image us-central1-docker.pkg.dev/project-9aac115a-73f9-4e8a-9a7/signaturly-repo/signaturly-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --set-env-vars="NODE_ENV=production,CORS_ORIGIN=*,MONGO_URI=mongodb+srv://suleman111111111111111_db_user:WOCfS74qN0fbJcc8@cluster0.0e0cvkg.mongodb.net/?appName=Cluster0,JWT_ACCESS_SECRET=access_secret_123,JWT_REFRESH_SECRET=refresh_secret_456,ADMIN_SECRET_KEY=signaturly-superadmin-secret,STORAGE_PROVIDER=gcs,GCP_PROJECT_ID=project-9aac115a-73f9-4e8a-9a7,GCS_BUCKET_NAME=signaturly-vault-project-9aac115a-73f9-4e8a-9a7,GCS_SIGNED_URL_EXPIRES=900,SMTP_HOST=smtp.gmail.com,SMTP_PORT=465,SMTP_USER=suleman111111111111111@gmail.com,SMTP_PASS=vgsatqmnxjowucfs,SMTP_FROM=suleman111111111111111@gmail.com" \
  --project project-9aac115a-73f9-4e8a-9a7
```
* `--platform managed`: Managed serverless orchestration, load balancers, and SSL handled by GCP.
* `--allow-unauthenticated`: Permits public HTTPS access over the internet for signing workflows.
* `--min-instances 0`: **Scale-to-Zero** — stops all compute instances when idle ($0.00 cost).
* `--max-instances 1`: **Hard Billing Ceiling** — limits maximum instances to 1, preventing DDoS attacks or unexpected traffic spikes from generating surprise bills.
* `--memory 512Mi`: Optimal memory allocation for sub-second container initialization.
* `--set-env-vars`: Passes all database connections, cryptographic secrets, GCS vault settings, and SMTP relay configurations.

---

## ⚡ 5. GitHub Actions CI/CD Pipeline (Sequential Execution Breakdown)

The automated workflow file is located at [`.github/workflows/deploy-backend.yml`](file:///c:/Users/Sulaiman/Desktop/Signaturly/.github/workflows/deploy-backend.yml).

### Step-by-Step Execution Sequence

```
  [git push origin main]
            │
            ▼
 1. Trigger Filter        ➔ Only triggers if files in server/** changed
            │
            ▼
 2. Ubuntu Runner Starts  ➔ GitHub spins up an isolated ephemeral runner
            │
            ▼
 3. Checkout Code         ➔ Clones repo at exact commit SHA
            │
            ▼
 4. OIDC Authentication   ➔ Requests short-lived token from Google WIF (No keys!)
            │
            ▼
 5. Setup gcloud SDK      ➔ Configures Google Cloud CLI on runner
            │
            ▼
 6. Configure Docker      ➔ Authorizes Docker client for us-central1 Artifact Registry
            │
            ▼
 7. Build Docker Image    ➔ Builds container with commit SHA tag and latest tag
            │
            ▼
 8. Push Image to GCP     ➔ Uploads image to us-central1 Artifact Registry
            │
            ▼
 9. Deploy to Cloud Run   ➔ Deploys new revision with zero downtime
```

---

## 🔐 6. Keyless Security: Workload Identity Federation (WIF) Explained

### Why Avoid Static JSON Service Account Keys?
1. **Leak Risk**: Static JSON private keys never expire. If accidentally committed to git or leaked, an attacker has permanent access.
2. **Organization Restrictions**: Google Cloud enforces `constraints/iam.disableServiceAccountKeyCreation` by default to prevent downloading private keys.

### How Workload Identity Federation Works
Instead of static keys, GitHub Actions exchanges a short-lived OpenID Connect (OIDC) cryptographic token with Google Cloud:

```
 [GitHub Actions] ──(1. OIDC Token with repo claim)──> [GCP Workload Pool]
        │                                                     │
        │                                            (2. Validate repo == 'sulaimankhan8/Signaturly')
        │                                                     │
        ▼                                                     ▼
 [Short-Lived Access Token] <──(3. Return 1hr Token)── [GCP Service Account]
```

### The 4 Setup Commands Executed:
```bash
# 1. Enable IAM Credentials API
gcloud services enable iamcredentials.googleapis.com --project=project-9aac115a-73f9-4e8a-9a7

# 2. Create the Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="project-9aac115a-73f9-4e8a-9a7" \
  --location="global" \
  --display-name="GitHub Pool"

# 3. Create OIDC Provider with strict repository mapping
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="project-9aac115a-73f9-4e8a-9a7" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == 'sulaimankhan8/Signaturly'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4. Bind the GitHub repository to the deployer service account
gcloud iam service-accounts add-iam-policy-binding "github-actions-deployer@project-9aac115a-73f9-4e8a-9a7.iam.gserviceaccount.com" \
  --project="project-9aac115a-73f9-4e8a-9a7" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/774331940137/locations/global/workloadIdentityPools/github-pool/attribute.repository/sulaimankhan8/Signaturly"
```

---

## 🌐 7. Frontend Deployment on Vercel & SPA Routing (`vercel.json`)

Both the **Customer Web Client** and **Superadmin Governance Portal** are deployed to Vercel's global CDN.

### The Single-Page-App (SPA) Problem
In React Router, URLs like `/dashboard` or `/sign/doc_123` do not exist as physical files on the web server. If a user refreshes the page on `/dashboard`, a standard server returns a **404 Not Found**.

### The Solution: `vercel.json`
Both `client/vercel.json` and `admin/vercel.json` include SPA rewrite rules:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
* **How it works**: Any path requested is routed to `index.html`, allowing React Router inside the browser to render the corresponding page seamlessly with zero 404 errors.

---

## 🔑 8. Environment Variables Reference (`.env.production`)

The complete production configuration file is stored at [`server/.env.production`](file:///c:/Users/Sulaiman/Desktop/Signaturly/server/.env.production):

```ini
# ==============================================================================
# SIGNATURLY PRO BACKEND - PRODUCTION CONFIGURATION
# ==============================================================================

NODE_ENV=production
APP_NAME=Signaturly Pro

# Allowed CORS Origins (* allows Vercel domains, previews & DuckDNS)
CORS_ORIGIN=*

# Database Connection (MongoDB Atlas Free M0)
MONGO_URI=mongodb+srv://suleman111111111111111_db_user:WOCfS74qN0fbJcc8@cluster0.0e0cvkg.mongodb.net/?appName=Cluster0

# Authentication & Security Secrets
JWT_ACCESS_SECRET=access_secret_123
JWT_REFRESH_SECRET=refresh_secret_456
ADMIN_SECRET_KEY=signaturly-superadmin-secret

# Google Cloud Storage (5GB Always-Free Vault)
STORAGE_PROVIDER=gcs
GCP_PROJECT_ID=project-9aac115a-73f9-4e8a-9a7
GCS_BUCKET_NAME=signaturly-vault-project-9aac115a-73f9-4e8a-9a7
GCS_SIGNED_URL_EXPIRES=900

# Gmail SMTP Relay
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=suleman111111111111111@gmail.com
SMTP_PASS=vgsatqmnxjowucfs
SMTP_FROM=suleman111111111111111@gmail.com
```

---

## 🔄 9. Disaster Recovery, Tear Down & Project Migration Guide

If you ever need to **delete everything**, **re-create the instance**, or **migrate to a new GCP account**:

### To Cleanly Delete All Resources:
```bash
# 1. Delete Cloud Run API Service
gcloud run services delete signaturly-api --region=us-central1 --quiet

# 2. Delete Artifact Registry Container Repository
gcloud artifacts repositories delete signaturly-repo --location=us-central1 --quiet

# 3. Delete GCS Document Vault Bucket & Contents
gcloud storage rm --recursive gs://signaturly-vault-project-9aac115a-73f9-4e8a-9a7
```

### To Deploy on a Brand New Project from Scratch:
1. Set the new project: `gcloud config set project NEW_PROJECT_ID`
2. Follow **Section 4 (Steps 4.1 through 4.6)** in order.
3. Update `VITE_API_BASE_URL` in your Vercel project settings to the new Cloud Run Service URL.

---
*Signaturly Pro © 2026. Production Cloud Deployment, Docker & GCP Master Manual.*
