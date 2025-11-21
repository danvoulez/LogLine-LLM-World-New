# LogLine Executor (Muscle)

The **LogLine Executor** is a standalone microservice designed to handle heavy-duty, stateful, and potentially risky operations that are not suitable for the main Vercel backend (Brain).

It is deployed on **Railway** as a Docker container.

## Capabilities

1.  **Code Interpreter**: Executes Python and JavaScript code in a sandboxed environment.
2.  **Web Browser**: Controls a headless Chrome browser (via Puppeteer) to navigate, screenshot, and interact with websites.

## Architecture

*   **Runtime**: Node.js 18 + Express
*   **Security**: HMAC-SHA256 signature verification (Shared Secret)
*   **Deployment**: Docker container

## API Reference

### `POST /execute`

Executes a tool.

**Headers:**
*   `Content-Type`: `application/json`
*   `X-LogLine-Signature`: HMAC-SHA256 signature of `timestamp.body`
*   `X-LogLine-Timestamp`: Unix timestamp

**Body:**
```json
{
  "tool_id": "code_interpreter", // or "web_browser"
  "input": {
    "language": "python",
    "code": "print('Hello World')"
  },
  "context": {
    "runId": "..."
  }
}
```

## Local Development

1.  Install dependencies: `npm install`
2.  Create `.env` file:
    ```
    PORT=8080
    LOGLINE_SHARED_SECRET=dev-secret
    ```
3.  Run: `npm run dev`

## Deployment

Automated via GitHub Actions (for Railway) or linked directly in Railway dashboard.

