# Deployment Setup Guide

## ✅ Completed Steps

1. ✅ **GitHub Repository Created**
   - Repository: `https://github.com/danvoulez/LogLine-LLM-World`
   - Code pushed to `main` branch
   - Private repository

2. ✅ **Git Configuration**
   - `.gitignore` files created
   - Environment variables protected
   - Private keys excluded

## Next Steps: Vercel Deployment

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/new
   - Sign in with GitHub

2. **Import Repository**
   - Click "Import Git Repository"
   - Select `danvoulez/LogLine-LLM-World`
   - Click "Import"

3. **Configure Project**
   - **Root Directory**: Set to `backend`
   - **Framework Preset**: Other (or leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Create Vercel Postgres Database**
   - In project settings, go to "Storage" tab
   - Click "Create Database" → "Postgres"
   - Follow setup wizard
   - `POSTGRES_URL` will be automatically set

5. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add:
     - `OPENAI_API_KEY` (your OpenAI API key)
     - `NODE_ENV=production` (optional, auto-set)
   - `POSTGRES_URL` is automatically available from Vercel Postgres

6. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your API will be live at `https://your-project.vercel.app`

### Option B: Deploy via Vercel CLI

```bash
cd backend

# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Link to project (will prompt for configuration)
vercel link

# Deploy to production
vercel --prod
```

### Environment Variables Setup

After deployment, add environment variables in Vercel Dashboard:

**Required:**
- `OPENAI_API_KEY` - For LLM calls (Phase 2)

**Automatic (Vercel Postgres):**
- `POSTGRES_URL` - Automatically set when you create Vercel Postgres

**Optional:**
- `ANTHROPIC_API_KEY` - For Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models
- `NODE_ENV=production` - Auto-set by Vercel

## Testing Deployment

Once deployed, test the API:

```bash
# Health check
curl https://your-project.vercel.app/healthz

# Create a workflow
curl -X POST https://your-project.vercel.app/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "definition": {
      "entry": "start",
      "nodes": [{"id": "start", "type": "static"}],
      "edges": []
    }
  }'
```

## Troubleshooting

### Database Connection Issues
- Verify `POSTGRES_URL` is set in Vercel environment variables
- Check Vercel Postgres database is running
- Ensure pgvector extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`

### Build Failures
- Check build logs in Vercel dashboard
- Verify `backend/package.json` has correct build scripts
- Ensure TypeScript compiles: `npm run build`

### Function Timeouts
- Default timeout is 10 seconds (60s on Pro plan)
- For long workflows, consider breaking into smaller steps
- Use background jobs for async processing

## Vercel Token

Your Vercel token: `wPqV7pjXG79Idenut3XabNBv`

Use this for:
- CLI authentication: `vercel login --token wPqV7pjXG79Idenut3XabNBv`
- CI/CD integrations
- API access

## GitHub Integration

GitHub App credentials are in `.env.local`:
- `GITHUB_APP_ID=1460425`
- `GITHUB_INSTALLATION_ID=72976874`
- Private key: `minicontratos.2025-11-20.private-key.pem`

These can be used for:
- GitHub Actions workflows
- Automated deployments
- Repository management

## Next Steps After Deployment

1. ✅ Test API endpoints
2. ✅ Verify database connection
3. ✅ Create test workflow and run
4. 🚧 Start Phase 2 implementation (Agents & Tools)

