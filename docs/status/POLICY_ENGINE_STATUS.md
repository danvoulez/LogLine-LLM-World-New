# Policy Engine Status

## Current Status: Phase 4 (Not Implemented)

The Policy Engine is **planned for Phase 4** and is **not currently active** in the system.

## What This Means

### Current Behavior

- **No policy enforcement**: Tools and agents can be called without policy checks
- **No access control**: All tools are accessible to all workflows/apps
- **No approval gates**: No `require_approval` mechanism
- **No mode restrictions**: No automatic enforcement of `draft` vs `auto` mode restrictions

### Security Implications

⚠️ **Important**: The system currently relies on:
- Application-level access control (if implemented in frontend)
- Workflow/app configuration (manual restrictions)
- Tool-level validation (e.g., SQL validation in `natural_language_db_write`)

**For production use**, you should:
- Implement application-level authentication/authorization
- Use `draft` mode for risky operations
- Manually review tool calls in critical workflows
- Consider implementing basic policy checks before Phase 4

## Where Policies Are Referenced

### Code Locations with `TODO: Policy check (Phase 4)`

1. **`backend/src/tools/natural-language-db.tool.ts`**
   - `createReadTool()` - Line ~20
   - `createWriteTool()` - Line ~82
   - Comment: Policy check for database access

2. **`backend/src/execution/orchestrator.service.ts`**
   - Tool execution - Policy check before tool calls
   - Agent execution - Policy check before agent calls
   - Mode enforcement - Policy-based mode restrictions

3. **`backend/src/tools/tool-runtime.service.ts`**
   - Tool execution - Policy check before handler execution

### Database Schema

The `policies` table is **not created** yet. It will be created in Phase 4 with the following structure:

```sql
CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  scope       TEXT NOT NULL, -- global|tenant|app|tool|workflow|agent
  rule_expr   JSONB NOT NULL, -- DSL/JSON for engine to evaluate
  effect      TEXT NOT NULL, -- allow|deny|require_approval|modify
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Planned Features (Phase 4)

### Policy Types

1. **Tool Access Policies**
   - Control which tools can be called by which apps/users
   - Restrict dangerous tools (e.g., `natural_language_db_write`) to specific contexts

2. **Mode Enforcement**
   - Force `draft` mode for risky operations
   - Require approval for `auto` mode in certain contexts

3. **Approval Gates**
   - `require_approval` effect pauses runs until human approval
   - Integration with external approval systems

4. **Resource Limits**
   - Cost limits per run/tenant
   - LLM call limits
   - Rate limiting

### Policy Semantics (v1)

As defined in the blueprint (Section 4.4.1):

- Policies **cannot** rewrite input/output of tools/agents
- Policies can only:
  - `allow` - permit operation
  - `deny` - block operation
  - `require_approval` - pause until approval
  - `modify` - only metadata (mode, limits), never business data

## Migration Path

When Phase 4 is implemented:

1. Create `policies` table via migration
2. Implement `PolicyEngineService` with evaluation logic
3. Integrate policy checks into:
   - `ToolRuntimeService.execute()`
   - `AgentRuntimeService.runAgentStep()`
   - `OrchestratorService` (mode enforcement)
4. Add policy management API endpoints
5. Update documentation and examples

## Current Workarounds

### For Security-Critical Operations

1. **Use `draft` mode**: Always use `draft` mode for risky operations
2. **Manual review**: Review tool calls in `draft` mode before promoting to `auto`
3. **App scopes**: Use app scopes (Phase 3) to limit tool access
4. **Tool-level validation**: Tools like `natural_language_db_write` have built-in validation

### For Access Control

1. **Application-level**: Implement auth/authorization in your frontend
2. **Workflow-level**: Design workflows to only call appropriate tools
3. **Tenant isolation**: Use `tenant_id` for data partitioning (manual enforcement)

## Questions?

If you need policy-like functionality before Phase 4:

1. **Tool-level checks**: Add validation in tool handlers
2. **Workflow validation**: Validate workflow definitions before execution
3. **App scopes**: Use app scopes (Phase 3) for basic access control
4. **Custom middleware**: Implement custom checks in orchestrator

---

**Last Updated**: 2024-11-20  
**Status**: Phase 4 - Not Implemented  
**Priority**: Medium (security enhancement, not blocker)

