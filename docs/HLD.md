# SCOM → OBM Integration Adapter – High-Level Design (HLD)

## 1. Document Purpose
This High-Level Design (HLD) describes the architectural blueprint, major components, integration points, and non-functional characteristics of the SCOM → OBM Integration Adapter system. It is intended for stakeholders assessing system fit, solution architects planning deployments, and engineering leadership overseeing delivery.

## 2. Architecture Overview
The adapter is an event-driven middleware bridging Microsoft SCOM and OpenText OBM using reliable, observable, and secure processing pipelines.

### 2.1 Logical Architecture
```
┌────────┐     ┌────────────────┐      ┌────────────────┐      ┌────────────┐
│  SCOM  │ --> │ File Watchers  │ -->  │  Event Parser  │ -->  │ Transformer │
└────────┘     └────────────────┘      └────────────────┘      └────────────┘
                                                                   │
                                                                   ▼
                         ┌────────────────┐      ┌────────────────┐
                         │ Retry & Circuit│ ---> │  OBM REST API  │
                         │   Breaker      │      │    Client      │
                         └────────────────┘      └────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            ┌───────────────┐          ┌────────────────┐
            │ Dead Letter    │          │ Monitoring &   │
            │ Queue (DLQ)    │          │ Telemetry      │
            └───────────────┘          └────────────────┘
                    │                            │
                    ▼                            ▼
            ┌────────────────┐          ┌────────────────┐
            │ Config Service │ <------> │ React Dashboard │
            └────────────────┘          └────────────────┘
```

### 2.2 Deployment Topology
- **Option A: Monolithic Deployment**
  - Backend + frontend served from same host.
  - Reverse proxy (NGINX/IIS) fronts both API and static assets.
- **Option B: Distributed**
  - Backend container/service running in Kubernetes/VM.
  - Frontend built and hosted via CDN or corporate web server.
  - Communication via HTTPS with CORS configured.

### 2.3 Integration Interfaces
| Interface | Protocol | Direction | Description |
|-----------|----------|-----------|-------------|
| SCOM XML Export | File system (SMB/NFS/local) | Inbound | Adapter monitors directories for XML event files. |
| OBM REST API | HTTPS (REST/JSON) | Outbound | Submit transformed events to OBM `event_list` endpoint. |
| Dashboard UI | HTTPS (REST + WebSocket) | Bidirectional | Operators view metrics, events, DLQ, and configure runtime settings. |
| Prometheus | HTTP (text) | Outbound | Exposes `/metrics` for scraping by monitoring platforms. |

## 3. Component Descriptions
### 3.1 File Watcher Service
- Polls configured directories using glob patterns.
- Applies rate limiting and concurrency to avoid blocking large directories.
- Streams new files to XML parser queue.

### 3.2 XML Parser Service
- Uses `fast-xml-parser` to convert SCOM XML to structured `ScomEvent`.
- Validates required fields, truncates descriptions, and normalizes timestamps.
- Assigns correlation IDs and metadata (source file, receivedAt).

### 3.3 Event Transformer
- Maps SCOM severity to OBM severity.
- Builds OBM-compliant JSON payloads.
- Handles field normalization, string truncation, and optional custom attribute mapping.

### 3.4 Event Processor
- Core orchestrator.
- Executes retry logic with exponential backoff and jitter.
- Integrates with circuit breaker to fail fast during downstream outages.
- Emits metrics and audit logs for each event.
- Pushes recent events to in-memory store for real-time view.

### 3.5 Retry & Circuit Breaker Services
- Retry: Configurable attempts, delays, jitter, and retryable conditions.
- Circuit breaker: Tracks success/failure rates; transitions across `CLOSED`, `OPEN`, `HALF_OPEN`.
- Ensures OBM outages do not cause unbounded retries or blocked threads.

