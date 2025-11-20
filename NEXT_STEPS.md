# What's Next - Implementation Roadmap

## Current Status ✅

- ✅ **Phase 1 Complete**: Backend foundation with workflows, runs, steps, events
- ✅ **Master Blueprint**: Unified specification with Vercel adaptations
- ✅ **Vercel Setup**: Deployment configuration ready
- ✅ **Integration Plans**: Phase 2 (AI SDK) and Phase 4 (RAG) documented

## Immediate Next Steps

### Option A: Start Phase 2 Implementation (Recommended)

**Goal**: Add real LLM agents and tools to workflows

**Tasks**:

1. **Install AI SDK Dependencies**
   ```bash
   cd backend
   npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod
   ```

2. **Create Database Tables**
   - Add `tools` and `agents` tables (migrations)
   - Update schema to match MASTER_BLUEPRINT.md

3. **Implement LLM Router Service**
   - Create `src/llm/llm-router.service.ts`
   - Wrap AI SDK for unified provider interface
   - See: `PHASE2_AI_SDK_INTEGRATION.md`

4. **Implement Agent Runtime**
   - Create `src/agents/agent-runtime.service.ts`
   - Use AI SDK for tool calling
   - Integrate with orchestrator

5. **Implement Tool Runtime**
   - Create `src/tools/tool-runtime.service.ts`
   - Add tool registry
   - Add natural language DB tools (read/write)
   - Add policy checks

6. **Update Orchestrator**
   - Support `agent_node` and `tool_node` types
   - Call agent/tool runtime services
   - Log `llm_call` and `tool_call` events

**Estimated Time**: 2-3 days

**See**: `PHASE2_AI_SDK_INTEGRATION.md` for detailed implementation guide

---

### Option B: Test & Deploy Phase 1 First

**Goal**: Ensure Phase 1 is production-ready before moving forward

**Tasks**:

1. **Local Testing**
   ```bash
   cd backend
   npm run test
   npm run test:e2e
   ```

2. **Set Up Vercel Postgres**
   - Create database in Vercel dashboard
   - Get `POSTGRES_URL` automatically

3. **Deploy to Vercel**
   ```bash
   cd backend
   vercel --prod
   ```

4. **Test Deployed API**
   - Create a workflow
   - Start a run
   - Verify events are logged

5. **Fix Any Issues**
   - Connection pooling
   - Environment variables
   - CORS if needed

**Estimated Time**: 1 day

---

### Option C: Create Phase 2 Implementation Plan

**Goal**: Detailed step-by-step plan before coding

**Tasks**:

1. Break down Phase 2 into smaller tasks
2. Create TODO list with priorities
3. Define acceptance criteria for each task
4. Set up project structure for new modules

**Estimated Time**: 2-3 hours

---

## Recommended Path

**I recommend Option A** - Start Phase 2 implementation:

1. **Why**: Phase 1 is solid, and you have all the planning docs ready
2. **Momentum**: Keep building while everything is fresh
3. **Value**: Real LLM agents will make the platform actually useful
4. **Foundation**: Phase 2 builds directly on Phase 1

## Quick Start: Phase 2

If you want to start Phase 2 right now, here's the first step:

```bash
cd backend

# Install AI SDK
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod

# Create new modules
nest g module llm
nest g service llm/llm-router

nest g module agents
nest g service agents/agent-runtime

nest g module tools
nest g service tools/tool-runtime
```

Then follow the implementation guide in `PHASE2_AI_SDK_INTEGRATION.md`.

---

## Questions to Consider

1. **Do you want to deploy Phase 1 first?** (Option B)
   - Good for: Getting early feedback, testing infrastructure
   - Skip if: You want to add more features first

2. **Do you have OpenAI API key ready?** (For Phase 2)
   - Need: `OPENAI_API_KEY` environment variable
   - Can test with other providers too (Anthropic, Google)

3. **Do you want to add natural language DB tools?** (Phase 2)
   - Allows agents to query/write database in plain English
   - Requires policy engine for safety

---

## Long-term Roadmap

- **Phase 2** (Next): Agents, Tools, LLM integration
- **Phase 3**: App platform with manifests
- **Phase 4**: RAG memory engine, policy engine, polish

---

**Ready to start?** Let me know which option you prefer, and I'll help you implement it step by step!

