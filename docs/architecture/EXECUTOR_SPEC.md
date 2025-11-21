# LogLine Executor Specification (RFC 001)

**Status:** Draft
**Version:** 1.0
**Target Deployment:** Railway / AWS Fargate

## 1. Overview

The **LogLine Executor** is a secure, isolated "worker node" designed to handle high-risk, stateful, or compute-intensive tasks that cannot run within the Vercel Serverless environment.

It acts as the "Muscle" to Vercel's "Brain".

## 2. Capabilities

The Executor exposes a single HTTP endpoint (`POST /execute`) that routes to specific capability handlers:

### 2.1. Code Interpreter (`code_interpreter`)
- **Runtime:** Python 3.11 / Node.js 20
- **Input:** Source code string
- **Output:** `stdout`, `stderr`, `return_value`
- **Security:** Ephemeral Docker containers (one per request) or restricted process isolation.
- **Persistence:** None (files deleted after execution).

### 2.2. Headless Browser (`web_browser`)
- **Runtime:** Puppeteer / Playwright
- **Input:** URL, interaction script
- **Output:** HTML content, Screenshot, PDF
- **Use Case:** Scraping complex SPAs, generating PDF reports.

### 2.3. Git Operations (`git_cli`)
- **Runtime:** Git binary on persistent volume
- **Input:** Repo URL, commands (`clone`, `checkout`, `commit`, `push`)
- **Use Case:** Complex refactoring, multi-file edits, keeping state between steps.

## 3. API Protocol

### 3.1. Request

```http
POST /execute
Content-Type: application/json
X-LogLine-Tool-Id: code_interpreter
X-LogLine-Timestamp: 1715000000
X-LogLine-Signature: sha256=... (HMAC)
```

```json
{
  "tool_id": "code_interpreter",
  "input": {
    "language": "python",
    "code": "print('Hello from Railway')"
  },
  "context": {
    "run_id": "run_123",
    "tenant_id": "tenant_abc"
  }
}
```

### 3.2. Response

```json
{
  "status": "success", // or "error"
  "result": {
    "stdout": "Hello from Railway\n",
    "stderr": "",
    "duration_ms": 150
  }
}
```

## 4. Security Architecture

1.  **Authentication:** Shared Secret (HMAC-SHA256) between Vercel and Executor.
2.  **Isolation:** Each execution should optimally run in a fresh container or a heavily sandboxed process (e.g., `gVisor` or `nsjail`).
3.  **Network:** Egress whitelist (optional, to prevent agents from attacking internal networks).
4.  **Resource Limits:** Strict CPU/RAM quotas per request. Timeout (e.g., 30s) enforced.

## 5. Deployment Strategy (Railway)

- **Dockerfile:** Based on `node:20-slim` (or Python base if Python-heavy).
- **Dependencies:** `python3`, `git`, `chromium` (for Puppeteer).
- **Env Vars:** `LOGLINE_SHARED_SECRET`.
- **Scaling:** Horizontal scaling based on CPU/RAM usage.

## 6. Future: Persistent Workspaces

For complex coding tasks ("Refactor this repo"), the Executor needs a persistent workspace.
- **Volume:** Mount a persistent volume (`/workspace/{run_id}`).
- **Lifecycle:** Workspace created on first call, persisted for `run` duration, wiped after completion.

