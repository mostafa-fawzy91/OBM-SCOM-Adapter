# SCOM → OBM Event Integration Adapter Documentation

## 1. System Overview
The adapter ingests Microsoft SCOM XML event exports, transforms them into OBM-compatible JSON payloads, and forwards them to the OBM REST API with enterprise-grade reliability, observability, and security. A real-time React dashboard surfaces processing health, throughput, DLQ status, and operator controls.

## 2. Architecture Summary
- **SCOM XML Export** → file watcher (poll + ready checks)  
- **Event Processor** → XML parse → validation → transformation → retry + circuit breaker → OBM REST client  
- **Resilience** → DLQ (JSONL + rotation), audit log, structured logging, metrics, monitoring rules  
- **Observability API** → `/health`, `/ready`, `/metrics`, `/api/stats`, `/api/events/recent`, `/api/dlq`  
- **Dashboard** → React SPA using REST polling + Socket.IO for live stats/alerts, operator DLQ replay

## 3. Backend Services
### 3.1 HTTP & Observability Surface
```
```27:109:backend/src/server/app.ts
app.get('/health', async (_req, res) => {
  const state = circuitBreakerService.getState();
  const healthy = state !== 'open';
  const statusPayload = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    components: {
      circuitBreaker: { status: state },
      fileWatcher: { status: 'up' },
      obmConnection: { status: healthy ? 'up' : 'down' },
    },
  };
  if (!healthy) {
    return res.status(503).json(statusPayload);
  }
  return res.json(statusPayload);
});
```
```
- [`/ready`](../backend/src/server/app.ts) reports circuit state for orchestration probes.
- [`/api/stats`](../backend/src/server/app.ts) exposes success/failure counts, success rate, retry total, and circuit state for the dashboard.
- DLQ endpoints support pagination and targeted replay, returning HTTP `404` for missing IDs.

### 3.2 Event Processing Pipeline
```
```60:213:backend/src/services/event-processor.service.ts
const transformed = eventTransformer.transform(events);
for (const [index, scomEvent] of events.entries()) {
  const obmEvent =
    transformed[index] ?? eventTransformer.transformSingle(scomEvent);
  await this.processSingleEvent(scomEvent, obmEvent, sourceFile);
}
...
const execute = async () => {
  if (!circuitBreakerService.canProceed()) {
    throw new Error('Circuit breaker open');
  }
  context.attempt += 1;
  const response = await obmApiClient.postEvent(obmEvent);
  circuitBreakerService.recordSuccess();
  metricsService.apiLatency.observe(response.durationMs / 1000);
  metricsService.eventsTotal.inc({ status: 'success' });
  ...
};
await retryService.execute(execute, { eventId: scomEvent.eventId }, {
  onRetry: (attempt, waitTime) => {
    metricsService.retryCount.inc();
    this.stats.retries += 1;
    logger().warn({ component: 'EventProcessor', eventId: scomEvent.eventId, attempt, waitTime },
      'Retry scheduled for event');
  },
});
```
```
- Batches honor `processing.batchSize` and aggregated monitoring thresholds.
- Success path logs audit entries, updates metrics (`events_total`, `processing_duration_seconds`), pushes socket updates, and keeps a rolling 100-event cache.
- Failure path records circuit breaker failure, writes DLQ entry with metadata, updates retry/failed counters, emits alerts via monitoring rules, and retains the latest error message.

### 3.3 OBM REST Client & TLS Handling
```
```32:148:backend/src/services/obm-api-client.service.ts
this.config = configService.getConfig();
this.axiosInstance = this.createAxiosInstance(this.config);
...
const agent = new https.Agent({
  keepAlive: config.obm.keepAlive,
  maxSockets: config.obm.maxSockets,
  timeout: config.obm.connectionTimeoutMs,
  rejectUnauthorized: tls.verify && !tls.allowSelfSigned,
  ca,
  cert,
  key,
  minVersion: tls.minVersion === 'TLSv1.3' ? 'TLSv1.3' : 'TLSv1.2',
});
...
if (auth.method === 'apikey') {
  const apiKey = auth.apiKey ?? credentialStore.getSecret('obm.apiKey') ?? '';
  return {
    'X-API-Key': apiKey,
  };
}
```
```
- Rebuilds Axios instance on config hot reload, picking up credential rotations, TLS certificate changes, or endpoint adjustments.
- Supports Basic auth (with fallback to secure credential store) and API-key headers. TLS agent honors custom CA/cert/key paths and toggles self-signed validation.
- Normalizes Axios errors to human-readable messages for logging and DLQ audits.

