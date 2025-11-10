# SCOM → OBM Integration Adapter – Configuration Guide

## 1. Introduction
This guide provides a comprehensive walkthrough for configuring the adapter across environments (development, staging, production). It details file structure, configuration schema, validation rules, hot-reload behavior, and runtime overrides.

## 2. Configuration Artifacts
- **Primary File**: `backend/config/config.yaml`
- **Template**: `backend/config/config.template.yaml`
- **Schema Definition**: `backend/src/config/config.schema.ts`
- **Secret Store**: `backend/data/secrets/*.json` (when `credentialStore=file`)
- **Environment Overrides**: Variables prefixed with `ADAPTER_`
- **Runtime Updates**: `/api/config` (PATCH) and `/api/config/secrets` (POST)

## 3. Configuration Domains

### 3.1 Global
```yaml
environment: development | test | staging | production
```
Used for logging context and environment-specific logic (e.g., slack notifications).

### 3.2 OBM Connectivity (`obm`)
| Field | Description | Hot Reloadable | Default |
|-------|-------------|----------------|---------|
| `baseUrl` | Root OBM URL (e.g., `https://obm.example.com`) | ❌ | n/a |
| `eventEndpoint` | REST API path (e.g., `/opr-web/rest/9.10/event_list`) | ❌ | n/a |
| `auth.method` | `basic`, `apikey`, or `certificate` | ❌ | `basic` |
| `auth.username` | Optional username for Basic auth | ✅ | `undefined` |
| `auth.password` | Secret (managed via credential store) | ❌ | `undefined` |
| `auth.apiKey` | Secret for API key auth | ❌ | `undefined` |
| `tls.verify` | Validate server certificate | ✅ | `true` |
| `tls.allowSelfSigned` | Trust self-signed certs | ✅ | `false` |
| `tls.minVersion` | `TLSv1.2` or `TLSv1.3` | ✅ | `TLSv1.2` |
| `tls.caFilePath` | Optional custom CA bundle | ❌ | `undefined` |
| `keepAlive` | HTTP keep-alive for axios agent | ✅ | `true` |
| `maxSockets` | Max concurrent sockets | ✅ | `10` |
| `rateLimitMs` | Minimum delay between OBM submissions | ✅ | `500` |
| `connectionTimeoutMs` | Axios connect timeout | ✅ | `30000` |
| `readTimeoutMs` | Axios response timeout | ✅ | `60000` |

### 3.3 SCOM Ingestion (`scom`)
| Field | Description | Hot Reloadable | Default |
|-------|-------------|----------------|---------|
| `xmlDirectory` | Directory monitored for XML exports | ❌ | n/a |
| `filePattern` | Glob pattern (`*.xml`) | ✅ | `*.xml` |
| `pollingIntervalMs` | Polling cadence | ✅ | `30000` |
| `encoding` | File encoding (e.g., `utf8`) | ❌ | `utf8` |
| `concurrentParsers` | Parallel XML parser count | ✅ | `2` |
| `schemaPath` | Optional XSD validation path | ❌ | `undefined` |
| `maxFileSizeMb` | Reject files over limit | ❌ | `100` |

### 3.4 Processing & Retry
- `processing.batchSize`, `batchTimeoutMs`, `maxConcurrentBatches`, `queueCapacity`, `rateLimitMs`, `maxEventsPerFile`
- `retry.maxAttempts`, `initialDelayMs`, `maxDelayMs`, `backoffMultiplier`, `jitterFactor`, `retryableStatusCodes`, `retryableErrors`, `budgetPerMinute`

All retry parameters are hot reloadable; critical processing fields like `queueCapacity` require restart.

### 3.5 Circuit Breaker (`circuitBreaker`)
- `failureThreshold`, `successThreshold`, `timeoutMs`, `volumeThreshold`, `errorThresholdPercentage`, `halfOpenMaxCalls`
- Non-hot-reloadable (changes require restart) except `timeoutMs`.

### 3.6 Dead Letter Queue (`dlq`)
- `enabled`, `directory`, `fileName`, `maxFileSizeMb`, `maxEvents`, `rotationStrategy`, `retentionDays`, `alertThreshold`
- File path changes require restart; thresholds hot reloadable.

### 3.7 Logging & Metrics
- `logging.level`, `prettyPrint`, `directory`, `maxSizeMb`, `maxFiles`, `includeRequestId`, `redact`
- `metrics.enabled`, `port`, `path`, `defaultLabels`
- Hygienic logging fields hot reloadable; directory/port require restart.

### 3.8 Dashboard (`dashboard`)
- `enabled`, `port`, `host`, `corsOrigins`, `sessionTimeoutMinutes`
- CORS adjustments are hot reloadable.

