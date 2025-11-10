# SCOM → OBM Integration Adapter – Low-Level Design (LLD)

## 1. Purpose
This Low-Level Design details the module-level structure, data contracts, algorithms, and sequence flows underpinning the SCOM → OBM Integration Adapter. It serves as the primary reference for developers implementing features, reviewers conducting code assessments, and QA engineers designing targeted tests.

## 2. Technology Stack
| Layer | Technology | Notes |
|-------|------------|-------|
| Backend Runtime | Node.js 20 + TypeScript | Built with `ts-node` (dev) and compiled `dist/` (prod) |
| Backend Framework | Express.js | API routing, middleware stack |
| Frontend | React 19 + TypeScript + Vite | SPA with Tailwind CSS styling |
| Realtime | Socket.IO | Stats + events push updates |
| Configuration | YAML (Zod schema) | Hot reload via `fs.watch` |
| Metrics | `prom-client` | Prometheus exposition |
| Logging | Pino-based structured logger | Contextual metadata, redaction support |
| Testing | Jest (backend), Vitest + RTL (frontend) | >85% coverage target |

## 3. Module Breakdown (Backend)

### 3.1 Entry Point – `backend/src/index.ts`
Responsibilities:
- Initialize configuration (`configService.initialize('config/config.yaml')`).
- Bootstrap credential store, DLQ, retry service, OBM client, real-time service.
- Create Express app via `createApp()` and attach HTTP + WebSocket servers.
- Register signal handlers for graceful shutdown.

Key Functions:
- `bootstrap()` – orchestrates startup; called immediately.
- `shutdown(reason)` – flushes DLQ, closes server, logs audit event.

### 3.2 Configuration Service – `backend/src/config/config.service.ts`
Classes:
- `ConfigService` (singleton).

Public API:
- `initialize(configPath: string): Promise<void>`
- `getConfig(): AdapterConfig`
- `updateConfig(updates: Partial<AdapterConfig>): Promise<{ config; requiresRestart; changedKeys }>`
- Event emitter: `on('reloaded' | 'error', handler)`

Internals:
- `parseConfig` using Zod schema (`adapterConfigSchema`).
- `deepMerge` for partial updates.
- `diffConfigs` to detect change paths.
- `isHotReload` gating `reloaded` event vs restart requirement.
- `persistConfig` writes YAML via promises API.
- File watcher triggers reload on change events.

### 3.3 Credential Store – `backend/src/security/credential.store.ts`
- Singleton `CredentialStore`.
- Modes: `file`, `env`, `windows`.
- `initialize()` sets store path and ensures directories.
- `getSecret(key)` caches values (Map) and decrypts when needed.
- `setSecret(key, value)` writes encrypted JSON (`encrypt`/`decrypt` from `utils/crypto.ts`).
- `requireEncryptionKey()` asserts encryption key presence.

### 3.4 Services

#### 3.4.1 File Watcher – `backend/src/services/file-watcher.service.ts`
- Watches `config.scom.xmlDirectory` using `chokidar` or polling (implementation TBD).
- Emits events to `eventProcessorService.enqueueFile`.
- Applies concurrency limit (`config.processing.maxConcurrentBatches`).
- Retries file read on transient errors (locked files).

#### 3.4.2 SCOM XML Parser – `backend/src/services/scom-xml-parser.service.ts`
- Instantiates `fast-xml-parser` with attribute support.
- `parse(xmlContent, { sourceFile })` returns array of `ScomEvent`.
- Handles malformed XML via try/catch, logging error and rethrowing for DLQ logic upstream.
- `transformEvent` extracts fields, trims description to 1000 chars, normalizes timestamps using `DateTimeUtils`.
- `collectCustomFields` filters non-standard keys to `customFields`.

#### 3.4.3 Event Transformer – `backend/src/services/event-transformer.service.ts`
- Maps `ScomEvent` to `ObmEvent`.
- Severity mapping via dictionary (e.g., `Critical → CRITICAL`).
- Adds correlation IDs, sanitized text, timezone conversions.
- Batch transform returns array of OBM payloads.

