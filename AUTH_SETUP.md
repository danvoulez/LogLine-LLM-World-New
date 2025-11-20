# Authentication Setup

## Current Status: Phase 1

**Auth is NOT required for Phase 1** ✅

The current implementation:
- Uses default values: `tenant_id: 'default-tenant'` when not provided
- `user_id` is optional (can be `null`)
- All endpoints work without authentication
- Perfect for testing and development

## When Auth is Needed

According to the **MASTER_BLUEPRINT.md**, auth is planned for **Phase 4** (Hardening phase):

> **Phase 4 – Memory, governance, and UX polish**
> 
> 5. Hardening:
>    * Auth & RBAC
>    * Audit logging
>    * Alerts/metrics dashboards

## Current Implementation

The schema already supports auth fields:

```typescript
// runs table has:
user_id: string | null;      // Optional for now
tenant_id: string;           // Defaults to 'default-tenant'
```

You can pass these in API calls:

```bash
# Without auth (uses defaults)
POST /workflows/:id/runs
{
  "input": {...},
  "mode": "draft"
}

# With user/tenant (optional)
POST /workflows/:id/runs
{
  "input": {...},
  "mode": "draft",
  "user_id": "user-123",
  "tenant_id": "tenant-abc"
}
```

## Setting Up Auth (Optional - Phase 4)

If you want to set up auth now (ahead of Phase 4), here are options:

### Option 1: Vercel Auth (Recommended for Vercel)

Vercel provides built-in authentication:

1. **Vercel Auth** (formerly NextAuth.js)
   - Works seamlessly with Vercel
   - Supports OAuth, email, magic links
   - Easy integration

2. **Setup**:
   ```bash
   npm install @auth/core @auth/vercel
   ```

### Option 2: Clerk (Popular Choice)

- Great developer experience
- Pre-built UI components
- Works with Vercel serverless

### Option 3: Custom JWT

- More control
- Requires more setup
- Good for custom requirements

### Option 4: Vercel KV + Custom Auth

- Use Vercel KV for sessions
- Custom auth logic
- Full control

## Recommendation

**For Phase 1**: ✅ **Skip auth** - focus on core functionality

**For Phase 4**: Add auth when you need:
- Multi-tenant isolation
- User-specific data
- RBAC (Role-Based Access Control)
- Production security

## Current API Usage

Right now, you can use the API without auth:

```bash
# All endpoints work without authentication
curl https://logline-lln-world.vercel.app/workflows
curl -X POST https://logline-lln-world.vercel.app/workflows/:id/runs
curl https://logline-lln-world.vercel.app/runs/:id
```

The system will:
- Use `tenant_id: 'default-tenant'` automatically
- Allow `user_id: null`
- Work perfectly for testing

## When to Add Auth

Add authentication when you need:
1. ✅ Multiple users/tenants
2. ✅ Production deployment
3. ✅ Data isolation between users
4. ✅ Role-based permissions
5. ✅ Audit trails with user identity

**For now**: Focus on Postgres setup and testing Phase 1 functionality! 🚀

