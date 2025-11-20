# Enable pgvector Extension

## Quick Method (Vercel Dashboard)

The easiest way to enable pgvector is through the Vercel Dashboard:

1. **Go to**: https://vercel.com/dvoulez-team/logline-lln-world
2. **Click**: "Storage" tab (left sidebar)
3. **Click**: Your database `logline-llm-world`
4. **Click**: "Query" or "SQL Editor" tab
5. **Paste and run**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

6. **Verify** (optional):

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

7. ✅ Done! The extension is now enabled.

## Why This Method?

- ✅ Works immediately (no waiting for app deployment)
- ✅ No connection issues
- ✅ Direct database access
- ✅ Can verify immediately

## After Enabling

Once pgvector is enabled:
1. The app will automatically use it when needed (Phase 4)
2. No code changes needed
3. Tables with `vector` columns will work

## Alternative: API Endpoint

If you prefer, you can also use the API endpoint (after app is working):

```bash
curl -X POST https://logline-lln-world.vercel.app/database/enable-pgvector
```

But the dashboard method is **recommended** as it's more reliable.

---

**Status**: ⏳ Enable via dashboard, then test API

