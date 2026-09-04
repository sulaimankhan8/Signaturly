# 🚀 Signaturly Pro - Ultra-Low-Cost / Free-Tier GCP & Vercel Deployment Manual

---

## 📌 1. Executive Summary & Cost Matrix ($0 – $2 / Month Roadmap)

**Signaturly Pro** is designed to run in production with high legal security (US ESIGN, EU eIDAS, Section 10A IT Act 2000) while taking maximum advantage of **Google Cloud Platform (GCP) Always-Free Tiers** and **Vercel Global Edge CDN**.

### 💰 Monthly Cost Breakdown Matrix

| Component | Provider & Tier | Specifications | Monthly Cost (INR / USD) |
| :--- | :--- | :--- | :---: |
| **Main Web Client (`client/`)** | **Vercel Hobby Tier** | Global Edge CDN, Automated SSL, CI/CD Git integration | **₹0 / $0.00** (Free) |
| **Admin Portal (`admin/`)** | **Vercel Hobby Tier** | Isolated governance portal on separate subdomain | **₹0 / $0.00** (Free) |
| **Backend API (`server/`)** | **GCP Cloud Run** *(Option 1)*<br>-- OR --<br>**GCP `e2-micro` VM** *(Option 2)* | • 2,000,000 free requests/mo (Cloud Run)<br>• Always-Free `e2-micro` instance in `us-central1` | **₹0 to ₹120** ($0 – $1.50)<br><br>**₹0 to ₹50** ($0 – $0.60) |
| **Database** | **MongoDB Atlas (M0 Sandbox)** | 512 MB storage, shared RAM, TLS encrypted | **₹0 / $0.00** (Free) |
| **Document Storage** | **GCS Always-Free Tier**<br>-- OR -- **Local Disk Volume** | • 5 GB Standard Storage + 50k read ops (GCS)<br>• 30 GB Free Persistent Disk (VM Volume) | **₹0 / $0.00** (Free)<br><br>**₹0 / $0.00** (Free) |
| **SSL / TLS Certificates** | **Let's Encrypt / Google-Managed** | Auto-renewing 2048-bit RSA / ECC certificates | **₹0 / $0.00** (Free) |
| **TOTAL ESTIMATED MONTHLY BILL** | | | **₹0 to ₹150 / mo ($0 – $2)** |

---

## 🛠️ 2. Dual-Environment Architecture: Local Development vs. Production Cloud

Signaturly Pro is architected with complete environment parity so you can build, test, and iterate on new features locally with **zero cloud dependencies or expenses**, and deploy smoothly to production when ready.

### Environment Feature Matrix

| Capability | 💻 Local Development / Testing (`development`) | ☁️ Production Cloud (`production`) |
| :--- | :--- | :--- |
| **Backend Runtime** | `nodemon` on `http://localhost:5000` *(or Docker)* | **Google Cloud Run** *(Scale-to-Zero)* |
| **Customer Web App** | Vite HMR on `http://localhost:5173` | **Vercel** (`https://app.yourdomain.com`) |
| **Admin Portal** | Vite HMR on `http://localhost:5174` | **Vercel** (`https://admin.yourdomain.com`) |
| **PDF & Signature Storage** | Local Disk folder (`server/uploads/`) | **Google Cloud Storage (GCS)** 5GB Free Tier |
| **Hot Reloading / Fast Refresh**| Instant sub-second UI & API hot reloads | Optimized immutable production bundles |
| **Cost** | **$0.00 / ₹0** | **$0.00 – $1.50 / ₹0 – ₹120 / month** |

---

### 💻 Quick Local Development & Testing Guide

#### 1. Start Backend Server (Port 5000):
```bash
# From the project root:
npm run dev:server
# Or: cd server && npm run dev
```

#### 2. Start Customer Web App (Port 5173):
```bash
# In a new terminal:
npm run dev:client
# Open browser at: http://localhost:5173
```