#### 3.4.4 Retry Service – `backend/src/services/retry.service.ts`
- Generic `execute(fn, context, hooks)` wrapper.
- Implements exponential backoff with jitter using config values.
- Emits `metricsService.retryCount.inc()` and logs warnings on each retry.
- Maintains retry budget (`retry.budgetPerMinute`).

#### 3.4.5 Circuit Breaker – `backend/src/services/circuit-breaker.service.ts`
- States: `closed`, `half-open`, `open`.
- Tracks rolling failure count and success threshold.
- `recordFailure()` increments and transitions states; logs events.
- `recordSuccess()` resets counters, transitions to `closed`.
- `canProceed()` returns boolean gating processing.

#### 3.4.6 DLQ Service – `backend/src/services/dlq.service.ts`
- `write(record)` appends JSONL entry.
- `read(limit, offset)` returns parsed entries.
- `replay(predicate, handler)` reprocesses and rewrites surviving entries.
- `rotateIfNeeded()` compresses file when size > limit.
- `clear()` empties DLQ file (admin action).

#### 3.4.7 Metrics Service – `backend/src/services/metrics.service.ts`
- Registers Prometheus metrics:
  - `eventsTotal` (Counter with status labels)
  - `retryCount` (Counter)
  - `apiLatency` (Histogram)
  - `processingDuration` (Histogram)
  - `dlqSize` (Gauge)
  - `circuitBreakerState` (Gauge)
- `getMetrics()` -> `register.metrics()`
- `reset()` for unit tests.

#### 3.4.8 Monitoring Service – `backend/src/services/monitoring.service.ts`
- Evaluates alert rules from config (string-based expressions executed via safe interpreter).
- Emits `alerts:new` via real-time service when conditions met.
- Logs evaluation errors to prevent silent failures.

#### 3.4.9 OBM API Client – `backend/src/services/obm-api-client.service.ts`
- Singleton with `initialize()` hooking into `configService.on('reloaded')`.
- `createAxiosInstance(config)` constructs HTTP client with TLS agent.
- `buildHeaders()` composes auth headers using credential store.
- `postEvent(event)` returns `ApiResponse` with duration, status.
- `normalizeError()` standardizes axios errors.

#### 3.4.10 Event Processor – `backend/src/services/event-processor.service.ts`
- Manages in-memory stats: `{ total, success, failed, retries, lastError }`.
- `processBatch(events, sourceFile)` chunk + sequential processing.
- `processSingleEvent(scomEvent, obmEvent, sourceFile)`:
  1. Audit log `received`.
  2. Attempt to call `OBM` via retry service.
  3. On success: update metrics, stats, audit log, push recent event, emit stats.
  4. On failure: update circuit breaker, metrics, stats, log error, write DLQ, emit failure event.
- `replayDlqRecord(record)` re-invokes `processSingleEvent`.
- `getStatistics()` returns stats object for API.
- `getRecentEvents()` returns head of recent events array (max 100).

#### 3.4.11 Audit Logger – `backend/src/services/audit-logger.service.ts`
- Writes append-only JSON lines to `logs/audit/YYYY-MM-DD.jsonl`.
- Methods:
  - `logEventReceived(scomEvent)`
  - `logEventSubmission(context, obmEvent, result)`
  - `logEventToDlq(details)`
- Handles file rotation based on config.

#### 3.4.12 Realtime Service – `backend/src/services/realtime.service.ts`
- Wraps Socket.IO server.
- Emits:
  - `stats:update`
  - `events:recent`
  - `alerts:new`
- Provides `attach(httpServer)` and `emitX()` methods consumed by other services.

