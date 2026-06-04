# VSS Enterprises – Cloudflare Deployment Guide

## What's Used
| Service | Purpose | Cost |
|---|---|---|
| Cloudflare Workers | API / serverless backend | Free (100k req/day) |
| Cloudflare D1 | SQLite database | Free (5GB, 5M rows/day) |
| Resend | Email delivery | Free (3000 emails/month) |

---

## Step 1 – Install Wrangler CLI
```bash
npm install -g wrangler
```

---

## Step 2 – Login to Cloudflare
```bash
wrangler login
```
(Opens browser → log in with your Cloudflare account)

---

## Step 3 – Create D1 Database
```bash
cd D:\vss-enterprise\backend\cloudflare-worker
wrangler d1 create vss-enterprise-db
```

Copy the `database_id` from the output and paste it in `wrangler.toml`:
```toml
database_id = "PASTE_YOUR_ID_HERE"
```

---

## Step 4 – Create Database Tables
```bash
# Apply schema to remote (production) database
wrangler d1 execute vss-enterprise-db --file=schema.sql --remote

# (Optional) Apply locally for testing
wrangler d1 execute vss-enterprise-db --file=schema.sql --local
```

---

## Step 5 – Get Resend API Key
1. Go to https://resend.com → Sign up (free)
2. Dashboard → API Keys → Create API Key
3. Copy the key

---

## Step 6 – Set Secrets
```bash
wrangler secret put RESEND_API_KEY
# Paste your Resend API key when prompted

wrangler secret put ADMIN_PASSWORD
# Enter your admin panel password

wrangler secret put JWT_SECRET
# Enter any random strong string, e.g: vss@2024$secure#key
```

---

## Step 7 – Install Dependencies & Deploy
```bash
npm install
npm run deploy
```

After deploy you will see:
```
✅ Deployed to: https://vss-enterprise-api.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 8 – Update Angular Frontend
Open `src/environments/environment.prod.ts` and replace the URL:
```ts
apiUrl: 'https://vss-enterprise-api.YOUR_SUBDOMAIN.workers.dev'
```

---

## Step 9 – Test the API
```bash
# Health check
curl https://vss-enterprise-api.YOUR_SUBDOMAIN.workers.dev/api/health

# Get testimonials
curl https://vss-enterprise-api.YOUR_SUBDOMAIN.workers.dev/api/testimonials
```

---

## Local Development
```bash
npm run dev
# Runs on http://localhost:8787
```
Update `environment.ts` → `apiUrl: 'http://localhost:8787'` for local dev.

---

## Note About Resend Email (Free Tier)
On the free Resend plan the `from` address must be `onboarding@resend.dev`
until you verify a custom domain. To use your own domain:
1. Resend Dashboard → Domains → Add Domain
2. Add DNS records to your domain
3. Change `from` in `src/worker.js` to `noreply@yourdomain.com`
