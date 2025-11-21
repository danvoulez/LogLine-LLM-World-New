# Vercel CLI Setup & Auto-Deploy Configuration

## Current Status

**Project:** `logline-llm-world`  
**Linked:** ✅ Yes (in `backend/.vercel/project.json`)  
**Git Connected:** ⚠️ Needs verification in Vercel Dashboard

## CLI Commands Used

### 1. Link Project
```bash
cd backend
npx vercel link --yes --scope=dvoulez-team --project=logline-llm-world
```

**Result:** ✅ Project linked successfully

### 2. Verify Project
```bash
cd backend
npx vercel ls
```

**Shows:** Recent deployments and status

### 3. Check Environment Variables
```bash
cd backend
npx vercel env ls
```

**Shows:** POSTGRES_URL and other env vars configured

### 4. Manual Deploy (Test)
```bash
cd backend
npx vercel --prod --yes
```

**Result:** ✅ Deploy works manually

## Git Integration Issue

The `vercel git connect` command needs to be configured via **Vercel Dashboard** because:

1. CLI requires repository to be in the same directory as `.vercel/`
2. Our structure has `.vercel/` in `backend/` but git root is parent directory
3. Vercel Dashboard handles this automatically

## Solution: Configure via Dashboard

### Step 1: Verify Project Settings

1. Go to: https://vercel.com/dvoulez-team/logline-llm-world/settings
2. Check **General** tab:
   - **Root Directory:** Should be `backend` ⚠️ **CRITICAL**
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 2: Connect Git Repository

1. Go to **Settings** → **Git**
2. If not connected:
   - Click **Connect Git Repository**
   - Select: `danvoulez/LogLine-LLM-World`
   - Configure:
     - **Production Branch:** `main`
     - **Root Directory:** `backend` ⚠️
   - Click **Save**

### Step 3: Verify Auto-Deploy

1. Go to **Settings** → **Git**
2. Check:
   - ✅ **Auto-deploy from Git:** Enabled
   - ✅ **Production Branch:** `main`
   - ✅ **Root Directory:** `backend`

### Step 4: Test Auto-Deploy

```bash
# Make a test commit
cd "/Users/voulezvous/LogLIine LLM World"
git commit --allow-empty -m "Test auto-deploy"
git push
```

**Expected:** New deployment appears in Vercel Dashboard within 1-2 minutes

## CLI Commands Reference

### Check Project Status
```bash
cd backend
npx vercel ls                    # List deployments
npx vercel env ls                 # List environment variables
npx vercel whoami                 # Check logged-in user
```

### Manual Deploy
```bash
cd backend
npx vercel --prod                 # Deploy to production
npx vercel                        # Deploy to preview
```

### Project Management
```bash
npx vercel project ls             # List all projects
npx vercel link                   # Link to project
npx vercel unlink                 # Unlink project
```

## Troubleshooting

### Issue: Auto-deploy not triggering

**Check:**
1. Vercel Dashboard → Settings → Git
   - Repository connected? ✅
   - Root Directory = `backend`? ✅
   - Production Branch = `main`? ✅

2. GitHub → Settings → Webhooks
   - Vercel webhook exists? ✅
   - Recent deliveries successful? ✅

3. Vercel Dashboard → Deployments
   - Any failed deployments? Check logs

### Issue: Build fails

**Check logs:**
```bash
cd backend
npx vercel inspect <deployment-url> --logs
```

**Common causes:**
- Missing environment variables
- Build errors (TypeScript, dependencies)
- Root directory incorrect

### Issue: Wrong project linked

**Fix:**
```bash
cd backend
rm -rf .vercel
npx vercel link --yes --scope=dvoulez-team --project=logline-llm-world
```

## Current Configuration

**Project ID:** `prj_baNMiQlSWZeqgneBlPfM68zYhW21`  
**Organization:** `dvoulez-team`  
**Project Name:** `logline-llm-world`  
**Linked Directory:** `backend/`  
**Git Repository:** `danvoulez/LogLine-LLM-World`  
**Production Branch:** `main` (should be set in dashboard)

## Next Steps

1. ✅ Project is linked correctly
2. ⚠️ **Verify Git connection in Vercel Dashboard**
3. ⚠️ **Verify Root Directory = `backend` in dashboard**
4. ✅ Test with manual deploy (works)
5. ⏳ Test auto-deploy after Git connection verified

