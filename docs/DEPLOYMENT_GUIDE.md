# 🚀 Signaturly Pro - Enterprise Production Deployment Guide

---

## 📌 1. Executive Summary & Architecture Overview

**Signaturly Pro** is an enterprise-grade electronic signature and document workflow platform designed for high security, legal enforceability (US ESIGN Act, Section 10A Indian IT Act 2000, EU eIDAS Regulation), and immutable cryptographic audit logging.

### System Architecture Topology
```
                  ┌──────────────────────────────────────────────┐
                  │                 DNS / CDN                    │
                  │             (Cloudflare / Route53)           │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTPS (Port 443)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │            NGINX Reverse Proxy               │
                  │        (SSL/TLS, Rate Limiting, CORS)        │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
             HTTP (Port 5173)    │                │ HTTP (Port 5000)
                                 ▼                ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │  Vite/React Web  │    │ Node.js/Express  │
                    │  Client Build    │    │ Backend API      │
                    └──────────────────┘    └────────┬─────────┘
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   ▼                                   ▼
                         ┌──────────────────┐                ┌──────────────────┐
                         │  MongoDB Atlas   │                │   SMTP Relay     │
                         │  Cluster (DB)    │                │ (Gmail/SendGrid) │
                         └──────────────────┘                └──────────────────┘
```

---

## 📋 2. System Requirements & Prerequisites

### Infrastructure Requirements
- **Operating System**: Ubuntu 22.04 LTS / Debian 12 / RHEL 9 (Linux x86_64)
- **CPU**: Minimum 2 vCPU cores (4+ cores recommended for high concurrency)
- **RAM**: Minimum 4 GB RAM (8+ GB recommended for PDF flattening and image processing)
- **Disk Storage**: 50 GB+ NVMe SSD (Scalable for document storage)
- **Network**: Static IPv4 Address, Open Ports 80 (HTTP) and 443 (HTTPS)

### Software Requirements
- **Node.js**: v18.x LTS or v20.x LTS
- **npm**: v9.x or v10.x
- **Database**: MongoDB v6.0+ (Local MongoDB Community or MongoDB Atlas Cluster)
- **Web Server**: NGINX v1.18+
- **Process Manager**: PM2 v5.3+
- **SSL Certificates**: Certbot / Let's Encrypt (Automated TLS renewal)

---

## 🔑 3. Environment Variables Configuration

Create a `.env` file in the `/server` directory with production-ready credentials:

```ini
# ==============================================================================
# SIGNATURLY PRO - PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# Server Infrastructure
PORT=5000
NODE_ENV=production
APP_NAME=Signaturly Pro
APP_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# Database Connection (MongoDB Atlas)
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/signaturly_prod?retryWrites=true&w=majority

# JWT Authentication Secrets (Generate using openssl rand -hex 64)
JWT_ACCESS_SECRET=e7b4...your_secure_access_secret_64_chars...
JWT_REFRESH_SECRET=a9c2...your_secure_refresh_secret_64_chars...
ADMIN_SECRET_KEY=super_admin_secret_key_prod_2026

# SMTP Mail Relay Configuration (TLS/SSL)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=notifications@your-domain.com
SMTP_PASS=app_specific_password_here
SMTP_FROM="Signaturly Pro Vault <notifications@your-domain.com>"
```

---

## 🛠️ 4. Step-by-Step Server Setup & Deployment

### Step 4.1: Update System & Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

### Step 4.2: Install Node.js LTS (v20.x)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### Step 4.3: Clone Repository & Install Packages
```bash
cd /var/www
sudo git clone https://github.com/your-org/Signaturly.git signaturly
sudo chown -R $USER:$USER /var/www/signaturly
cd /var/www/signaturly

# Install Server Dependencies
cd server
npm install --production

# Install Client Dependencies & Build Production Bundle
cd ../client
npm install
npm run build
```

---

## ⚙️ 5. Process Management with PM2

Install PM2 globally to ensure automatic restarts, process monitoring, and zero-downtime reloads:

```bash
sudo npm install -g pm2
```

Create PM2 ecosystem configuration file (`server/ecosystem.config.cjs`):

```javascript
module.exports = {
  apps: [
    {
      name: "signaturly-api",
      script: "src/server.js",
      cwd: "/var/www/signaturly/server",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
```

Start the application under PM2 and configure auto-start on boot:
```bash
cd /var/www/signaturly/server
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

---

## 🛡️ 6. NGINX Reverse Proxy & SSL Setup

Create NGINX site configuration (`/etc/nginx/sites-available/signaturly`):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Certificates (Managed by Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client Single Page Application (Static Frontend)
    location / {
        root /var/www/signaturly/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Backend Reverse Proxy
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # Uploads Directory Access
    location /uploads {
        alias /var/www/signaturly/server/uploads;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable site configuration and issue SSL Certificate:
```bash
sudo ln -s /etc/nginx/sites-available/signaturly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🐳 7. Optional Docker & Docker Compose Deployment

For containerized environments, create `docker-compose.yml` in the root directory:

```yaml
version: '3.8'

services:
  app-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: always
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGO_URI=mongodb://mongo-db:27017/signaturly
    depends_on:
      - mongo-db

  mongo-db:
    image: mongo:6.0
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Run Docker Compose:
```bash
docker-compose up -d --build
```

---

## 🔍 8. Maintenance, Monitoring & Health Checks

### Verification Commands
- Check PM2 status: `pm2 status`
- Monitor PM2 live logs: `pm2 logs`
- Check NGINX status: `sudo systemctl status nginx`
- Check API health endpoint: `curl -I https://your-domain.com/api/health`

### Automated Database Backup Script (`/var/www/backup.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/backup_$TIMESTAMP"
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

Add backup job to crontab (`crontab -e`):
```cron
0 2 * * * /var/www/backup.sh > /dev/null 2>&1
```

---
*Signaturly Pro © 2026. Production Deployment Complete.*
