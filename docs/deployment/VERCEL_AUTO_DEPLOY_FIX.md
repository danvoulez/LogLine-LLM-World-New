# Vercel Auto-Deploy Fix Guide

## Problem
Automatic deployment from GitHub to Vercel is not working.

## Common Causes & Solutions

### 1. Project Not Connected to GitHub

**Check:**
- Go to Vercel Dashboard → Your Project → Settings → Git
- Verify repository is connected: `danvoulez/LogLine-LLM-World`
- Check if branch is set to `main`

**Fix:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`logline-llm-world`)
3. Go to **Settings** → **Git**
4. If not connected:
   - Click **Connect Git Repository**
   - Select `danvoulez/LogLine-LLM-World`
   - Set **Production Branch** to `main`
   - Set **Root Directory** to `backend`
   - Click **Save**

### 2. Root Directory Not Set

**Problem:** Vercel might be looking in the wrong directory.

**Fix:**
1. Vercel Dashboard → Project → Settings → General
2. Set **Root Directory** to `backend`
3. Save

### 3. Build Settings Incorrect

**Check `vercel.json`:**
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "framework": null,
  "outputDirectory": "dist",
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.ts"
    }
  ]
}
```

**Verify:**
- `buildCommand` should be `npm run build`
- `installCommand` should be `npm install`
- Root directory should be `backend` (set in Vercel dashboard)

### 4. GitHub Webhook Not Configured

**Check:**
1. Vercel Dashboard → Project → Settings → Git
2. Look for "Deploy Hooks" section
3. Verify webhook is active

**Fix:**
- If webhook is missing, reconnect the repository
- Vercel will automatically create the webhook

### 5. Branch Protection or Permissions

**Check:**
- GitHub repository settings → Branches
- Ensure `main` branch is not protected in a way that blocks Vercel
- Vercel needs write access to create deployment status checks

**Fix:**
- Go to GitHub → Settings → Applications → Authorized OAuth Apps
- Find "Vercel" and ensure it has repository access

### 6. Build Failures

**Check:**
1. Vercel Dashboard → Deployments
2. Look for failed deployments
3. Check build logs for errors

**Common Issues:**
- Missing environment variables
- Build errors (TypeScript, dependencies)
- Database connection issues

### 7. Manual Reconnection

If nothing works, try reconnecting:

1. **Disconnect:**
   - Vercel Dashboard → Project → Settings → Git
   - Click **Disconnect** (if connected)

2. **Reconnect:**
   - Click **Connect Git Repository**
   - Select `danvoulez/LogLine-LLM-World`
   - Configure:
     - **Production Branch:** `main`
     - **Root Directory:** `backend`
     - **Framework Preset:** Other
   - Click **Save**

3. **Trigger Deploy:**
   - After reconnecting, Vercel should automatically deploy
   - Or manually trigger: `vercel --prod` from CLI

## Verification Steps

### 1. Check Vercel Dashboard
- Go to Deployments tab
- Should see recent deployments from GitHub pushes
- Each commit should trigger a new deployment

### 2. Test Manual Deploy
```bash
cd backend
vercel --prod
```
If this works, the issue is with GitHub integration, not deployment itself.

### 3. Check GitHub Webhook
- GitHub → Repository → Settings → Webhooks
- Should see a Vercel webhook
- Check recent deliveries for errors

### 4. Check Vercel Logs
- Vercel Dashboard → Project → Deployments
- Click on a deployment
- Check **Build Logs** and **Function Logs** for errors

## Quick Fix Checklist

- [ ] Repository connected in Vercel dashboard
- [ ] Root directory set to `backend`
- [ ] Production branch set to `main`
- [ ] `vercel.json` exists in `backend/` directory
- [ ] `api/index.ts` exists and exports handler
- [ ] Environment variables configured
- [ ] GitHub webhook active
- [ ] No build errors in logs

## Alternative: Use Vercel CLI for Manual Deploy

If auto-deploy continues to fail, you can use CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project (if not already linked)
cd backend
vercel link

# Deploy to production
vercel --prod
```

## Still Not Working?

1. **Check Vercel Status:** [status.vercel.com](https://status.vercel.com)
2. **Check GitHub Status:** [status.github.com](https://status.github.com)
3. **Vercel Support:** [vercel.com/support](https://vercel.com/support)
4. **Check Project Settings:** Ensure project is not paused or archived

## Expected Behavior

After fixing:
- Every push to `main` branch triggers automatic deployment
- Vercel creates a new deployment
- Build runs automatically
- Deployment appears in Vercel dashboard within 1-2 minutes

