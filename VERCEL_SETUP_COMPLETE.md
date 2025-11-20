# Vercel Setup Status

## ✅ Completed

1. ✅ **Project Linked**: `logline-lln-world`
   - Project ID: `prj_t4hJvzn6KDmtidK2A6qgc9Gq52w2`
   - Team: `dvoulez-team`
   - Status: Deployed (no production URL yet - needs Postgres)

2. ✅ **GitHub Repository**: `https://github.com/danvoulez/LogLine-LLM-World`
   - Code pushed and synced

## 🔧 Next Steps (Manual via Dashboard)

Since Vercel Postgres creation requires dashboard interaction, here's what to do:

### 1. Create Vercel Postgres Database

1. Go to: https://vercel.com/dvoulez-team/logline-lln-world
2. Click **"Storage"** tab
3. Click **"Create Database"** → **"Postgres"**
4. Follow the setup wizard:
   - Select region (closest to you)
   - Name: `logline-db` (or default)
   - Click **"Create"**
5. `POSTGRES_URL` will be **automatically added** as environment variable ✅

### 2. Enable pgvector Extension

After Postgres is created, run this SQL:

1. In Vercel Dashboard → Storage → Your Postgres DB
2. Click **"Query"** or **"SQL Editor"**
3. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 3. Add Environment Variables (Optional for Phase 2)

For Phase 2 (LLM integration), you'll need:

1. Go to: Project Settings → Environment Variables
2. Add:
   - `OPENAI_API_KEY` = `your-openai-key`
   - (Optional) `ANTHROPIC_API_KEY` = `your-anthropic-key`
   - (Optional) `GOOGLE_GENERATIVE_AI_API_KEY` = `your-google-key`

### 4. Redeploy

After adding Postgres, trigger a new deployment:

```bash
cd backend
vercel --prod
```

Or it will auto-deploy on next git push.

## 📋 Project Info

- **Project Name**: `logline-lln-world`
- **Project ID**: `prj_t4hJvzn6KDmtidK2A6qgc9Gq52w2`
- **Team**: `dvoulez-team`
- **GitHub**: `danvoulez/LogLine-LLM-World`
- **Vercel Token**: `wPqV7pjXG79Idenut3XabNBv`

## 🧪 Test After Setup

Once Postgres is created and deployed:

```bash
# Health check
curl https://logline-lln-world.vercel.app/healthz

# Create a test workflow
curl -X POST https://logline-lln-world.vercel.app/workflows \
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

## ⚠️ Important

- **Don't add POSTGRES_URL manually** - it's set automatically when you create Vercel Postgres
- **Wait for Postgres creation** before testing the API
- **Enable pgvector** for Phase 4 (RAG memory engine)

---

**Current Status**: ✅ Project deployed, ⏳ Waiting for Postgres database creation

