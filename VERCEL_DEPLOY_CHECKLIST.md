# Vercel Auto-Deploy Checklist

## ✅ Quick Fix Steps

### 1. Verify Vercel Project Connection

**Go to Vercel Dashboard:**
1. Visit: https://vercel.com/dashboard
2. Select project: `logline-llm-world`
3. Go to **Settings** → **Git**

**Check:**
- [ ] Repository: `danvoulez/LogLine-LLM-World`
- [ ] Production Branch: `main`
- [ ] Root Directory: `backend` ⚠️ **CRITICAL**
- [ ] Auto-deploy: **Enabled**

**If Root Directory is wrong:**
- Change to `backend`
- Save
- This is the #1 cause of failed auto-deploys!

### 2. Verify Project Structure

**In Vercel Dashboard → Settings → General:**
- [ ] Framework Preset: **Other** (or leave blank)
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm run build` (auto-detected)
- [ ] Output Directory: `dist` (auto-detected)
- [ ] Install Command: `npm install` (auto-detected)

### 3. Check Recent Deployments

**Vercel Dashboard → Deployments:**
- [ ] Do you see any deployments?
- [ ] Are they failing or just not triggering?
- [ ] Check build logs for errors

### 4. Verify GitHub Webhook

**GitHub → Repository → Settings → Webhooks:**
- [ ] Is there a Vercel webhook?
- [ ] Status: Active (green)
- [ ] Recent deliveries: Check for errors

**If webhook is missing:**
- Reconnect repository in Vercel (Settings → Git → Disconnect → Reconnect)

### 5. Test Manual Deploy

```bash
cd backend
vercel --prod
```

**If manual deploy works:**
- Problem is with GitHub integration, not deployment
- Try reconnecting repository

**If manual deploy fails:**
- Check build errors
- Verify environment variables
- Check `vercel.json` configuration

## 🔧 Common Fixes

### Fix 1: Reconnect Repository

1. Vercel Dashboard → Project → Settings → Git
2. Click **Disconnect** (if connected)
3. Click **Connect Git Repository**
4. Select `danvoulez/LogLine-LLM-World`
5. Configure:
   - Production Branch: `main`
   - Root Directory: `backend` ⚠️
   - Framework: Other
6. Click **Save**

### Fix 2: Verify Root Directory

**This is the most common issue!**

The project structure is:
```
LogLine-LLM-World/
├── backend/          ← Vercel should deploy from HERE
│   ├── api/
│   ├── src/
│   ├── vercel.json
│   └── package.json
└── ...
```

**Vercel must be configured to:**
- Root Directory: `backend`
- NOT root of repository

### Fix 3: Check Build Settings

**Vercel Dashboard → Settings → General:**

Should match:
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Fix 4: Verify vercel.json

**File:** `backend/vercel.json`

Should contain:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm install",
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

## 🚨 Still Not Working?

### Option 1: Use Vercel CLI

```bash
# Install CLI
npm i -g vercel

# Login
vercel login

# Link project
cd backend
vercel link

# Deploy
vercel --prod
```

### Option 2: Check Vercel Status

- Vercel Status: https://status.vercel.com
- GitHub Status: https://status.github.com

### Option 3: Contact Support

1. Vercel Dashboard → Help → Support
2. Include:
   - Project name: `logline-llm-world`
   - Repository: `danvoulez/LogLine-LLM-World`
   - Issue: Auto-deploy not triggering from GitHub

## ✅ Expected Behavior After Fix

1. Push to `main` branch
2. Within 1-2 minutes, Vercel creates deployment
3. Build runs automatically
4. Deployment appears in Vercel dashboard
5. Status check appears in GitHub commit

## 📋 Verification

After fixing, test:
```bash
# Make a small change
echo "# Test" >> backend/README.md
git add backend/README.md
git commit -m "Test auto-deploy"
git push
```

**Then check:**
- Vercel Dashboard → Deployments (should see new deployment)
- GitHub → Commit → Status checks (should see Vercel check)

