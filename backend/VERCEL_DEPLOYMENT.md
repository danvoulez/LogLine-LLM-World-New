# Vercel Deployment Guide

This guide explains how to deploy the LogLine backend to Vercel.

## Prerequisites

1. A Vercel account ([sign up here](https://vercel.com))
2. A PostgreSQL database (see options below)
3. Vercel CLI installed (optional, for local testing)

## Database Setup

### Vercel Postgres (Neon Serverless Postgres)

Vercel Postgres is powered by **Neon Serverless Postgres**, which provides:
- **Serverless architecture**: Scales automatically, pay for what you use
- **Automatic connection pooling**: Handles serverless function connections perfectly
- **pgvector support**: Built-in support for vector embeddings (Phase 4 RAG)
- **Zero-config**: `POSTGRES_URL` automatically set as environment variable

Vercel provides serverless Postgres that integrates seamlessly with your deployment:

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab
3. Click **Create Database** → **Postgres**
4. Follow the setup wizard to provision your database
5. The `POSTGRES_URL` environment variable is **automatically set** by Vercel
6. No manual configuration needed - the app automatically detects and uses `POSTGRES_URL`

The connection string format is: `postgresql://username:password@host:port/database`

**Note:** Vercel Postgres is powered by Neon and provides automatic connection pooling, making it ideal for serverless environments.

### Alternative: External Postgres Providers

If you prefer to use an external provider, you can use:

- **Supabase**: Create a project and add the connection string as `POSTGRES_URL`
- **Neon**: Create a project and add the connection string as `POSTGRES_URL`
- **Railway/Render/Other**: Any PostgreSQL provider works - just add the connection string as `POSTGRES_URL`

The app automatically detects `POSTGRES_URL` and uses it if available, otherwise falls back to individual DB variables.

## Environment Variables

### Automatic (Vercel Postgres)

If you're using **Vercel Postgres**, the `POSTGRES_URL` environment variable is automatically set. No additional configuration needed!

### Manual Configuration (External Postgres)

If using an external PostgreSQL provider, add this environment variable:

- `POSTGRES_URL` - Full PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database?sslmode=require`
  - Example: `postgresql://user:pass@db.example.com:5432/logline?sslmode=require`

### Optional

- `NODE_ENV=production` (automatically set by Vercel in production)

### Fallback (Local Development)

For local development without `POSTGRES_URL`, you can use individual variables:
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USERNAME=user`
- `DB_PASSWORD=password`
- `DB_DATABASE=logline`

## Deployment Steps

### Method 1: Vercel Dashboard (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Set the **Root Directory** to `backend`
5. Configure environment variables (see above)
6. Click "Deploy"

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to backend directory
cd backend

# Login to Vercel
vercel login

# Deploy
vercel

# For production
vercel --prod
```

## Important Notes

### Serverless Limitations

- **Cold Starts**: First request after inactivity may be slower (~1-2 seconds)
- **Function Timeout**: Default 10 seconds (can be increased to 60s on Pro plan)
- **Async Workflows**: The orchestrator runs workflows asynchronously. For long-running workflows, consider:
  - Using Vercel Cron Jobs to poll for pending runs
  - Moving to a dedicated worker service (Railway, Render, etc.)
  - Using Vercel Background Functions (Pro plan)

### Database Connections

- **Connection Pooling**: The app is configured with connection pooling (max 10 connections) optimized for serverless
- **Vercel Postgres**: Automatically handles connection pooling and scaling
- **Connection Reuse**: In serverless, connections are reused across invocations when possible
- **SSL**: Automatically enabled for production deployments

### Build Configuration

The `vercel.json` file is already configured to:
- Use `@vercel/node` builder
- Route all requests to `api/index.ts`
- Cache the NestJS app instance for better performance

## Testing Locally with Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Run Vercel dev server
cd backend
vercel dev
```

This will:
- Start a local server that mimics Vercel's serverless environment
- Use your local `.env` file for environment variables
- Hot reload on changes

## Monitoring

After deployment:

1. Check the **Deployments** tab in Vercel dashboard
2. View logs in the **Functions** tab
3. Monitor database usage in your Postgres provider dashboard

## Troubleshooting

### "Cannot find module" errors

- Ensure `@vercel/node` is installed (it's automatically added during build)
- Check that `api/index.ts` exists and exports the handler correctly

### Database connection errors

- Verify `POSTGRES_URL` is set correctly
- Check that your database allows connections from Vercel's IPs
- Ensure SSL is enabled (add `?sslmode=require` to connection string)

### Timeout errors

- Workflows that take >10 seconds will timeout on Hobby plan
- Consider breaking long workflows into smaller steps
- Use background jobs for long-running tasks

### Cold start performance

- First request after inactivity is slower
- Consider using Vercel Pro for better performance
- Use connection pooling to reduce initialization time

## Next Steps

1. Set up Vercel Postgres or another database
2. Configure environment variables
3. Deploy using one of the methods above
4. Test the API endpoints
5. Monitor logs and performance

## Alternative: Hybrid Deployment

For better performance with long-running workflows, consider:

- **API Routes**: Deploy to Vercel (fast, serverless)
- **Worker Service**: Deploy orchestrator to Railway/Render (for background jobs)

This hybrid approach gives you the best of both worlds.

