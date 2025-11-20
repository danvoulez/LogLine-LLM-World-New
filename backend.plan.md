<!-- cb825a6f-c32d-48d3-b030-09f41896eca4 feda0c31-4bcb-40e7-b876-ad878580efff -->
# Backend Phase 1 Plan

## 1. Wire persistence & config

- Add TypeORM + Postgres configuration in `src/app.module.ts` (or dedicated `database` module), pulling connection details from env variables and ensuring entities auto-load.
- Create entity classes for `Workflow`, `Run`, `Step`, and `Event` that match the blueprint’s Phase 1 schema (ids, status enums, JSON payloads, timestamps) under `src/workflows/entities` (or `src/execution/entities`).
- Define matching migration or synchronization strategy plus validation DTOs using `class-validator` so the API enforces schema early.

## 2. Workflow CRUD API

- Replace placeholder DTOs/services in `src/workflows` with real implementations that persist via TypeORM repositories, support pagination/filtering, and emit basic events (create/update/delete).
- Extend controller methods with input validation, error handling (404 on missing workflow), and OpenAPI decorators if desired for clarity.

## 3. Execution ledger endpoints

- Introduce a new `RunsModule` (e.g., `src/runs`) that exposes `POST /workflows/:id/runs`, `GET /runs/:id`, and `GET /runs/:id/events`, storing payloads through `RunRepository`, `StepRepository`, and `EventRepository`.
- Implement a lightweight `OrchestratorService` (maybe `src/execution/orchestrator.service.ts`) that can execute linear workflow definitions: load workflow, iterate nodes, append `Step` + `Event` rows, and finalize run status.
- Provide DTOs for starting runs (input payload, mode) and serialization views for runs/events so the API responses stay consistent with future phases.

## 4. Tests & docs

- Back the new modules with unit tests (service logic, orchestrator happy-path) and an e2e test that starts a workflow run and reads back its trace via API.
- Update `backend/README.md` with setup instructions (env vars, migration commands, example curl flow) to document the Phase 1 capabilities.

### To-dos

- [ ] Wire TypeORM/Postgres env + entities
- [ ] Implement workflow CRUD via repositories
- [ ] Add run/step/event entities + repos
- [ ] Expose run APIs + orchestrator service
- [ ] Add tests and README instructions