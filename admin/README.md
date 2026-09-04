# 🛡️ Signaturly Pro — Governance & Admin Portal

Dedicated standalone administration and governance web application for Signaturly Pro.

## 🚀 Features
- **Isolated Authentication Pipeline**: Multi-factor governance authentication using email, password, and master Admin Security Key (`ADMIN_SECRET_KEY`).
- **Real-Time Governance Metrics**: Track registered users, total agreements, executed documents, and cryptographic audit log counts.
- **Document Governance Directory**: Inspect document status and download Bharatiya Sakshya Adhiniyam (Section 63 BSA) electronic evidence certificates.
- **Cryptographic Audit Ledger**: Inspect SHA-256 Merkle block hashes and audit event logs.

## 💻 Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
Create `.env` (or copy `.env.example`):
```env
VITE_API_BASE_URL=http://localhost:5000
```

3. Run development server (runs on port 5174):
```bash
npm run dev
```

## 🌐 Deploy to Vercel

1. Install Vercel CLI or connect via GitHub on [vercel.com](https://vercel.com).
2. Set **Root Directory** in Vercel project settings to `admin`.
3. Set **Framework Preset** to `Vite`.
4. Set Environment Variables in Vercel:
   - `VITE_API_BASE_URL`: `https://your-backend-api.yourcompany.com`
5. Deploy:
```bash
cd admin
vercel --prod
```