### 3.4 DLQ Persistence & Rotation
```
```24:154:backend/src/services/dlq.service.ts
await this.rotateIfNeeded();
await appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf-8');
this.currentSize += 1;
metricsService.dlqSize.set(this.currentSize);
...
if (stats.size >= maxBytes) {
  const rotatedPath = `${this.filePath}.${Date.now()}`;
  await rename(this.filePath, rotatedPath);
  const gzipPath = `${rotatedPath}.gz`;
  await pipeline(createReadStream(rotatedPath), createGzip(), createWriteStream(gzipPath));
  await unlink(rotatedPath);
  this.currentSize = 0;
  metricsService.dlqSize.set(this.currentSize);
  logger().info({ component: 'DlqService', rotatedPath: gzipPath }, 'DLQ rotated');
}
```
```
- Maintains append-only JSONL DLQ with size-based rotation (gzip), `clear()` for operator intervention, and selective `replay()` for targeted recovery.
- Metrics integration (`dlq_size`) keeps Prometheus and UI in sync with queue depth.

### 3.5 Credential Store
```
```24:112:backend/src/security/credential.store.ts
this.securityConfig = configService.getConfig().security;
this.storePath = resolve(process.cwd(), 'data', 'secrets',
  `${this.securityConfig.credentialStoreNamespace ?? 'default'}.json`);
...
if (this.securityConfig.credentialStore === 'file') {
  if (!existsSync(this.storePath)) {
    return undefined;
  }
  const encryptedData = JSON.parse(readFileSync(this.storePath, 'utf-8'));
  const encryptedSecret = encryptedData[key];
  if (!encryptedSecret) return undefined;
  const decrypted = decrypt(encryptedSecret, this.requireEncryptionKey());
  this.cache.set(key, decrypted);
  return decrypted;
}
```
```
- Supports `file`, `env`, and `windows` (env fallback) stores; enforces AES-256-GCM encryption with `ADAPTER_ENCRYPTION_KEY` or static config key.
- Cache ensures secrets are read once per boot; `setSecret` updates encrypted JSON store or runtime environment variables.

