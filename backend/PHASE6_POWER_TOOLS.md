# Phase 6: The Power Tools & Executor Architecture

This phase focuses on bridging the gap between "Management Agents" and "Engineering Agents" by implementing a standard library of tools and an architecture for heavy-duty execution.

## Architecture: Hub & Spoke (Hybrid)

- **Hub (Vercel):** Runs the Core Orchestrator, Registry, and Native Tools. Safe, fast, stateless.
- **Spoke (Extension/Executor):** A self-hosted microservice (Railway/AWS) for heavy tasks. Stateful, isolated, powerful.

## 6.1. Standard Library (Vercel-Native)

These tools run directly in the Vercel serverless environment. They are "safe" and rely on external APIs rather than local binaries.

### 6.1.1 HTTP Request Tool
**File:** `backend/src/tools/standard/http.tool.ts`
- `http_request`: Generic fetch wrapper.
- **Security:** Must be gated by Policy Engine whitelist (e.g., only allow `*.github.com`, `*.slack.com`).

### 6.1.2 GitHub API Tool
**File:** `backend/src/tools/standard/github.tool.ts`
- `github_api`: Uses Octokit to interact with GitHub.
- Capabilities: Read file, Create Branch, Create PR, List Issues.
- **Why:** Much cleaner and safer than `git` CLI in serverless.

### 6.1.3 Math Tool
**File:** `backend/src/tools/standard/math.tool.ts`
- `calculator`: Uses a safe math expression evaluator (e.g., `mathjs` or simple restricted eval).
- **Why:** LLMs are bad at arithmetic; this gives them a calculator.

## 6.2. Remote Tool Protocol (The Bridge)

To support the "Extension", we need a generic way for the Orchestrator to offload work.

### 6.2.1 Update Tool Runtime
**File:** `backend/src/tools/tool-runtime.service.ts`
- Add support for `handler_type: 'remote'`.
- Logic:
  1. Check `handler_config.url` and `handler_config.secret_env`.
  2. Sign the payload (HMAC) for security.
  3. `POST` the tool input to the remote URL.
  4. Await response (up to Vercel timeout) or poll (future).

## 6.3. LogLine Executor Spec (The Spoke)

We won't build the full Executor implementation yet, but we will define its specification so it can be built independently.

### 6.3.1 Executor Specification Document
**File:** `docs/architecture/EXECUTOR_SPEC.md`
- **Stack:** Node.js/FastAPI + Docker.
- **Endpoints:** `POST /execute`.
- **Capabilities:**
  - `code_interpreter`: Run Python/JS in ephemeral containers.
  - `browser`: Puppeteer for scraping.
  - `git_cli`: Full git operations on persistent volume.
- **Security:** Signature verification, timeout enforcement, resource limits.

## 6.4. Database Seeding

**Migration:** `backend/src/database/migrations/0023-seed-standard-tools.ts`
- Insert `http_request`, `github_api`, `calculator` into `tools` table.
- Set appropriate `risk_level` (High for HTTP, Medium for GitHub).

## Execution Order

1.  Create Standard Library Tools (Http, Github, Math).
2.  Implement `RemoteToolHandler` in Runtime.
3.  Write `EXECUTOR_SPEC.md`.
4.  Seed Standard Tools.

