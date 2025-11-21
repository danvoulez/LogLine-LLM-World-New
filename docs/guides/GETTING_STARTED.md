# Getting Started with LogLine LLM World

> **Quick start guide for developers**

## 🚀 Prerequisites

- Node.js 18+ and npm
- PostgreSQL (or Vercel Postgres)
- Git
- Vercel account (for backend deployment)
- Railway account (for executor deployment, optional)

## 📦 Installation

### 1. Clone Repository

```bash
git clone https://github.com/danvoulez/LogLine-LLM-World-New.git
cd LogLine-LLM-World-New
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

**Required Environment Variables:**
- `POSTGRES_URL` - Database connection string
- `OPENAI_API_KEY` - OpenAI API key (or other LLM provider)
- `JWT_SECRET` - JWT signing secret
- `LOGLINE_SHARED_SECRET` - Secret for Executor communication

See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for complete list.

### 3. Database Setup

```bash
# Run consolidated migration
npm run migration:run

# Or use the migration script
npm run script:run-migrations
```

See [../DATABASE_INITIALIZATION.md](../DATABASE_INITIALIZATION.md) for details.

### 4. Frontend Setup

```bash
cd ../logline-ui
npm install
cp .env.local.example .env.local
# Edit .env.local with backend URL
```

**Required Environment Variables:**
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL

### 5. Executor Setup (Optional)

```bash
cd ../executor
npm install
cp .env.example .env
# Edit .env with LOGLINE_SHARED_SECRET
```

## 🏃 Running Locally

### Backend

```bash
cd backend
npm run start:dev
# Backend runs on http://localhost:3000
```

### Frontend

```bash
cd logline-ui
npm run dev
# Frontend runs on http://localhost:3000 (or next available port)
```

### Executor (Optional)

```bash
cd executor
npm run dev
# Executor runs on http://localhost:8080
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
npm run test:e2e
```

### Frontend Tests

```bash
cd logline-ui
npm run build  # Check for build errors
```

## 📚 Next Steps

1. **Read the Architecture:**
   - [../MASTER_BLUEPRINT.md](../MASTER_BLUEPRINT.md) - Complete system spec
   - [../docs/architecture/](./architecture/) - Architecture docs

2. **Explore the API:**
   - [../docs/API_MENU.md](../docs/API_MENU.md) - API reference

3. **Understand the Registry:**
   - [../REGISTRY.md](../REGISTRY.md) - Registry overview
   - [../docs/design/REGISTRY_UNIVERSAL_PROPOSAL.md](../docs/design/REGISTRY_UNIVERSAL_PROPOSAL.md) - Full spec

4. **Check Deployment:**
   - [../docs/deployment/VERCEL_DEPLOYMENT.md](../docs/deployment/VERCEL_DEPLOYMENT.md) - Vercel setup
   - [../executor/README.md](../executor/README.md) - Executor setup

## 🆘 Troubleshooting

### Database Connection Issues
- Check `POSTGRES_URL` format
- Verify database is accessible
- Check SSL settings for Vercel Postgres

### Frontend Can't Connect to Backend
- Verify `NEXT_PUBLIC_BACKEND_URL` is correct
- Check CORS configuration in backend
- Verify backend is running

### LLM API Errors
- Check API keys in environment variables
- Verify provider/model configuration
- Check API rate limits

## 📖 Additional Resources

- [Environment Variables](./ENV_VARIABLES.md)
- [Database Initialization](../DATABASE_INITIALIZATION.md)
- [Frontend Checklist](../logline-ui/FRONTEND_CHECKLIST.md)
- [API Reference](../API_MENU.md)

---

**Need Help?** Check the [Documentation Index](../DOCUMENTATION_INDEX.md) for complete documentation.

