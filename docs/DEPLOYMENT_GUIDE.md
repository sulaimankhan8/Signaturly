# 🚀 Signaturly Pro — Ultimate Cloud Deployment, Docker & GCP Master Manual

---

## 📌 Table of Contents
1. [Cost Architecture ($0.00 / Month Roadmap)](#1-cost-architecture-000--month-roadmap)
2. [Docker & Container Architecture Explained](#2-docker--container-architecture-explained)
3. [GCP Serverless Backend Deployment (Cloud Run + GCS + Artifact Registry)](#3-gcp-serverless-backend-deployment-cloud-run--gcs--artifact-registry)
4. [GitHub Actions Automated CI/CD Setup](#4-github-actions-automated-cicd-setup)
5. [Frontend Deployments on Vercel (Customer Web App & Admin Portal)](#5-frontend-deployments-on-vercel-customer-web-app--admin-portal)
6. [Alternative: 24/7 Free `e2-micro` VM Deployment (Docker Compose + NGINX)](#6-alternative-247-free-e2-micro-vm-deployment-docker-compose--nginx)
7. [Environment Variables Reference (`.env.production`)](#7-environment-variables-reference-envproduction)
8. [Disaster Recovery, Tear Down & Project Migration Guide](#8-disaster-recovery-tear-down--project-migration-guide)

---

## 💰 1. Cost Architecture ($0.00 / Month Roadmap)

Signaturly Pro is architected to leverage the **Always-Free Tiers** of Google Cloud Platform, MongoDB Atlas, and Vercel Global Edge Network.

### 📊 Monthly Cost Breakdown Matrix

| Layer / Component | Provider & Tier | Quota & Specs | Monthly Cost |
| :--- | :--- | :--- | :---: |
| **Backend API (`server/`)** | **GCP Cloud Run** (Serverless) | • 2,000,000 free requests/mo<br>• 360,000 GB-sec memory / 180,000 vCPU-sec<br>• Auto-scale to 0 ($0 compute when idle) | **$0.00** |
| **Document Vault Storage** | **Google Cloud Storage (GCS)** | • 5 GB Standard Storage free in US regions<br>• 5,000 upload ops / 50,000 download ops | **$0.00** |
| **Container Registry** | **GCP Artifact Registry** | 500 MB free storage for container images | **$0.00** |
| **Customer App (`client/`)** | **Vercel Hobby Tier** | Global Edge CDN, 100 GB bandwidth, Auto-SSL | **$0.00** |
| **Admin Portal (`admin/`)** | **Vercel Hobby Tier** | Isolated governance portal on Vercel CDN | **$0.00** |
| **Database** | **MongoDB Atlas M0** | 512 MB storage, shared RAM, TLS encrypted | **$0.00** |
| **SSL / TLS Certificates** | **Google & Vercel Managed** | Auto-renewing Let's Encrypt / Google RSA SSL | **$0.00** |
| **TOTAL ESTIMATED MONTHLY BILL** | | | **$0.00 / ₹0** |

---

## 🐳 2. Docker & Container Architecture Explained

### A. The 4 Fundamental Docker Concepts
```
 [Dockerfile]  ──(build)──>  [Docker Image]  ──(push/pull)──>  [Artifact Registry]
  (Recipe)                     (Baked Template)                 (Cloud Storage)
                                      │
                                    (run)
                                      ▼
                              [Docker Container]
                              (Running App Process)
```

1. **`Dockerfile`**: Text file containing step-by-step instructions for packaging your code, Node.js runtime, OS libraries, and dependencies.
2. **Docker Image**: The immutable, standalone package created from the Dockerfile.
3. **Artifact Registry**: Google Cloud's secure cloud storage for Docker images.
4. **Docker Container**: An active, running process created from an image.

### B. Multi-Stage Build & Security Optimization
In `server/Dockerfile`, we use a **3-stage multi-stage build**:
* **Stage 1 (`base`)**: Installs native Debian libraries (`curl`, `openssl`, `ca-certificates`) needed for cryptographic SHA-256 PDF signing and audit trails.
* **Stage 2 (`dependencies`)**: Runs `npm ci --only=production` to install exact dependency trees.
* **Stage 3 (`runner`)**: Copies only the production `node_modules` and source code. Runs under `USER node` (non-root) so that even in the event of an application vulnerability, container breakout is prevented.

---

## ☁️ 3. GCP Serverless Backend Deployment (Cloud Run + GCS)

Follow these exact steps to deploy to Google Cloud from scratch.

### Step 3.1: Authenticate and Set Active Project
```bash
# Set your active GCP project ID
gcloud config set project YOUR_PROJECT_ID
```

### Step 3.2: Enable Required GCP Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com
```

### Step 3.3: Grant IAM Permissions to the Default Build Service Account
GCP uses a default compute service account (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`) to build containers and store build artifacts. Grant it necessary roles:

```bash
export PROJECT_ID=$(gcloud config get-value project)
export PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Storage Admin (for build tarball uploads)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"

# Grant Artifact Registry Writer (to push the built Docker image)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Grant Logging Writer (to stream build logs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

### Step 3.4: Create the Always-Free GCS Storage Bucket
> ⚠️ **Important**: The bucket **must** be created in `us-central1`, `us-east1`, or `us-west1` to qualify for the **5 GB Always-Free Tier**.

```bash
export BUCKET_NAME="signaturly-vault-$PROJECT_ID"

gcloud storage buckets create gs://$BUCKET_NAME \
  --location=us-central1 \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access
```

### Step 3.5: Create the Artifact Registry Docker Repository
```bash
gcloud artifacts repositories create signaturly-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Signaturly Docker Repository"
```

### Step 3.6: Build & Push Container Image using Google Cloud Build
Cloud Build compresses the local code directory and compiles the Docker container directly on Google Cloud's high-speed servers:

```bash
# Navigate to the server folder
cd server

# Build and push to Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/signaturly-repo/signaturly-api:latest
```

### Step 3.7: Deploy to Google Cloud Run (With Zero-Cost Safeguards)
Deploy the container with a **hard limit of 1 instance** to prevent any accidental scaling costs or DDoS billing spikes:

```bash
gcloud run deploy signaturly-api \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/signaturly-repo/signaturly-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --set-env-vars="NODE_ENV=production,CORS_ORIGIN=*,STORAGE_PROVIDER=gcs,GCP_PROJECT_ID=$PROJECT_ID,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_SIGNED_URL_EXPIRES=900,MONGO_URI=your_mongodb_atlas_uri,JWT_ACCESS_SECRET=your_access_secret,JWT_REFRESH_SECRET=your_refresh_secret,ADMIN_SECRET_KEY=your_admin_secret,SMTP_HOST=smtp.gmail.com,SMTP_PORT=465,SMTP_USER=your_email@gmail.com,SMTP_PASS=your_gmail_app_password,SMTP_FROM=your_email@gmail.com"
```

> 📋 **Save the Service URL** outputted by Cloud Run (e.g. `https://signaturly-api-xxxxx-uc.a.run.app`).

---

## ⚙️ 4. GitHub Actions Automated CI/CD Setup

To automate backend deployment every time you `git push` to `main`:

### Step 4.1: Workflow File Location
The workflow is saved at `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Google Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - 'server/**'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:

env:
  PROJECT_ID: your-gcp-project-id
  REGION: us-central1
  SERVICE_NAME: signaturly-api
  REPOSITORY_NAME: signaturly-repo
  IMAGE_NAME: signaturly-api

jobs:
  deploy:
    name: Build & Deploy to Cloud Run
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: 🔐 Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: ⚙️ Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: 🐳 Configure Docker for GCP Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet

      - name: 🏗️ Build Docker Image
        run: |
          IMAGE_TAG="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY_NAME }}/${{ env.IMAGE_NAME }}"
          docker build \
            -t "${IMAGE_TAG}:${{ github.sha }}" \
            -t "${IMAGE_TAG}:latest" \
            ./server

      - name: 🚀 Push Docker Image to Artifact Registry
        run: |
          IMAGE_TAG="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY_NAME }}/${{ env.IMAGE_NAME }}"
          docker push "${IMAGE_TAG}:${{ github.sha }}"
          docker push "${IMAGE_TAG}:latest"

      - name: 🌐 Deploy to Google Cloud Run
        run: |
          IMAGE_TAG="${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY_NAME }}/${{ env.IMAGE_NAME }}:${{ github.sha }}"
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image "$IMAGE_TAG" \
            --platform managed \
            --region ${{ env.REGION }} \
            --allow-unauthenticated \
            --min-instances 0 \
            --max-instances 1 \
            --memory 512Mi \
            --set-env-vars="NODE_ENV=production,CORS_ORIGIN=*"
```

### Step 4.2: Create the Service Account Key for GitHub
```bash
# Create service account
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# Grant roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Download key
gcloud iam service-accounts keys create gcp-key.json \
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com
```

### Step 4.3: Add to GitHub Secrets
1. In GitHub, go to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**:
   - **Name**: `GCP_SA_KEY`
   - **Value**: *(Paste the full JSON content of `gcp-key.json`)*

---

## 🌐 5. Frontend Deployments on Vercel (100% Free)

Both the Customer Web App and Admin Portal are deployed as Single Page Applications (SPAs) on Vercel.

### Project 1: User Web App (`client/`)
1. Go to [Vercel New Project](https://vercel.com/new) and import your `Signaturly` repository.
2. Under **Root Directory**, select **`client`**.
3. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://signaturly-api-xxxxx-uc.a.run.app` *(Your Cloud Run URL)*
4. Click **Deploy**.

### Project 2: Superadmin Governance Portal (`admin/`)
1. In Vercel, click **Add New... > Project** and import the same repository.
2. Under **Root Directory**, select **`admin`**.
3. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://signaturly-api-xxxxx-uc.a.run.app`
4. Click **Deploy**.

### SPA Routing Configuration (`vercel.json`)
Both `client/vercel.json` and `admin/vercel.json` include SPA rewrite rules to ensure refreshing pages like `/dashboard` or `/verify` does not produce a 404 error:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 🖥️ 6. Alternative: 24/7 Free `e2-micro` VM Deployment

If you prefer a 24/7 virtual Linux machine instead of serverless Cloud Run:

```bash
# 1. Create Always-Free VM in us-central1
gcloud compute instances create signaturly-free-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server

# 2. SSH into VM
gcloud compute ssh signaturly-free-vm --zone=us-central1-a

# 3. Create 4GB Virtual Memory (Swap) so 1GB RAM never crashes
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4. Install Docker & Run
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/your-username/Signaturly.git /var/www/signaturly
cd /var/www/signaturly
cp server/.env.production server/.env
docker compose up -d --build
```

---

## 🔑 7. Environment Variables Reference (`.env.production`)

```ini
# Server Network & Runtime
NODE_ENV=production
APP_NAME="Signaturly Pro"

# Allowed CORS Origins (* allows Vercel subdomains, previews & DuckDNS)
CORS_ORIGIN=*

# Database (MongoDB Atlas Free M0)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/signaturly_prod?retryWrites=true&w=majority

# Authentication Secrets (64-character random strings)
JWT_ACCESS_SECRET=access_secret_123
JWT_REFRESH_SECRET=refresh_secret_456
ADMIN_SECRET_KEY=signaturly-superadmin-secret

# Google Cloud Storage (5GB Always-Free Vault)
STORAGE_PROVIDER=gcs
GCP_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=signaturly-vault-your-project-id
GCS_SIGNED_URL_EXPIRES=900

# Gmail SMTP Relay
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_gmail_app_password
SMTP_FROM=your_email@gmail.com
```

---

## 🔄 8. Disaster Recovery, Tear Down & Project Migration Guide

If you ever need to **delete everything**, **re-create the instance**, or **migrate to another GCP account**:

### To Cleanly Delete All Resources in a Project:
```bash
# 1. Delete Cloud Run Service
gcloud run services delete signaturly-api --region=us-central1 --quiet

# 2. Delete Artifact Registry Docker images
gcloud artifacts repositories delete signaturly-repo --location=us-central1 --quiet

# 3. Delete GCS Document Bucket (and all contents)
gcloud storage rm --recursive gs://signaturly-vault-YOUR_PROJECT_ID
```

### To Deploy from Scratch on a Brand-New Project:
1. `gcloud config set project NEW_PROJECT_ID`
2. Follow **Section 3 (Steps 3.2 through 3.7)**.
3. Update `VITE_API_BASE_URL` in Vercel to point to your new Cloud Run URL.

---
*Signaturly Pro © 2026. Production Cloud Deployment & Architecture Manual.*