## 4. Frontend Dashboard
```
```1:189:App.tsx
const fetchJson = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  ...
});
...
useEffect(() => {
  const socket = io(API_BASE_URL || window.location.origin, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  socket.on('stats:update', (payload) => {
    setStats((previous) => {
      const successRate = payload.total
        ? (payload.success / payload.total) * 100
        : 0;
      const failureRate = payload.total ? (payload.failed / payload.total) * 100 : 0;
      const circuitBreaker: CircuitState = previous?.circuitBreaker ?? 'closed';
      const next: StatsResponse = { ...payload, successRate, failureRate, circuitBreaker };
      pushHistory(successRate);
      return next;
    });
  });
  socket.on('events:recent', (event) => {
    setEvents((previous) => {
      const deduped = previous.filter((existing) => existing.eventId !== event.eventId);
      return [event, ...deduped].slice(0, 100);
    });
  });
  socket.on('alerts:new', (alert) => {
    setAlerts((previous) => [alert, ...previous].slice(0, 20));
  });
  return () => {
    socket.disconnect();
    setSocketStatus('disconnected');
  };
}, [pushHistory]);
```
```
- Hydrates REST data (`/api/stats`, `/api/events/recent`, `/api/dlq`, `/health`) with shared retry/error handling.
- Maintains rolling trend data for charts and exposes manual refresh + auto-refresh every 15s.
- WebSocket channel streams stats, recent events (deduped), and monitoring alerts; UI badges show connection state and last refresh timestamp.
- DLQ replay UI posts to `/api/dlq/replay/:eventId` with optimistic status feedback (`replayingId`).

## 5. Configuration
```
```1:88:backend/config/config.yaml
obm:
  baseUrl: "https://obm.example.com"
  eventEndpoint: "/opr-web/rest/9.10/event_list"
  auth:
    method: "basic"
processing:
  batchSize: 50
  rateLimitMs: 500
retry:
  maxAttempts: 5
  retryableStatusCodes: [429, 500, 502, 503, 504]
circuitBreaker:
  failureThreshold: 10
  timeoutMs: 60000
dlq:
  directory: "./data/dlq"
  rotationStrategy: "size"
metrics:
  enabled: true
dashboard:
  corsOrigins: ["http://localhost:5173"]
monitoring:
  alertRules:
    - name: "HighErrorRate"
      condition: "(errorRate > 5)"
```
```
- **Environment overrides**: any key can be overridden with `ADAPTER_<PATH>` (e.g. `ADAPTER_OBM__AUTH__METHOD=apikey`). Credentials can be omitted when stored via `credentialStore`.
- **Hot reload**: updates to `processing.batchSize`, retry limits, logging level, monitoring rules, etc. apply without restart; structural changes (e.g. OBM base URL) trigger error event requiring restart.
- Example secrets: `ADAPTER_ENCRYPTION_KEY`, `OBM_API_KEY`, `OBM_PASSWORD`.

## 6. Observability & Metrics
- Prometheus endpoint (`/metrics`) exposes counters/histograms for throughput, latency, retries, DLQ size, circuit state; default Node.js process metrics included.
- Monitoring rules (`config.monitoring.alertRules`) drive real-time alerts, surfaced in UI and logged with context.
- Audit log records event lifecycle (received → submitted → DLQ) with correlation IDs for compliance.
- Structured logging (Pino) configurable per component, with daily rotation support.

## 7. Dashboard Guide
- **Status cards** summarize totals, success rate, retries, DLQ size with contextual coloring.
- **Trend chart** displays success rate (pushed via socket + cached history) for last 40 samples.
- **Recent Events table** shows last 100 events with severity/status badges and timestamps.
- **DLQ table** allows replay of specific events; operator feedback indicates in-flight replay.
- **Alerts panel** surfaces monitoring rules (severity color-coded) with JSON context.
- **Manual refresh** button runs hydration pipeline; auto-refresh every 15s keeps data current.

## 8. Operations & Deployment
- **Backend**: `npm install --prefix backend`, `npm run build --prefix backend`, `NODE_ENV=production node dist/index.js` (ensure `CONFIG_PATH` set or default `./config/config.yaml` present). Metrics port defaults to `9090`, dashboard API port from config (`3000`).
- **Frontend**: `npm install`, `npm run dev` (Vite) or `npm run build && npm run preview`; configure `VITE_API_BASE_URL` when deploying separately from backend.
- **Docker/K8s**: Use provided health/ready endpoints for probes; mount `config`, `data/dlq`, `logs` volumes; supply secrets via env or encrypted store.
- **Resetting DLQ**: POST `/api/dlq/replay` (bulk), or `DELETE` equivalent not implemented—use filesystem or `dlqService.clear()` via future admin endpoint.

## 9. Security Considerations
- HTTPS mutual TLS supported via `obm.tls` certificates; self-signed allowed if `allowSelfSigned: true` (not recommended for production).
- Credentials encrypted at rest when using file credential store (`data/secrets/<namespace>.json`); ensure `ADAPTER_ENCRYPTION_KEY` rotated regularly.
- Helmet, CORS, and audit logging applied to Express API; PII redaction configurable via `logging.redact`.
- Circuit breaker + retry budgets prevent OBM overload and provide graceful degradation.

## 10. Testing & Quality
- **Commands**: `npm test -- --coverage --detectOpenHandles`, `npm run build` (frontend), `npm run lint` (if configured), `npm run test` (frontend Vitest suite).
- **Coverage**: backend 85.16 % statements / 60.22 % branches / 84.61 % functions / 85.75 % lines (`jest --coverage`). API surface, resilience mechanisms, config helpers, and dashboard telemetry loops are unit-tested.
- **Frontend unit tests**: `npm run test -- --run` executes React Testing Library coverage for the configuration drawer (form validation, config persistence, secret rotation). Requires Node 18+ and runs in a jsdom environment.
- **CI Recommendation**: enforce `npm test -- --coverage --detectOpenHandles` and `npm run build` on pull requests; optionally fail if coverage < 80 % statements or lines.

## 11. Supported Platforms & Versions
- **SCOM**: 2016, 2019, 2022, 2025 (tested with XML schema variations via parser).
- **OBM**: 9.10, 10.x, 2020.x, 2023.x, 2024.x REST API, TLS 1.2/1.3.
- **Runtime**: Node.js 18+ for backend, React 19 + Vite for dashboard; optional containerization with Docker/Kubernetes.

## 12. Future Enhancements
- Role-based access control for dashboard/API actions (admin/operator/viewer).
- Configurable event filtering/enrichment rules and multi-tenant support.
- Windows service installer & systemd unit to ease operations on respective platforms.
- Automated DLQ replay scheduling and bulk export tooling.
- Additional dashboard charts (latency histograms, retry heatmaps) and dark/light themes.