### 3.5 Express App – `backend/src/server/app.ts`
- Middleware stack: `express.json`, CORS (configurable origins), `helmet`, `morgan`.
- Routes:
  - `GET /health` – returns status + component summary.
  - `GET /ready` – readiness check (circuit breaker not open).
  - `GET /metrics` – Prometheus metrics (404 if disabled).
  - `GET /api/stats` – event stats with derived success/failure rates.
  - `GET /api/events/recent` – last 100 events.
  - `GET /api/dlq` – paginated DLQ listing.
  - `POST /api/dlq/replay/:eventId` – replay single record.
  - `POST /api/dlq/replay` – replay list/all records.
  - `use('/api/config', configRouter)` – configuration endpoints.

### 3.6 Config Router – `backend/src/server/routes/config.routes.ts`
- `GET /` – returns sanitized config (`hasPassword`, removes secrets).
- `PATCH /` – validates via `adapterConfigUpdateSchema`, persists, returns sanitized config + metadata.
- `POST /secrets` – rotates OBM secrets using `secretUpdateSchema`.
- `extractEditableUpdates()` ensures only allowed fields pass through.
- Logging of secret rotation events with component metadata.

## 4. Frontend Modules

### 4.1 Main App – `App.tsx`
- Establishes state hooks for stats, events, DLQ, alerts, health, error handling, socket status.
- `hydrate()` concurrently fetches stats, events, DLQ, health; sets `lastUpdated` timestamp.
- Socket listeners update stats history, recent events, alerts.
- `ConfigDrawer` integrated with `loadConfig`, `updateConfig`, `updateSecrets`.
- UI structure: header, system status, metric cards, trend chart, alerts, event/DLQ tables, footer.

### 4.2 Components
- `SystemStatus.tsx` – Renders health status and circuit breaker.
- `MetricCard.tsx` – Generic metric tile with accent color.
- `TrendChart.tsx` – Uses `@visx` or custom chart to render success rate history.
- `EventsTable.tsx` – Displays recent events with severity badges.
- `DlqTable.tsx` – Lists DLQ entries, replay button triggers `onReplay`.
- `AlertsPanel.tsx` – Shows alert list with severity color coding.
- `ConfigDrawer.tsx` – Stateful form managing configuration updates and secret rotation.
- `ConfigDrawer.test.tsx` – Vitest tests covering load, validation, save, secret rotation flows.
- `icons.tsx` – Exports reusable SVG icons.

### 4.3 Types – `types.ts`
- Shared types between frontend components and backend API responses:
  - `StatsResponse`, `RecentEvent`, `DlqRecord`, `AlertEvent`, `HealthResponse`, `TrendPoint`.
  - Config-related types: `AdapterConfigViewModel`, `AdapterConfigUpdateRequest`, etc.

### 4.4 Networking
- `fetchJson` utility in `App.tsx` handles JSON responses, error propagation with message extraction.
- `buildUrl` respects `VITE_API_BASE_URL` environment variable.
- All requests include `credentials: 'include'` for future session handling.

### 4.5 State Management
- React hooks (no external state library).
- Derived state via `useMemo` (socket badge classes, circuit state).
- Controlled forms in `ConfigDrawer` maintain local state and dirty tracking.

## 5. Data Model

### 5.1 SCOM Event (`ScomEvent`)
```ts
interface ScomEvent {
  eventId: string;
  name: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Warning' | 'Information';
  description: string;
  netbiosComputerName?: string;
  monitoringObjectPath?: string;
  category?: string;
  timeRaised?: string;
  timeAdded?: string;
  priority?: number;
  resolutionState?: string;
  customFields: Record<string, unknown>;
  rawXml: string;
  sourceFile?: string;
  receivedAt: string;
}
```

### 5.2 OBM Event (`ObmEvent`)
```ts
interface ObmEvent {
  event: {
    title: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'NORMAL';
    description: string;
    node: string;
    category?: string;
    source?: string;
    occurred: string;
    received: string;
    correlationId: string;
    customAttributes?: Record<string, unknown>;
  };
}
```

### 5.3 DLQ Record (`DlqRecord`)
```ts
interface DlqRecord {
  eventId: string;
  correlationId: string;
  originalEvent: ScomEvent;
  transformedEvent?: ObmEvent;
  failureReason: string;
  failureTimestamp: string;
  retryCount: number;
  metadata?: {
    sourceFile?: string;
  };
}
```

