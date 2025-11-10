# SCOM → OBM Integration Adapter – Administrator Guide

## 1. Purpose
This guide targets platform and site reliability engineers accountable for deploying, operating, and maintaining the SCOM → OBM Integration Adapter. It covers infrastructure requirements, security controls, maintenance routines, operational runbooks, and procedures for upgrades or rollbacks.

## 2. System Overview
- **Backend Service**: Node.js (TypeScript) Express API, providing ingestion, transformation, retry, DLQ, metrics, and configuration APIs.
- **Frontend Dashboard**: React 19 + Vite + Tailwind UI for operational visibility and runtime configuration.
- **Persistence**: File-based storage for DLQ (`data/dlq/*.jsonl.gz`), audit logs (`logs/audit`), and credential store (`data/secrets/*.json`) when `credentialStore=file`.
- **Integration Points**:
  - **SCOM**: File watcher monitoring XML drops in configured directories.
  - **OBM**: HTTPS REST API for event ingestion with Basic, API key, or client certificate authentication.
- **Observability**: Prometheus metrics, structured JSON logs, socket-based telemetry to frontend, and alerting rules.

## 3. Deployment Requirements
| Component | Requirement |
|-----------|-------------|
| Operating System | Windows Server 2019+, RHEL 8+, or containerized environment |
| Node.js | v20 LTS |
| NPM | 10.x |
| Database | Not required (file system storage) |
| Network | Outbound HTTPS to OBM, SMB/NFS or local disk access to SCOM export directory |
| Certificates | TLS CA, client certificate/key pair if certificate auth is chosen |
| Permissions | Read access to SCOM export directory, outbound HTTPS, write access to adapter `data/` and `logs/` directories |

## 4. Installation Steps
1. **Clone Repository**
   ```powershell
   git clone https://github.com/mostafa-fawzy91/OBM-SCOM-Adapter.git
   cd OBM-SCOM-Adapter
   ```
2. **Install Dependencies**
   ```powershell
   npm install
   cd backend
   npm install
   ```
3. **Prepare Configuration**
   - Copy `backend/config/config.template.yaml` to `backend/config/config.yaml`.
   - Set environment-specific values (see Configuration Guide).
   - Provide encryption key: `setx ADAPTER_ENCRYPTION_KEY "<32+ chars>"`.
4. **Build/Run**
   ```powershell
   npm run build            # Frontend bundle (optional for dev)
   cd backend
   npm run build            # Transpile backend
   npm run start            # Launch compiled server
   ```
   For development:
   ```powershell
   npm run dev              # Frontend (root)
   cd backend
   npm run dev              # Backend with ts-node + nodemon
   ```
5. **Containerized Deployment**
   - Build Docker images using provided Dockerfile (future addition).
   - Mount volumes for logs, data, and config.
   - Supply environment variables via secrets manager or Kubernetes ConfigMap + Secret.

## 5. Security & Access Control
- **Authentication Modes**:
  - *Basic*: Credential store required (`obm.auth.method=basic`).
  - *API Key*: Store API key in credential store.
  - *Certificate*: Provide `tls.certFilePath` & `tls.keyFilePath`.
- **Credential Store Options** (`config.security.credentialStore`):
  - `file`: AES-256 encrypted JSON file stored under `data/secrets`. Requires `encryptionKey`.
  - `env`: Secrets pulled from environment variables. Ensure they are injected securely.
  - `windows`: Placeholder to integrate with Windows Credential Manager (reads environment variables by convention).
- **TLS**:
  - Set `obm.tls.verify` and `allowSelfSigned`.
  - Provide CA bundle path for internal CAs.
- **RBAC**: Integrate dashboard behind organization SSO (e.g., reverse proxy or ingress controller).
- **Audit Logging**: All event lifecycle actions recorded in `logs/audit`. Ensure log rotation and secure storage.

## 6. Operations Runbook
### 6.1 Daily Checks
1. Verify dashboard health indicator and circuit breaker state.
2. Inspect DLQ size and investigate any new entries.
3. Check alert panel for new warnings (e.g., error-rate spikes).
4. Review `metrics` endpoint for anomalies (integrate with Grafana).

### 6.2 Weekly Maintenance
1. Rotate logs (`logs/` and `logs/audit/`).
2. Rotate secrets if required by policy.
3. Validate backup of `data/secrets` when using file store.
4. Run automated tests (`npm run test -- --coverage`) to ensure build integrity.

### 6.3 Incident Response
- **Circuit Breaker Open**: Inspect OBM availability logs, evaluate `retry` configuration, consider temporarily increasing `retry.maxAttempts`.
- **Persistent DLQ Growth**: Analyze failure reasons, escalate to SCOM/OBM owner, and replay after addressing root cause.
- **Configuration Errors**: Use dashboard’s configuration drawer or edit `config.yaml` and restart service when non-hot reloadable keys change.

## 7. Upgrade Procedure
1. Checkout release tag or new commit.
2. Run automated test suite (`npm run lint && npm run test -- --coverage`).
3. Backup:
   - `backend/config/config.yaml`
   - `backend/data/secrets`
   - `backend/data/dlq`
4. Apply schema migrations (if any) or adjust config per release notes.
5. Restart backend service (`systemctl`, `pm2`, or container restart).
6. Validate `/health` and run synthetic event submission for smoke test.
7. Update dashboard bundle if served statically (`npm run build` → copy `dist/` to web host).

### 7.1 Rollback
1. Restore backed-up config and secrets.
2. Downgrade code to previous known good version.
3. Restart services and run smoke test to confirm event processing.

## 8. Backup & Recovery
- **Config**: Version control `config.yaml`; maintain secure backup of secrets.
- **DLQ**: Archive `data/dlq/*.jsonl` regularly for forensic analysis.
- **Logs**: Ship to centralized log management (e.g., Elastic, Splunk).
- **Disaster Recovery**:
  - Rehydrate by redeploying code, restoring config/secrets, and replaying DLQ files via the dashboard or CLI script.

## 9. Monitoring & Metrics
- Endpoint: `GET /metrics` (Prometheus format).
- Core Metrics:
  - `adapter_events_total{status}` – success/failed counts.
  - `adapter_retry_count_total` – retry attempts.
  - `adapter_dlq_size` – current DLQ size.
  - `adapter_processing_duration_seconds` – histogram of end-to-end processing.
  - `adapter_api_latency_seconds` – OBM API latency.
  - `adapter_circuit_breaker_state` – gauge (0=closed,1=half-open,2=open).
- Dashboards: Import Prometheus data into Grafana/OBM OpsBridge for historical trends.

## 10. Compliance Considerations
- **PII/Sensitive Data**: Ensure SCOM payloads do not carry sensitive information. Use `logging.redact` configuration to mask fields.
- **Audit Trail**: Retain audit logs per policy; export on demand using future automation CLI.
- **Encryption**: Enforce TLS 1.2+ and store secrets with AES-256.
- **Access Reviews**: Periodically review who can modify configuration or replay DLQ.



