# LogLine Executor Implementation Plan

This plan covers the implementation of the external Executor service, designed to run on Railway/AWS.

## 1. Project Setup
- [ ] Initialize `package.json`
- [ ] Create `tsconfig.json`
- [ ] Create `Dockerfile`
- [ ] Create `.gitignore` and `.dockerignore`

## 2. Core Server
- [ ] Implement `src/server.ts` (Express app)
- [ ] Implement `src/config.ts` (Env vars)

## 3. Security
- [ ] Implement `src/middleware/auth.ts` (HMAC validation)

## 4. Handlers
- [ ] Implement `src/handlers/code-interpreter.ts` (Python/Node execution)
- [ ] Implement `src/handlers/web-browser.ts` (Puppeteer)
- [ ] Implement `src/handlers/registry.ts` (Handler lookup)

## 5. Integration
- [ ] Instructions for deployment (README.md)