### 5.4 Configuration (`AdapterConfig`)
- Defined via Zod schema; includes nested objects for each domain described in Configuration Guide.

## 6. Sequence Diagrams

### 6.1 Event Processing (Success Path)
```
SCOM → FileWatcher → ScomXmlParser → EventTransformer → EventProcessor
EventProcessor → RetryService (attempt 1) → ObmApiClient → OBM
ObmApiClient → EventProcessor (success)
EventProcessor → MetricsService / MonitoringService / RealtimeService / AuditLogger
```

### 6.2 Event Processing (Failure Path)
```
EventProcessor → RetryService (multiple attempts)
RetryService → ObmApiClient (fails)
RetryService → EventProcessor (throws after max attempts)
EventProcessor → CircuitBreaker.recordFailure()
EventProcessor → MetricsService.eventsTotal{status="failed"}
EventProcessor → DlqService.write(record)
EventProcessor → AuditLogger.logEventToDlq()
EventProcessor → RealtimeService.emitRecentEvent(status="failed")
```

### 6.3 Configuration Update via UI
```
Operator → ConfigDrawer PATCH /api/config
ConfigRouter → adapterConfigUpdateSchema.safeParse
ConfigRouter → extractEditableUpdates
ConfigService.updateConfig → deepMerge + validation + persist
ConfigService → emit 'reloaded' (if hot reload)
Response → ConfigDrawer (meta.requiresRestart flag)
ConfigDrawer → toast success message
```

## 7. Error Handling Strategy
- All services log with component context via `logger()`.
- Errors returned to clients include sanitized message; stack traces only in logs.
- Parser errors surface as `XML parsing error` to differentiate from downstream failures.
- Circuit breaker prevents thrashing during OBM outages.
- Retry service handles transient errors defined in config.

## 8. Testing Approach
- **Unit Tests**: Cover services individually with jest mocks (`tests/unit/...`).
- **Integration Tests**: `tests/integration/app.test.ts`, `config.routes.test.ts` simulate API interactions.
- **Frontend Tests**: `components/__tests__/ConfigDrawer.test.tsx` ensures user flows.
- **Coverage**: `npm run test -- --coverage` (backend) and `npm run test -- --coverage` (frontend via Vitest with coverage config).
- **CI Hooks**: Future pipeline should block merges below 85% coverage.

## 9. Logging & Audit Fields
- `logger().info/warn/error` include `component`, `eventId`, `correlationId`, and `attempt`.
- Audit entries contain timestamp, actor (system/user), action, payload snapshot.
- Logs emitted in JSON for ingestion into centralized logging platforms.

## 10. Performance Considerations
- Batch processing reduces HTTP overhead.
- Rate limiting (`processing.rateLimitMs`, `obm.rateLimitMs`) prevents API saturation.
- Async queue ensures limited concurrency (`AsyncQueue` utility).
- Circuit breaker reduces load during outage by tripping quickly.

## 11. Deployment Notes
- Service packaging via npm scripts; consider PM2/systemd for daemonization.
- Environment variables set per environment (e.g., `ADAPTER_ENVIRONMENT`, `VITE_API_BASE_URL`).
- TLS keys and certs must be readable by the adapter user.

## 12. Future Technical Improvements
- Replace file watcher with message queue ingestion for large-scale environments.
- Pluggable transformation rules (user-defined scripts per event type).
- RBAC for API endpoints (JWT/session tokens).
- Automated DLQ cleanup job (cron).
- Schema-driven UI generation for configuration drawer.

## 13. References
- `HLD.md`
- `ConfigurationGuide.md`
- `AdminGuide.md`, `UserGuide.md`
- `backend/src/**` source modules
- Test suites under `backend/tests/` and `components/__tests__/`

---
Keep this LLD synchronized with source code revisions. Update sequence diagrams and module descriptions when major refactors or architectural shifts occur.