#### 3. Start Superadmin Governance Portal (Port 5174):
```bash
# In a new terminal:
npm run dev:admin
# Open browser at: http://localhost:5174/login
```

#### 4. (Optional) Test Production Docker Container Locally Before Cloud Deploy:
```bash
# Build and run the exact production container locally:
npm run docker:up

# View logs:
npm run docker:logs

# Stop container:
npm run docker:down
```

---

## 🏗️ 3. System Architecture Topology (Ultra-Low-Cost)

```
                  ┌──────────────────────────────────────────────────────────┐
                  │                 Vercel Global Edge Network               │
                  │               (100% Free Hobby Tier Edge CDN)            │
                  └──────────────┬────────────────────────────┬──────────────┘
                                 │                            │
                 Customer Client │ https://app.yourdomain.com │ Admin Portal https://admin.yourdomain.com
                 (client/)       ▼                            ▼ (admin/)
                 ┌───────────────────────────────┐ ┌───────────────────────────┐
                 │    Signaturly Web Client      │ │  Isolated Superadmin App  │
                 │   (React/Vite User & Signer)  │ │ (Governance & BSA Certs)  │
                 └───────────────┬───────────────┘ └─────────────┬─────────────┘
                                 │                               │
                                 │ HTTPS REST API Requests       │
                                 └───────────────┬───────────────┘
                                                 │
                                                 ▼
                  ┌──────────────────────────────────────────────────────────┐
                  │          Google Cloud Backend (Cheapest Options)         │
                  │                                                          │
                  │  [Option A: Cloud Run]      [Option B: e2-micro VM]      │
                  │  2M Free Requests / mo       Always-Free Tier + 4GB Swap │
                  │  (Scales to Zero = $0 idle)  (Docker Compose + NGINX)    │
                  └──────────────┬────────────────────────────┬──────────────┘
                                 │                            │
                                 ▼                            ▼
                 ┌───────────────────────────────┐ ┌───────────────────────────┐
                 │  GCS (5GB Always-Free) OR     │ │   MongoDB Atlas Free M0   │
                 │  Local Disk Volume (/uploads) │ │ (512MB TLS Encrypted DB)  │
                 └───────────────────────────────┘ └───────────────────────────┘
```

---

## 🔑 3. Environment Variables Configuration

Create `/server/.env` with your production secrets:

```ini
# ==============================================================================
# SIGNATURLY PRO - CHEAPEST / PRODUCTION CONFIGURATION
# ==============================================================================

# Server Network & Security
PORT=5000
NODE_ENV=production
APP_NAME="Signaturly Pro"
APP_URL=https://app.yourdomain.com

# Multi-Origin CORS for both Vercel Web App and Admin Portal
CORS_ORIGIN=https://app.yourdomain.com,https://admin.yourdomain.com,https://signaturly.vercel.app,https://signaturly-admin.vercel.app

# Database (MongoDB Atlas M0 Free Tier)
MONGO_URI=mongodb+srv://<db_user>:<db_password>@cluster0.xxxxx.mongodb.net/signaturly_prod?retryWrites=true&w=majority

# JWT Authentication Secrets (Generate with: openssl rand -hex 64)
JWT_ACCESS_SECRET=e7b4...your_secure_access_secret_64_chars...
JWT_REFRESH_SECRET=a9c2...your_secure_refresh_secret_64_chars...
ADMIN_SECRET_KEY=super_admin_secret_key_prod_2026

# Storage Mode: 'local' (Free disk volume) or 'gcs' (GCS 5GB Free Tier)
STORAGE_PROVIDER=local
# Optional GCS config (when using GCS Free Tier):
GCP_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=signaturly-prod-vault-storage
GCS_SIGNED_URL_EXPIRES=900

# SMTP Mail Relay (Free Gmail App Password or SendGrid 100 emails/day free)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-gmail-app-password
SMTP_FROM="Signaturly Vault <noreply@yourdomain.com>"
```

