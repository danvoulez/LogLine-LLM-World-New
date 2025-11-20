# Environment Variables Documentation

This document describes all environment variables used by LogLine LLM World.

## Required Variables

### Database

#### `POSTGRES_URL` (Production - Vercel)
- **Description**: Full PostgreSQL connection string for Vercel Postgres
- **Format**: `postgresql://user:password@host:port/database?sslmode=require`
- **Where to get**: Vercel Dashboard > Your Project > Storage > Postgres > `.env.local` tab
- **Required**: Yes (for production)
- **Example**: `postgresql://neondb_owner:password@ep-xxx.aws.neon.tech/neondb?sslmode=require`

#### Alternative: Individual Connection Parameters (Local Development)
- `DB_HOST`: Database host (default: `localhost`)
- `DB_PORT`: Database port (default: `5432`)
- `DB_USERNAME`: Database username (default: `user`)
- `DB_PASSWORD`: Database password (default: `password`)
- `DB_DATABASE`: Database name (default: `logline`)

### LLM Providers

#### `OPENAI_API_KEY` (Required)
- **Description**: OpenAI API key for GPT models
- **Where to get**: https://platform.openai.com/api-keys
- **Required**: Yes (agents require LLM)
- **Format**: `sk-...`

#### `ANTHROPIC_API_KEY` (Optional)
- **Description**: Anthropic API key for Claude models
- **Where to get**: https://console.anthropic.com/settings/keys
- **Required**: No
- **Format**: `sk-ant-...`

#### `GOOGLE_API_KEY` (Optional)
- **Description**: Google API key for Gemini models
- **Where to get**: https://makersuite.google.com/app/apikey
- **Required**: No

## Optional Variables

### Vercel

#### `VERCEL_OIDC_TOKEN` (Optional)
- **Description**: Vercel OIDC token for Vercel API access
- **Where to get**: Vercel Dashboard > Settings > Tokens
- **Required**: No (only if using Vercel API features)
- **Security**: ⚠️ **NEVER commit this token!**

### Application

#### `NODE_ENV`
- **Description**: Node.js environment
- **Values**: `development` | `production` | `test`
- **Default**: `development`
- **Required**: No

#### `PORT`
- **Description**: Port for local development server
- **Default**: `3000`
- **Required**: No

### Security (Future)

#### `JWT_SECRET` (Future - Phase 4)
- **Description**: Secret key for JWT token signing
- **Required**: No (Phase 4 - Authentication)

### Debugging

#### `DEBUG`
- **Description**: Enable debug logging
- **Values**: `true` | `false`
- **Default**: `false`
- **Required**: No

#### `LOG_SQL_QUERIES`
- **Description**: Log all SQL queries to console
- **Values**: `true` | `false`
- **Default**: `false`
- **Required**: No

## Setup Instructions

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Fill in your values:
   - Set up local PostgreSQL or use Vercel Postgres connection string
   - Add your OpenAI API key (required)

3. Start the application:
   ```bash
   cd backend
   npm run start:dev
   ```

### Production (Vercel)

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables

2. Add all required variables:
   - `POSTGRES_URL` (automatically provided by Vercel Postgres)
   - `OPENAI_API_KEY` (your OpenAI key)
   - `NODE_ENV=production`

3. Deploy:
   ```bash
   vercel --prod
   ```

## Security Notes

⚠️ **CRITICAL**: Never commit `.env` files with real credentials!

- `.env` files are automatically ignored by `.gitignore`
- Use `.env.example` as a template (no real values)
- Rotate credentials if accidentally committed
- Use Vercel Environment Variables for production secrets

## Troubleshooting

### Database Connection Issues

- **Error**: "Connection refused"
  - Check `POSTGRES_URL` format
  - Verify database is accessible
  - Check SSL mode (`sslmode=require` for Vercel Postgres)

### LLM API Issues

- **Error**: "Invalid API key"
  - Verify `OPENAI_API_KEY` is correct
  - Check API key has sufficient credits
  - Ensure no extra spaces in the key

### Missing Variables

- **Error**: "Environment variable X is not defined"
  - Check `.env` file exists
  - Verify variable name matches exactly
  - Restart the application after adding variables

