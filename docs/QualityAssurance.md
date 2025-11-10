# Quality Assurance Report

## Snapshot
- **Date of verification:** 10 Nov 2025 (UTC)
- **Backend tests:** `npm run test` (Jest via `backend/package.json`)
- **Frontend tests:** `npm run test` (Vitest via root `package.json`)

## Test Statistics
| Layer | Command | Suites | Tests | Notes |
| --- | --- | --- | --- | --- |
| Backend (Node.js, Jest) | `cd backend; npm run test` | 18 passed | 65 passed | Covers config API, services (DLQ, retry, metrics, monitoring, realtime), security helpers, and schema validation. Jest reports open handles warning due to long-lived server mocks. |
| Frontend (React, Vitest) | `npm run test` | 1 passed | 6 passed | Validates `ConfigDrawer` UX flows, including config submission, restart banner rendering, and secret rotation happy/error paths. |

> _Jest warning:_ “Jest did not exit one second after the test run has completed.” This stems from intentional server listeners used in integration suites and does not impact pass/fail status. Run `npm run test -- --detectOpenHandles` in `backend/` to inspect further if desired.

## Test Inventory Highlights
- **Integration – Config API:** Exercises `GET /api/config`, `PATCH /api/config`, and `POST /api/config/secrets`, ensuring sanitisation, validation, restart signalling, and credential rotation succeed end-to-end.
- **Integration – Application entrypoint:** Boots the Express app and probes `/api/stats`, `/api/events/recent`, `/api/dlq`, `/api/dlq/replay`, `/health`, and `/metrics`.
- **Unit – Configuration service:** Verifies environment overrides, hot reload detection, restart gating, and file persistence.
- **Unit – Reliability services:** Includes DLQ management, retry backoff with jitter, circuit breaker thresholds, async queue behaviour, metrics emission, realtime socket broadcasting, and audit logger formatting.
- **Unit – Security helpers:** Validates credential storage abstractions, cryptographic utilities, and schema-level validation of sensitive fields.
- **Frontend – Config Drawer:** Confirms form validation, optimistic updates, restart banner messaging, OBM secret rotation workflows, and error surface states.

For a catalogue of source test files, see the directories `backend/tests/integration/`, `backend/tests/unit/`, and `components/__tests__/`.

## Why Choose This Adapter
- **Unified Control Plane:** Bridges SCOM alerts to OBM with configurable transforms, DLQ replay, and live telemetry dashboard.
- **Operational Transparency:** Built-in metrics (`/metrics`), structured logs, and Prometheus-ready instrumentation provide observability out-of-the-box.
- **Extensible & Typed:** TypeScript end-to-end with Zod validation and modular service boundaries simplify feature work and reduce runtime surprises.
- **Modern UX:** Web-based configuration removes the need to edit YAML, adding guardrails and secret rotation tooling directly in the UI.

## Reliability Posture
- **Resilient Messaging:** Retry service applies exponential backoff with jitter; DLQ preserves failed payloads with replay APIs validated by unit and integration tests.
- **Circuit Breaking:** Protects downstream OBM from overload, with thresholds covered in unit tests.
- **Hot Reload vs Restart:** Config service differentiates live-safe changes from restart-required ones; tests assert correct event emission and status codes.
- **Scheduled & Monitored:** Health checks, metrics, and monitoring services are covered by test suites to ensure regressions are caught early.

## Security Posture
- **Credential Hygiene:** Secrets reside outside persisted config, surfaced via credential store abstraction and rotated through `POST /api/config/secrets` (integration-tested).
- **Protected APIs:** JWT support, bcrypt hashing for operators, and Express middleware stack (Helmet, CORS) harden the surface.
- **Config Validation:** Zod schemas enforce strict typing, preventing injection of unsafe values.
- **Auditability:** Audit logger service produces append-only records, with tests confirming payload integrity.

## Reproducing Results
1. **Backend:**  
   ```powershell
   cd backend
   npm run test
   ```
2. **Frontend:**  
   ```powershell
   npm run test
   ```

Re-run these commands whenever significant changes land to keep the report current; update the statistics above with the latest suite/test counts.