### 3.9 Security (`security`)
- `credentialStore`: `file`, `env`, or `windows`
- `credentialStoreNamespace`, `encryptionKey`, `redactFields`
- Changes require restart to reinitialize credential store.

### 3.10 Monitoring (`monitoring`)
- Alert rules array with `name`, `condition`, `severity`, `message`
- Notification channels (email/webhook/slack) with enablement flags and addresses.
- Fully hot-reloadable.

## 4. Configuration Lifecycle

### 4.1 Initial Setup
1. Copy template to `config.yaml`.
2. Populate OBM and SCOM sections.
3. Decide on credential store mode:
   - For `file`, set `encryptionKey` in config or env var `ADAPTER_ENCRYPTION_KEY`.
   - For `env`, inject secrets as environment variables (uppercase with underscores).
4. Run `npm run config:validate` (custom script recommended) or rely on app start (throws on validation failure).

### 4.2 Hot Reload
- Backend watches `config.yaml` and auto-applies changes for keys in the hot-reload allowlist.
- Non hot-reload keys revert automatically and emit `error` event, requiring manual restart.
- Event listeners (e.g., OBM client) rebuild their dependencies when `configService.reloaded` fires.

### 4.3 Runtime Updates via API
- `PATCH /api/config` accepts payload validated through `adapterConfigUpdateSchema`.
  - Example:
    ```json
    {
      "obm": {
        "baseUrl": "https://obm.prod.example.com",
        "tls": { "allowSelfSigned": false }
      },
      "scom": {
        "pollingIntervalMs": 15000
      }
    }
    ```
  - Response includes sanitized config and metadata:
    ```json
    {
      "meta": {
        "requiresRestart": true,
        "changedKeys": ["obm.baseUrl", "scom.pollingIntervalMs"]
      }
    }
    ```
- `POST /api/config/secrets` rotates credentials (`{"obm":{"password":"NewPass!"}}`).
- The dashboard’s Config Drawer wraps these endpoints with validation and success/error messaging.

### 4.4 Environment Overrides
- Any environment variable prefixed with `ADAPTER_` is applied post-file load.
- Example: `ADAPTER_OBM__BASEURL=https://staging-obm.example.com`
  - Double underscores (`__`) map to nested objects.
  - Values parsed as JSON when possible (e.g., numbers, booleans).
- If overrides fail validation, initialization aborts with descriptive error.

## 5. Validation & Testing
- Run backend unit tests targeting configuration: `npm run test -- --runTestsByPath tests/unit/config/config.schema.test.ts`.
- Integration tests: `tests/integration/config.routes.test.ts` ensure API responses and secret rotation behave as expected.
- Manual verification:
  - `GET /api/config` should return sanitized config.
  - `PATCH /api/config` updates `config.yaml` (check file modification timestamp).

## 6. Recommended Values
| Environment | `pollingIntervalMs` | `retry.maxAttempts` | `circuitBreaker.failureThreshold` | Notes |
|-------------|---------------------|----------------------|-----------------------------------|-------|
| Development | 15000               | 3                    | 5                                 | Use self-signed certificates allowed |
| Staging     | 10000               | 5                    | 5                                 | Mirror production OBM endpoint |
| Production  | 5000                | 7                    | 3                                 | Disable `allowSelfSigned`, tighten retry budget |

## 7. Change Management
- Track all config modifications in change logs or ticketing system.
- Use dashboard metadata (`changedKeys`, `requiresRestart`) for documentation.
- Always restart service for non-hot reload keys; failure to do so may leave config stale.
- Commit sanitized configs to Git; store secrets in vaults (HashiCorp, Azure Key Vault, etc.).

## 8. Troubleshooting Configuration Issues
| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Backend fails to start | Check console for `Configuration validation failed` with field path | Update YAML to satisfy schema |
| Changes do not apply | Field not hot reloadable | Restart backend service |
| Secret rotation ineffective | Wrong credential store | Confirm `config.security.credentialStore`; restart after switching |
| Dashboard cannot fetch config | CORS restriction | Add dashboard origin to `dashboard.corsOrigins` |
| OBM authentication failures | Invalid secret or TLS trust | Rotate secret via API and confirm CA bundle |

## 9. Automation Hooks
- **CI**: Validate configuration using scripts before packaging.
- **CD**: Inject environment overrides from pipeline variables.
- **Monitoring**: Alert when `adapter_config_reload_errors_total` (future metric) increases.

## 10. Appendices
- **Appendix A**: `adapterConfigSchema` excerpt (key definitions).
- **Appendix B**: Example configuration for dual OBM tenants.
- **Appendix C**: Payload schema for UI-driven updates.

---
Maintain this guide alongside the codebase to ensure up-to-date references for all teams interacting with the adapter configuration.