### 3.6 OBM API Client
- Axios-based HTTP client with TLS customization and header injection.
- Reads secrets from credential store.
- Reports latency metrics and normalizes errors for logging/DLQ.

### 3.7 Dead Letter Queue (DLQ)
- JSONL-backed store for failed events.
- Supports replay operations (single or bulk) via service and dashboard UI.
- Automatically rotates (gzip) when file size thresholds exceeded.

### 3.8 Config Service
- Loads YAML configuration, applies environment overrides, and hot-reloads select keys.
- Persistence ensures UI-driven updates write back to `config.yaml`.

### 3.9 Monitoring & Telemetry
- Structured logging with contextual metadata (component, correlationId).
- Prometheus metrics for throughput, error rates, retries, circuit breaker state, DLQ size.
- Alerting engine evaluates rules and emits notifications to dashboard.

### 3.10 React Dashboard
- Real-time dashboard using WebSocket + REST hydration.
- Config Drawer for runtime adjustments and secret rotation.
- Components: system status, metric cards, trend chart, recent events, alert panel, DLQ table.

## 4. Data Flow
1. SCOM drops XML file in watched directory.
2. File watcher enqueues file path; parser reads and converts to `ScomEvent[]`.
3. Event transformer produces OBM-ready payloads.
4. Event processor iterates events, applying retries and circuit breaker.
5. Successful events logged, metrics updated, entry pushed to recent events.
6. Failed events written to DLQ, audit log updated, metrics incremented.
7. Dashboard receives live updates via WebSocket and periodic hydration.
8. Admin/operator actions (config changes, DLQ replay) travel through REST endpoints back to services.

## 5. Non-Functional Requirements
- **Reliability**: DLQ ensures no event loss; resume after recovery.
- **Performance**: Configurable batching and rate limits; default target is <500ms processing per event.
- **Scalability**: Horizontal scaling feasible by partitioning SCOM directories or using shared message bus (future).
- **Security**: TLS 1.2+, credential store encryption, audit logging, ability to deploy behind corporate SSO.
- **Observability**: Health checks (`/health`, `/ready`), metrics, structured logs, alerting hooks.
- **Maintainability**: TypeScript codebase with thorough unit/integration tests (>85% coverage target).
- **Configurability**: Web UI + hot reload + config files for flexible operations.

## 6. Assumptions & Constraints
- SCOM exports are well-formed XML adhering to agreed schema.
- OBM REST API is reachable within configured timeouts.
- Adapter hosts have persistent storage for DLQ/audit/secrets.
- Scaling beyond single instance may require distributed coordination (out of scope for current version).

## 7. External Dependencies
- Node.js 20 runtime.
- Fast-XML parser, axios, socket.io, Prometheus client libraries.
- SCOM environment configured for file drop integration.
- OBM environment with REST API credentials and TLS trust.
- Optional: Prometheus/Grafana for metrics consumption.

## 8. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| OBM outage causing backlog | Circuit breaker + DLQ replays when service restored. |
| Malformed XML causing parser crash | Parser guards with try/catch and logs errors; updates tests. |
| Secret leakage | Credential store encryption, UI redaction, audit logging on access. |
| Configuration drift | Persistent config service, UI change logging, version control for YAML. |
| Operator error (replaying wrong events) | Audit log of DLQ actions, role-based access enforced via deployment posture. |

## 9. Future Enhancements
- Message queue integration (e.g., Kafka) to decouple ingestion.
- Multi-tenant support for multiple OBM targets.
- Advanced alerting integrations (email, Slack, ServiceNow).
- Automatic DLQ cleanup policies with archiving service.
- Infrastructure as Code modules (Terraform/Helm charts).

## 10. References
- `SCOM-OBM-Adapter-PRD.md`
- `Cursor-AI-Workflow.md`
- Low-Level Design (LLD) document
- Configuration Guide
- User & Admin Guides

---
This HLD should be reviewed and baselined before major architectural changes or cross-team integration efforts.