---

## 🚀 4. Deployment Pathway A: Google Cloud Run + GCS 5GB Always-Free Tier (Recommended Serverless — $0 Idle Cost)

This is the **ultimate zero-idle-cost architecture**. Google Cloud Run scales to 0 instances when idle ($0 compute charge), and Google Cloud Storage (GCS) provides 5GB of free document storage every month.

### 💰 Free Tier Quotas Included:
- **Cloud Run**: First **2,000,000 requests/month** = **$0**.
- **Cloud Run Memory/CPU**: First **360,000 GB-seconds** and **180,000 vCPU-seconds** = **$0**.
- **Cloud Storage (GCS)**: First **5 GB Standard Storage** + **5,000 upload ops** + **50,000 download ops** = **$0**.

---

### Step 4.1: Enable Free GCP Services
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

### Step 4.2: Create the Always-Free GCS Storage Bucket
Create your document vault bucket in `us-central1`, `us-east1`, or `us-west1` to qualify for the **5 GB Always-Free Tier**:

```bash
export PROJECT_ID=$(gcloud config get-value project)
export BUCKET_NAME="signaturly-vault-$PROJECT_ID"

# Create private bucket with Uniform Bucket-Level Access
gcloud storage buckets create gs://$BUCKET_NAME \
  --location=us-central1 \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access
```

### Step 4.3: Configure Service Account IAM for Cloud Run
Allow your Cloud Run service to securely read and write PDF documents to the GCS bucket using built-in Application Default Credentials (ADC) without storing any private keys:

```bash
# Get the default Compute Engine service account used by Cloud Run
export RUN_SA="$PROJECT_ID-compute@developer.gserviceaccount.com"

# Grant Storage Object Admin role on the bucket
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/storage.objectAdmin"
```

### Step 4.4: Create Artifact Registry Repo
```bash
gcloud artifacts repositories create signaturly-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Signaturly Docker Repository"
```

### Step 4.5: Build & Push Backend Container Image
```bash
export IMAGE_TAG="us-central1-docker.pkg.dev/$PROJECT_ID/signaturly-repo/signaturly-api:latest"

cd /path/to/Signaturly/server
gcloud builds submit --tag $IMAGE_TAG
```

### Step 4.6: Deploy to Cloud Run with Scale-to-Zero Configuration
```bash
gcloud run deploy signaturly-api \
  --image $IMAGE_TAG \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 5000 \
  --set-env-vars="NODE_ENV=production,PORT=5000,CORS_ORIGIN=https://app.yourdomain.com,https://admin.yourdomain.com,https://signaturly.vercel.app,https://signaturly-admin.vercel.app,STORAGE_PROVIDER=gcs,GCS_BUCKET_NAME=$BUCKET_NAME,GCP_PROJECT_ID=$PROJECT_ID,GCS_SIGNED_URL_EXPIRES=900" \
  --set-secrets="MONGO_URI=MONGO_URI:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,ADMIN_SECRET_KEY=ADMIN_SECRET_KEY:latest,SMTP_PASS=SMTP_PASS:latest"
```

> **Why this costs $0 to ~$1.50/month:**
> - When no user is signing or viewing documents, Cloud Run containers scale to 0 (you pay $0).
> - When an agreement is created, signed, or viewed, Cloud Run handles the request in seconds and GCS stores the PDF within the 5 GB free limit.

---

## 🖥️ 5. Deployment Pathway B: GCP Always-Free `e2-micro` VM + 4GB Swap Space ($0 Compute)

If you prefer a 24/7 dedicated virtual machine with local persistent disk storage, Google Cloud provides **1 free `e2-micro` VM per month forever**.

