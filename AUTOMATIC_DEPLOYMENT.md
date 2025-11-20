# Automatic Deployment Setup

## ✅ Automatic Deployments Enabled

Your project is configured for **automatic deployments** via Vercel's GitHub integration.

### How It Works

1. **Push to GitHub** → Vercel automatically detects changes
2. **Build & Deploy** → Vercel builds and deploys your changes
3. **Preview Deployments** → Every push creates a preview deployment
4. **Production Deployments** → Pushes to `main` branch deploy to production

### Current Configuration

- **Vercel Project**: `backend` (linked)
- **Project ID**: `prj_GAJzaujGsGDupAXP9Qh8B7GWp92b`
- **GitHub Repo**: `danvoulez/LogLine-LLM-World`
- **Auto-Deploy**: ✅ Enabled (when connected to GitHub)

### Setup Steps

#### 1. Connect GitHub to Vercel (If Not Already Connected)

1. Go to: https://vercel.com/dvoulez-team/backend/settings/git
2. Click **"Connect Git Repository"**
3. Select `danvoulez/LogLine-LLM-World`
4. Configure:
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Click **"Deploy"**

#### 2. Verify Auto-Deploy is Enabled

After connecting:
- ✅ Every push to `main` → Production deployment
- ✅ Every push to other branches → Preview deployment
- ✅ Pull requests → Preview deployment with comments

### Deployment Triggers

Automatic deployments happen when:

- ✅ **Push to `main` branch** → Production deployment
- ✅ **Push to any branch** → Preview deployment
- ✅ **Pull Request opened/updated** → Preview deployment
- ✅ **Manual trigger** → Via Vercel dashboard

### Build Configuration

The project uses these settings (configured in `vercel.json`):

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "framework": null
}
```

### Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

**Required:**
- `POSTGRES_URL` - Automatically set when you create Vercel Postgres
- `OPENAI_API_KEY` - For Phase 2 LLM integration

**Optional:**
- `ANTHROPIC_API_KEY` - For Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google models
- `NODE_ENV=production` - Auto-set by Vercel

### Monitoring Deployments

1. **Vercel Dashboard**: https://vercel.com/dvoulez-team/backend
   - View all deployments
   - Check build logs
   - Monitor function logs

2. **GitHub Integration**:
   - Deployment status shown in PRs
   - Preview URLs in PR comments

### Manual Deployment (If Needed)

If you need to manually trigger a deployment:

```bash
cd backend
vercel --prod
```

### Troubleshooting

**Deployments not triggering?**
- Check GitHub integration in Vercel settings
- Verify repository is connected
- Check branch protection settings

**Build failures?**
- Check build logs in Vercel dashboard
- Verify `package.json` scripts are correct
- Ensure all dependencies are in `package.json`

**Environment variables not working?**
- Verify variables are set in Vercel dashboard
- Check variable names match code
- Ensure variables are set for correct environments (Production/Preview)

### Next Steps

1. ✅ **Connect GitHub** (if not already connected)
2. ✅ **Create Vercel Postgres** database
3. ✅ **Set environment variables** (OPENAI_API_KEY, etc.)
4. ✅ **Push to main** → Automatic deployment!

---

**Status**: ✅ Automatic deployment configured. Push to `main` to deploy!

