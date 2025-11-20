# Quick Deploy Instructions

## ✅ What's Done

1. ✅ GitHub repository created: `https://github.com/danvoulez/LogLine-LLM-World`
2. ✅ Code pushed to GitHub
3. ✅ `.gitignore` configured (protects secrets)
4. ✅ Build verified (TypeScript compiles successfully)
5. ✅ Vercel configuration ready (`vercel.json`)

## 🚀 Deploy to Vercel (Choose One Method)

### Method 1: Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/new
2. Click "Import Git Repository"
3. Select `danvoulez/LogLine-LLM-World`
4. Configure:
   - **Root Directory**: `backend`
   - **Framework**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click "Deploy"

### Method 2: Vercel CLI

```bash
cd backend

# Login (use your token)
vercel login --token wPqV7pjXG79Idenut3XabNBv

# Deploy
vercel --prod
```

## 📦 After Deployment

### 1. Create Vercel Postgres Database

1. In Vercel project → "Storage" tab
2. Click "Create Database" → "Postgres"
3. Follow wizard
4. `POSTGRES_URL` is automatically set ✅

### 2. Add Environment Variables

In Vercel project settings → Environment Variables:

- `OPENAI_API_KEY` (for Phase 2 - LLM integration)
- `NODE_ENV=production` (optional, auto-set)

### 3. Enable pgvector Extension

Run this SQL in Vercel Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Test API

```bash
# Replace with your Vercel URL
curl https://your-project.vercel.app/healthz
```

## 🔑 Credentials Reference

**Vercel Token**: `wPqV7pjXG79Idenut3XabNBv`

**GitHub Repo**: `https://github.com/danvoulez/LogLine-LLM-World`

**GitHub App** (in `.env.local`):
- App ID: 1460425
- Installation ID: 72976874
- Private Key: `minicontratos.2025-11-20.private-key.pem`

## 📝 Next Steps

1. Deploy to Vercel (above)
2. Create Vercel Postgres database
3. Test API endpoints
4. Start Phase 2: Add LLM agents and tools

---

**Ready to deploy?** Use Method 1 (Dashboard) for the easiest setup!