### Step 5.1: Create the Always-Free `e2-micro` VM
```bash
# MUST be deployed in us-central1, us-east1, or us-west1 to qualify for $0/month Always-Free Tier
gcloud compute instances create signaturly-free-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

### Step 5.2: Open Firewall for HTTP and HTTPS
```bash
gcloud compute firewall-rules create allow-http-https \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --target-tags=http-server,https-server
```

### Step 5.3: SSH into VM & Configure 4GB Virtual RAM (Swap File)
An `e2-micro` has 1GB physical RAM. Creating a 4GB Swap file gives you **5GB effective memory**, allowing Docker and Node.js to run without running out of RAM:

```bash
gcloud compute ssh signaturly-free-vm --zone=us-central1-a

# --- Run inside the VM ---
# 1. Create 4GB Swap Space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Verify memory
free -h
```

### Step 5.4: Install Docker & Docker Compose on VM
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

### Step 5.5: Clone Project & Run Backend with Docker Compose
```bash
git clone https://github.com/your-org/Signaturly.git /var/www/signaturly
cd /var/www/signaturly

# Copy your production .env
cp server/.env.example server/.env
nano server/.env

# Create persistent storage folder
mkdir -p /var/www/signaturly/uploads
sudo chown -R 1000:1000 /var/www/signaturly/uploads

# Launch Docker container
docker compose up -d --build
```

### Step 5.6: Configure Free NGINX Reverse Proxy with Let's Encrypt SSL
Create `/etc/nginx/sites-available/signaturly-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Enable NGINX and issue free Let's Encrypt SSL:
```bash
sudo ln -s /etc/nginx/sites-available/signaturly-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d api.yourdomain.com
sudo systemctl reload nginx
```

---

## 🌐 6. Deploy Frontends to Vercel (100% Free Hobby Tier)

Both the Customer Web Client and Admin Portal are deployed separately on Vercel's global CDN for **$0/month**.

### Project 1: Main Customer Web App (`client/`)
1. In the Vercel Dashboard, click **Add New Project** > import your GitHub repo.
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variable**:
     - `VITE_API_BASE_URL`: `https://api.yourdomain.com` (or your Cloud Run URL)
3. Custom Domain: `https://app.yourdomain.com` or `https://signaturly.vercel.app`

---

### Project 2: Superadmin Governance Portal (`admin/`)
1. Click **Add New Project** > import the same GitHub repo.
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `admin`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variable**:
     - `VITE_API_BASE_URL`: `https://api.yourdomain.com` (or your Cloud Run URL)
3. Custom Domain: `https://admin.yourdomain.com` or `https://signaturly-admin.vercel.app`

---

## 👥 7. Multi-Project Co-Hosting (Running Signaturly + Nexi on One Free VM)

You can run **both Signaturly and Nexi** together on your single `e2-micro` VM without paying a single extra rupee:

```yaml
# /var/www/docker-compose.yml
version: "3.8"

services:
  # 1. Signaturly Backend (Port 5000)
  signaturly-api:
    build: /var/www/signaturly/server
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - /var/www/signaturly/uploads:/app/uploads
    env_file: /var/www/signaturly/server/.env

  # 2. Nexi Backend (Port 5001)
  nexi-api:
    build: /var/www/nexi/server
    restart: unless-stopped
    ports:
      - "127.0.0.1:5001:5000"
    volumes:
      - /var/www/nexi/uploads:/app/uploads
    env_file: /var/www/nexi/server/.env
```

NGINX routes each subdomain to its respective container:
- `api.signaturly.yourdomain.com` ➔ `http://127.0.0.1:5000`
- `api.nexi.yourdomain.com` ➔ `http://127.0.0.1:5001`

---

## 🔍 8. Monitoring & Health Checks

Verify your deployment with zero-cost monitoring:
```bash
# Check Docker container status
docker ps

# Inspect live container logs
docker compose logs -f backend

# Verify API health
curl -I https://api.yourdomain.com/api/templates/public
```

---

*Signaturly Pro © 2026. Zero-Cost / Ultra-Low-Cost GCP & Vercel Deployment Guide Complete.*
