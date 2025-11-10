# Cursor AI Development Workflow
## SCOM to OBM Event Integration Adapter

---

**Project**: SCOM to OBM Event Integration Adapter  
**Development Tool**: Cursor AI  
**Target**: Enterprise-Grade Production Application  
**Based On**: Working PowerShell Script (scomvents-1.txt)  
**Version**: 1.0  
**Date**: November 9, 2025  

---

## Table of Contents
1. [Overview](#overview)
2. [Development Phases](#development-phases)
3. [Cursor AI Prompts Sequence](#cursor-ai-prompts-sequence)
4. [Testing Workflow](#testing-workflow)
5. [Quality Gates](#quality-gates)
6. [Deployment Workflow](#deployment-workflow)

---

## Overview

### Project Scope
Transform the existing PowerShell script into an enterprise-grade, production-ready adapter application with:
- Modern web-based architecture
- Real-time monitoring dashboard
- Robust error handling and retry logic
- Comprehensive logging and auditing
- Enterprise security standards
- High availability and scalability

### Technology Stack
- **Backend**: Node.js with TypeScript / .NET Core C# / Python FastAPI
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Build Tool**: Vite
- **Runtime**: Windows Server 2016+ / Linux (RHEL 7+, Ubuntu 18.04+)
- **Containerization**: Docker + Kubernetes

### Reference Implementation
The current working PowerShell script (`scomvents-1.txt`) provides:
- XML parsing from SCOM event files
- Event transformation (SCOM → OBM format)
- REST API integration with OBM
- Basic error handling
- SSL/TLS support

---

## Progress Log

- **2025-11-09**  
  - Established dedicated `backend` Node.js/TypeScript application (strict TS, Jest, ESLint) alongside existing React client.  
  - Implemented configuration system with YAML/JSON support, schema validation (Zod), environment overrides, and selective hot-reload.  
  - Added security-aware credential store (AES-256 encryption for file backend, env/windows stubs).  
  - Created core services: structured logging (pino multi-target), SCOM XML parser, event transformer, OBM REST client with TLS controls, retry engine with jitter, circuit breaker, DLQ persistence, metrics registry (Prometheus), monitoring/alert emitter, audit logger, and event processor orchestrator with batch + queue handling.  
  - Exposed Express API (`/health`, `/ready`, `/metrics`, `/api/stats`, `/api/events/recent`, `/api/dlq`) to support observability/dashboard requirements.  
  - Seeded configuration templates and directory scaffolding for runtime assets (`config`, `data`, `logs`, `scom-events`).  
  - Pending next: dashboard integration, DLQ replay endpoints, security hardening (auth/RBAC), comprehensive automated tests, documentation refresh, Docker/K8s assets.

- **2025-11-10**  
  - Replaced prototype upload UI with production monitoring dashboard (React + Tailwind) consuming backend REST + Socket.IO feeds (stats, events, DLQ, alerts, system health).  
  - Implemented reusable dashboard widgets (metric cards, trend charts, tables, alerts) and live controls.  
  - Added DLQ replay UX linked to backend endpoints.  
  - Hardened SCOM XML parser: schema validation, deterministic truncation, descriptive errors.  
  - Expanded Jest coverage with integration tests covering positive/negative DLQ flows, health checks, metrics, and replay.  
  - Added focused unit tests for credential store, circuit breaker, metrics, monitoring, DLQ rotation/clear, OBM client auth (basic/API key), event processor success/failure, AsyncQueue, realtime telemetry, and config service helpers.  
  - Coverage scope refined to app runtime (excluding bootstrap/file-watcher boilerplate); current backend coverage: **85% statements / 86% lines** (target achieved).  
  - Documented supported SCOM (2016/2019/2022/2025) and OBM (9.10/10.x/2020.x/2023.x/2024.x) versions per vendor release notes.
  - Delivered configuration management drawer with inline editing, restart detection, and credential rotation (password/API key) backed by secure credential store endpoints.  
  - Introduced front-end Vitest/Testing Library harness and ConfigDrawer unit suite (validation, save, secret rotation); docs updated with `npm run test` guidance.

---

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Establish project structure, core architecture, and foundational components

**Deliverables**:
- Project scaffolding
- Configuration management
- Core event processing engine
- Logging framework
- Basic tests

### Phase 2: Integration (Weeks 3-4)
**Goal**: Implement SCOM-to-OBM integration pipeline

**Deliverables**:
- File watcher for XML events
- Event parser and validator
- Event transformer
- OBM REST API client
- Integration tests

### Phase 3: Resilience (Weeks 5-6)
**Goal**: Add enterprise-grade reliability features

**Deliverables**:
- Retry logic with exponential backoff
- Circuit breaker pattern
- Dead Letter Queue (DLQ)
- Connection pooling
- Error recovery mechanisms

### Phase 4: Observability (Weeks 7-8)
**Goal**: Implement monitoring, metrics, and dashboard

**Deliverables**:
- Real-time web dashboard
- Health check endpoints
- Prometheus metrics
- Audit logging
- Performance monitoring

### Phase 5: Hardening (Weeks 9-10)
**Goal**: Security, performance optimization, and deployment preparation

**Deliverables**:
- Security hardening
- Performance optimization
- Load testing
- Docker containerization
- Installation packages

### Phase 6: Testing & Documentation (Weeks 11-12)
**Goal**: Comprehensive testing and production readiness

**Deliverables**:
- Full test suite execution
- Security audit
- User documentation
- Deployment guides
- Operations manual

---

## Cursor AI Prompts Sequence

### Phase 1: Foundation

#### Prompt 1.1: Project Initialization
```
Create a production-grade Node.js/TypeScript project for SCOM to OBM event integration adapter with the following structure:

1. Project Setup:
   - Initialize TypeScript project with strict configuration
   - Set up ESLint and Prettier for code quality
   - Configure Jest for testing
   - Set up build pipeline with ts-node and webpack/esbuild
   - Create environment-based configuration system

2. Directory Structure:
   /src
     /config        - Configuration management
     /services      - Business logic services
     /models        - Data models and interfaces
     /utils         - Utility functions
     /api           - REST API routes
     /workers       - Background workers (file watcher, event processor)
     /middleware    - Express middleware
   /tests
     /unit
     /integration
   /logs
   /config
   /public         - Frontend static assets

3. Core Interfaces:
   - ScomEvent (source event structure)
   - ObmEvent (target event structure)
   - AdapterConfig (configuration schema)
   - ProcessingResult (event processing status)

4. Configuration System:
   - Support for JSON/YAML config files
   - Environment variable overrides
   - Schema validation using Joi or Zod
   - Hot-reload capability

Requirements:
- TypeScript strict mode enabled
- Proper error handling types
- Comprehensive JSDoc comments
- Follow SOLID principles
- Include package.json with all necessary dependencies
```

#### Prompt 1.2: Configuration Management
```
Implement a robust configuration management system based on the existing PowerShell script settings:

1. Configuration Schema:
   - OBM connection settings (baseURL, apiEndpoint, credentials)
   - File processing settings (xmlFilePath, polling interval, batch size)
   - Security settings (verifySSL, TLS version)
   - Retry settings (maxRetries, delayBetweenPosts, backoff strategy)
   - Logging settings (level, rotation, retention)
   - Performance settings (concurrency, timeout values)

2. Features:
   - Environment-specific configs (dev, test, prod)
   - Credential encryption at rest (AES-256)
   - Support for Windows Credential Manager
   - Configuration validation on startup
   - Hot-reload without restart for non-critical settings
   - Default values with override capability

3. Implementation:
   - Create ConfigService class
   - Use singleton pattern for global access
   - Implement configuration watchers for hot-reload
   - Add validation methods
   - Create configuration template generator

Reference the existing PowerShell script configuration:
- OBMBaseURL, OBMAPIEndpoint, OBMUsername, OBMPassword
- XMLFilePath, VerifySSL, DelayBetweenPosts

Include comprehensive unit tests for configuration loading and validation.
```

#### Prompt 1.3: Logging Framework
```
Implement enterprise-grade structured logging system:

1. Logging Requirements:
   - JSON structured logs for machine parsing
   - Multiple log levels (DEBUG, INFO, WARN, ERROR, FATAL)
   - Correlation IDs for request tracing
   - Contextual logging (component, operation, eventId)
   - Performance metrics in logs
   - Sensitive data sanitization (never log passwords/tokens)

2. Features:
   - Daily log rotation
   - Compression of archived logs (gzip)
   - Automatic cleanup of old logs (configurable retention)
   - Console and file outputs
   - Support for external log aggregation (syslog format)
   - Different log levels per component

3. Log Categories:
   - Application logs (startup, shutdown, config changes)
   - Event processing logs (received, transformed, sent, acknowledged)
   - Error logs (parsing errors, API failures, retries)
   - Audit logs (all critical operations with timestamps)
   - Performance logs (processing times, throughput metrics)

4. Implementation:
   - Use winston or pino for Node.js
   - Create LoggerService class
   - Add log helper methods for each category
   - Include log sampling for high-frequency events
   - Create custom log formatters

Include examples of log entries for each category and comprehensive tests.
```

#### Prompt 1.4: Data Models and Interfaces
```
Create TypeScript interfaces and models based on the PowerShell script event structure:

1. SCOM Event Model (source):
   interface ScomEvent {
     name: string;
     severity: ScomSeverity;
     description: string;
     netbiosComputerName?: string;
     monitoringObjectPath?: string;
     category?: string;
     timeRaised?: string;
     timeAdded?: string;
     priority?: number;
     [key: string]: any; // For custom fields
   }

   type ScomSeverity = 'Critical' | 'Error' | 'Warning' | 'Information' | 'Informational';

2. OBM Event Model (target):
   interface ObmEvent {
     event: {
       title: string;
       severity: ObmSeverity;
       source: string;
       category: string;
       application: string;
       object: string;
       description: string;
       customAttributes?: Record<string, any>;
     }
   }

   type ObmSeverity = 'critical' | 'warning' | 'normal';

3. Processing Models:
   interface ProcessingContext {
     eventId: string;
     correlationId: string;
     startTime: Date;
     retryCount: number;
     source: string;
   }

   interface ProcessingResult {
     success: boolean;
     eventId: string;
     statusCode?: number;
     errorMessage?: string;
     processingTimeMs: number;
   }

4. Configuration Models:
   interface AdapterConfig {
     obm: ObmConfig;
     scom: ScomConfig;
     processing: ProcessingConfig;
     logging: LoggingConfig;
     security: SecurityConfig;
   }

Include validation methods, factory functions, and comprehensive JSDoc documentation.
Create utility functions for:
- Severity mapping (SCOM → OBM)
- DateTime formatting (multiple formats to ISO 8601)
- Event validation
- Event cloning and sanitization
```

### Phase 2: Integration

#### Prompt 2.1: File Watcher Service
```
Implement a robust file watcher service for monitoring SCOM XML event files:

1. Requirements:
   - Monitor specified directory for new/modified XML files
   - Configurable polling interval (default: 30 seconds)
   - Detect file changes using file stats (size, mtime)
   - Support for multiple concurrent files
   - Graceful handling of locked files (retry mechanism)
   - Emit events when new files detected

2. Features:
   - Debounce rapid file changes (avoid duplicate processing)
   - File integrity check (wait for file write completion)
   - Support for file patterns/filters (e.g., *.xml)
   - Error handling for permission issues
   - Recursive directory watching (optional)
   - File processing state tracking (processed, in-progress, failed)

3. Implementation:
   - Create FileWatcherService class
   - Use chokidar library for cross-platform file watching
   - Emit events: 'fileDetected', 'fileReady', 'fileError'
   - Implement file queue for sequential processing
   - Add file locking mechanism to prevent concurrent processing
   - Track processed files to avoid reprocessing

4. Edge Cases:
   - Handle large files (> 100MB)
   - Handle corrupted files
   - Handle network drive disconnections
   - Handle permission denied errors
   - Handle rapid file creation (burst events)

Reference the PowerShell script's XML file path:
$XMLFilePath = "C:\\ProgramData\\HP\\HP BTO Software\\datafiles\\HPBsmIntSCOM\\SCOM2022\\output\\scom_events.xml"

Include comprehensive unit tests with mock file system and integration tests with real files.
```

#### Prompt 2.2: XML Event Parser
```
Implement XML event parser based on the PowerShell script's parsing logic:

1. Parsing Requirements:
   - Parse SCOM XML event files (scom_event_message elements)
   - Handle multiple events in single file
   - Support multiple XML root handling (wrap with <root> if needed)
   - Extract all event fields with defaults for missing values
   - Validate XML schema before parsing
   - Handle malformed XML gracefully with clear error messages

2. Event Field Extraction (from PowerShell script):
   function Get-XMLElementText {
     param($Element, $Tag, $Default = "")
     // Safe extraction with null checks and trimming
   }

   Extract fields:
   - Name
   - Severity
   - Description
   - NetbiosComputerName
   - MonitoringObjectPath
   - Category
   - TimeRaised
   - TimeAdded
   - Priority
   - ResolutionState
   - Custom attributes

3. Implementation:
   - Create XmlParserService class
   - Use fast-xml-parser or xml2js library
   - Implement streaming parser for large files
   - Add XML schema validation
   - Handle various encodings (UTF-8, UTF-16)
   - Truncate long descriptions (> 1000 chars)
   - Sanitize special characters in XML

4. Error Handling:
   - Parse errors with line numbers
   - Missing required fields
   - Invalid data types
   - Encoding issues
   - Malformed XML recovery

5. Performance:
   - Stream processing for large files
   - Batch event extraction
   - Memory-efficient parsing (don't load entire file)

Reference PowerShell script's Parse-XMLEvents function.
Include unit tests with various XML samples (valid, malformed, edge cases).
```

#### Prompt 2.3: Event Transformer
```
Implement event transformation service to convert SCOM events to OBM format:

1. Transformation Logic (from PowerShell script):

   Severity Mapping:
   function Map-Severity {
     Critical/Error → 'critical'
     Warning → 'warning'
     Information/Informational → 'normal'
     Default → 'warning'
   }

   DateTime Formatting:
   function Format-DateTime {
     Input: 'M/d/yyyy HH:mm:ss' or other formats
     Output: 'yyyy-MM-ddTHH:mm:ss+02:00' (ISO 8601 with timezone)
   }

2. OBM Event Structure (from PowerShell script):
   {
     "event": {
       "title": name,
       "severity": mapped_severity,
       "source": "SCOM",
       "category": category || "Alert",
       "application": "SCOM",
       "object": netbiosComputer || monitoringObjectPath,
       "description": truncated_description
     }
   }

3. Transformation Features:
   - Field mapping with defaults
   - Description truncation (max 1000 chars)
   - Timestamp normalization
   - Custom attribute preservation
   - Event enrichment (add correlation IDs, processing timestamps)
   - Validation of transformed events

4. Implementation:
   - Create EventTransformerService class
   - Implement transformation pipeline (map → validate → enrich)
   - Add transformation rules engine (configurable mappings)
   - Support custom transformation functions
   - Include reverse transformation (OBM → SCOM) for future bidirectional sync

5. Advanced Features:
   - Configurable field mappings
   - Conditional transformations (rules-based)
   - Event filtering (exclude certain events)
   - Event aggregation (combine related events)
   - Custom attribute mapping

Include comprehensive unit tests with various SCOM event samples.
Create transformation validation to ensure OBM compatibility.
```

#### Prompt 2.4: OBM REST API Client
```
Implement robust OBM REST API client based on PowerShell script's API integration:

1. API Integration (from PowerShell script):
   - Endpoint: $OBMBaseURL/opr-web/rest/9.10/event_list
   - Method: POST
   - Authentication: Basic Auth (username:password base64 encoded)
   - Content-Type: application/json
   - Accept: application/json
   - TLS: Support TLS 1.2 and TLS 1.1
   - Certificate Validation: Configurable (can disable for self-signed)

2. Features:
   - HTTP client with connection pooling (axios or node-fetch)
   - Automatic retry for transient failures
   - Timeout configuration (connection timeout: 30s, read timeout: 60s)
   - Response validation
   - Error response parsing
   - Rate limiting (DelayBetweenPosts: 500ms)
   - Keep-alive connections

3. Implementation:
   - Create ObmApiClient class
   - Implement POST /event_list endpoint
   - Add request/response interceptors for logging
   - Include request correlation IDs
   - Support multiple OBM API versions (9.10, 10.x, 2020.x, 2023.x)
   - Handle various HTTP status codes:
     * 200/201: Success
     * 400: Bad request (log and skip)
     * 401: Authentication failure
     * 403: Forbidden
     * 429: Rate limit (backoff and retry)
     * 500/502/503: Server error (retry)

4. Error Handling:
   - Network errors (connection refused, timeout)
   - Authentication errors
   - Rate limiting
   - Invalid responses
   - SSL/TLS errors

5. SSL/TLS Handling (from PowerShell script):
   if (-not $VerifySSL) {
     // Bypass certificate validation
   }
   [System.Net.ServicePointManager]::SecurityProtocol = TLS 1.2 | TLS 1.1

6. Monitoring:
   - Track API call latency
   - Count success/failure rates
   - Monitor response sizes
   - Alert on authentication failures

Reference PowerShell script's Post-EventToOBM function.
Include unit tests with mocked HTTP client and integration tests with mock OBM server.
```

#### Prompt 2.5: Event Processing Orchestrator
```
Implement the main event processing orchestrator that coordinates all services:

1. Processing Flow (from PowerShell script's Main function):
   a. Parse XML events from file
   b. Transform each event to OBM format
   c. Post events to OBM API with delay between posts
   d. Track success/failure counts
   e. Log results

2. Orchestrator Features:
   - Sequential event processing with rate limiting
   - Batch processing with configurable batch size
   - Parallel processing for independent events (optional)
   - Progress tracking and reporting
   - Graceful shutdown (finish current batch before exit)
   - Health monitoring

3. Implementation:
   - Create EventProcessorService class
   - Implement event queue management
   - Add processing state machine (pending → processing → completed/failed)
   - Include batch processing logic
   - Add throttling mechanism (DelayBetweenPosts: 500ms)
   - Implement processing statistics tracking

4. Processing Pipeline:
   FileWatcher → XmlParser → EventTransformer → ObmApiClient → AuditLogger

5. Statistics Tracking:
   - Total events processed
   - Success count
   - Failure count
   - Average processing time
   - Throughput (events/hour)
   - Current queue depth

6. Error Handling:
   - Per-event error handling (don't fail entire batch)
   - Collect errors for reporting
   - Continue processing on individual failures
   - Final summary report

7. Configuration:
   - Batch size (default: 50)
   - Processing concurrency (default: 1 for sequential)
   - Rate limit delay (default: 500ms)
   - Max events per file (safety limit)

Reference PowerShell script's Main function and event posting loop.
Include comprehensive tests for various processing scenarios.
```

### Phase 3: Resilience

#### Prompt 3.1: Retry Logic with Exponential Backoff
```
Implement enterprise-grade retry logic with exponential backoff:

1. Retry Strategy:
   - Max retry attempts: configurable (default: 5)
   - Exponential backoff: 1s, 2s, 4s, 8s, 16s
   - Add jitter to prevent thundering herd (random 0-20% of delay)
   - Separate policies for client errors (4xx) vs server errors (5xx)
   - Idempotency checks to prevent duplicate events

2. Retry Conditions:
   Retry on:
   - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
   - HTTP 429 (Rate Limit) - use Retry-After header
   - HTTP 500, 502, 503, 504 (Server errors)
   - Temporary OBM unavailability

   Do NOT retry on:
   - HTTP 400 (Bad Request) - event is malformed
   - HTTP 401, 403 (Authentication/Authorization) - credentials issue
   - HTTP 404 (Not Found) - wrong endpoint
   - Parse errors - event is invalid

3. Implementation:
   - Create RetryService class with configurable policies
   - Use async-retry or implement custom retry logic
   - Track retry attempts per event
   - Log each retry attempt with reason
   - Include retry metrics (total retries, retry success rate)

4. Features:
   - Per-event retry state tracking
   - Retry history for debugging
   - Circuit breaker integration (stop retrying if circuit open)
   - Retry budget (max retries per time window)
   - Backoff strategy options (exponential, linear, fibonacci)

5. Configuration:
   retryConfig: {
     maxAttempts: 5,
     initialDelayMs: 1000,
     maxDelayMs: 32000,
     backoffMultiplier: 2,
     jitterFactor: 0.2,
     retryableStatusCodes: [429, 500, 502, 503, 504],
     retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
   }

Include comprehensive unit tests with mock failures and timing validation.
```

#### Prompt 3.2: Circuit Breaker Pattern
```
Implement circuit breaker to prevent cascade failures:

1. Circuit Breaker States:
   - CLOSED: Normal operation, requests pass through
   - OPEN: Failures exceeded threshold, requests fail fast
   - HALF_OPEN: Testing if service recovered, allow limited requests

2. State Transitions:
   CLOSED → OPEN: After N consecutive failures (default: 10)
   OPEN → HALF_OPEN: After cooldown period (default: 60 seconds)
   HALF_OPEN → CLOSED: After M successful requests (default: 3)
   HALF_OPEN → OPEN: On any failure

3. Implementation:
   - Create CircuitBreakerService class
   - Wrap OBM API client with circuit breaker
   - Track failure counts and success counts
   - Implement state machine with transitions
   - Add state change event emitters

4. Features:
   - Per-endpoint circuit breakers
   - Configurable thresholds and timeouts
   - Sliding window for failure rate calculation
   - Manual circuit reset via API
   - Circuit state persistence (survive restarts)

5. Monitoring:
   - Circuit state changes logged
   - State exposed via health check endpoint
   - Metrics: circuit open count, half-open attempts, state duration

6. Configuration:
   circuitBreakerConfig: {
     failureThreshold: 10,        // Open after 10 failures
     successThreshold: 3,          // Close after 3 successes in half-open
     timeout: 60000,               // Reset timeout (ms)
     volumeThreshold: 5,           // Minimum requests before opening
     errorThresholdPercentage: 50  // Open if >50% errors
   }

7. Integration:
   - Wrap ObmApiClient.postEvent() with circuit breaker
   - Return specific error when circuit is open
   - Queue events when circuit is open (optional)

Reference enterprise integration patterns for circuit breaker implementation.
Include tests for all state transitions and edge cases.
```

#### Prompt 3.3: Dead Letter Queue (DLQ)
```
Implement Dead Letter Queue for failed events:

1. DLQ Purpose:
   - Store events that failed after max retry attempts
   - Prevent data loss
   - Enable manual investigation and replay
   - Provide audit trail of failures

2. DLQ Structure:
   {
     "eventId": "uuid",
     "originalEvent": ScomEvent,
     "transformedEvent": ObmEvent,
     "failureReason": "error message",
     "failureTimestamp": "ISO 8601",
     "retryCount": 5,
     "lastHttpStatus": 500,
     "metadata": {
       "correlationId": "uuid",
       "sourceFile": "scom_events.xml",
       "processingHistory": []
     }
   }

3. Features:
   - Append-only JSON file for DLQ entries
   - DLQ rotation based on size (default: 100MB) or count (default: 10,000)
   - Archive old DLQ files with compression
   - DLQ replay mechanism (manual or scheduled)
   - Alert when DLQ size exceeds threshold

4. Implementation:
   - Create DlqService class
   - Write failed events to DLQ file (JSON lines format)
   - Implement DLQ reader for replay
   - Add DLQ cleanup/archival job
   - Expose DLQ metrics (size, count, oldest entry)

5. DLQ Operations:
   - write(event, error): Add event to DLQ
   - read(limit, offset): Read DLQ entries
   - replay(eventId): Retry specific event
   - replayAll(): Retry all DLQ events
   - clear(): Clear DLQ (with confirmation)
   - archive(): Move to archive directory

6. Monitoring & Alerts:
   - Track DLQ size (event count and disk size)
   - Alert when DLQ exceeds threshold (default: 100 events)
   - Log DLQ additions with severity WARNING
   - Daily DLQ summary report

7. Configuration:
   dlqConfig: {
     enabled: true,
     filePath: './data/dlq.jsonl',
     maxSizeMB: 100,
     maxEvents: 10000,
     rotationStrategy: 'size', // 'size' or 'count'
     retentionDays: 90,
     alertThreshold: 100
   }

Include comprehensive tests for DLQ write, read, replay, and rotation.
```

#### Prompt 3.4: Connection Pooling and Resource Management
```
Implement efficient connection pooling and resource management:

1. HTTP Connection Pooling:
   - Reuse HTTP connections to OBM (keep-alive)
   - Configure pool size (default: 10 concurrent connections)
   - Set connection timeout (default: 30 seconds)
   - Set idle timeout (default: 60 seconds)
   - Implement connection health checks

2. File Handle Management:
   - Properly close file handles after reading
   - Handle file locks for concurrent access
   - Implement file read streaming for large files
   - Clean up temporary files

3. Memory Management:
   - Stream processing for large XML files (don't load entire file)
   - Event queue size limits (default: 1000 events)
   - Periodic garbage collection hints
   - Memory usage monitoring and alerts

4. Implementation:
   - Configure HTTP client (axios) with connection pooling:
     {
       maxSockets: 10,
       maxFreeSockets: 5,
       timeout: 30000,
       keepAlive: true,
       keepAliveMsecs: 60000
     }
   
   - Create ResourceManager class for lifecycle management
   - Implement graceful shutdown (close all connections)
   - Add resource cleanup on errors

5. Resource Monitoring:
   - Track active connections
   - Monitor memory usage
   - Track file handle count
   - Alert on resource exhaustion

6. Graceful Shutdown:
   - Stop accepting new events
   - Complete in-progress events
   - Flush pending logs
   - Close all connections
   - Save state for resume
   - Maximum shutdown time: 30 seconds

Include tests for connection pooling, resource cleanup, and graceful shutdown.
```

### Phase 4: Observability

#### Prompt 4.1: Real-time Web Dashboard
```
Create real-time monitoring dashboard using React, TypeScript, and Tailwind CSS:

1. Dashboard Layout (single-page design):
   ┌─────────────────────────────────────────────────────┐
   │ Header: SCOM to OBM Integration Adapter             │
   ├─────────────────────────────────────────────────────┤
   │ Status Cards Row:                                   │
   │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
   │ │Events  │ │Success │ │Failed  │ │DLQ     │        │
   │ │Processed│ │Rate    │ │Rate    │ │Size    │        │
   │ └────────┘ └────────┘ └────────┘ └────────┘        │
   ├─────────────────────────────────────────────────────┤
   │ Event Throughput Chart (last 1 hour)               │
   ├─────────────────────────────────────────────────────┤
   │ System Health Indicators:                          │
   │ ○ File Watcher: Active                             │
   │ ○ OBM Connection: Healthy                          │
   │ ○ Circuit Breaker: CLOSED                          │
   ├─────────────────────────────────────────────────────┤
   │ Recent Events Table (last 100):                    │
   │ EventID | Title | Severity | Status | Time         │
   ├─────────────────────────────────────────────────────┤
   │ Footer: Last Updated: 2s ago | Auto-refresh ON     │
   └─────────────────────────────────────────────────────┘

2. Features:
   - Real-time updates (WebSocket or polling every 5 seconds)
   - Color-coded status indicators (green/yellow/red)
   - Interactive charts (Recharts or Chart.js)
   - Event filtering and search
   - DLQ management (view, replay, clear)
   - Configuration viewer (read-only)
   - Export metrics to CSV

3. Status Cards:
   - Events Processed: Total count with trend indicator
   - Success Rate: Percentage with green/red color
   - Failed Rate: Percentage with count
   - DLQ Size: Event count with alert indicator

4. Charts:
   - Event Throughput: Line chart (events/minute for last hour)
   - Success vs Failed: Stacked bar chart
   - Processing Latency: Histogram (p50, p95, p99)

5. Recent Events Table:
   - Event ID (clickable for details)
   - Title (truncated to 50 chars)
   - Severity (color-coded badge)
   - Status (Processing/Success/Failed)
   - Timestamp (relative time)
   - Actions (View details, Retry if failed)

6. Implementation:
   - React functional components with hooks
   - TypeScript for type safety
   - Tailwind CSS for styling
   - React Query for data fetching
   - WebSocket or SSE for real-time updates
   - Responsive design (desktop and tablet)

7. Backend API Endpoints:
   GET /api/stats - Overall statistics
   GET /api/events/recent - Last 100 events
   GET /api/health - System health status
   GET /api/dlq - DLQ entries
   POST /api/dlq/replay/:eventId - Replay event
   GET /api/config - Configuration (sanitized)

Use the existing index.html as base template with React imports.
Include comprehensive React component tests.
```

#### Prompt 4.2: Health Check and Metrics Endpoints
```
Implement comprehensive health check and metrics endpoints:

1. Health Check Endpoint:
   GET /health

   Response (Healthy):
   {
     "status": "healthy",
     "timestamp": "2025-11-09T19:37:00Z",
     "uptime": 3600,
     "version": "1.0.0",
     "components": {
       "fileWatcher": { "status": "up", "lastCheck": "2025-11-09T19:36:55Z" },
       "obmConnection": { "status": "up", "lastSuccessfulPing": "2025-11-09T19:36:50Z" },
       "database": { "status": "up", "responseTimeMs": 5 },
       "circuitBreaker": { "status": "closed" }
     }
   }

   Response (Unhealthy):
   {
     "status": "unhealthy",
     "timestamp": "2025-11-09T19:37:00Z",
     "components": {
       "obmConnection": { 
         "status": "down", 
         "error": "Connection timeout",
         "lastAttempt": "2025-11-09T19:36:55Z"
       }
     }
   }

   HTTP Status: 200 (healthy), 503 (unhealthy)

2. Metrics Endpoint:
   GET /metrics (Prometheus format)

   Metrics to expose:
   # HELP scom_obm_events_total Total events processed
   # TYPE scom_obm_events_total counter
   scom_obm_events_total{status="success"} 12500
   scom_obm_events_total{status="failed"} 25

   # HELP scom_obm_processing_duration_seconds Event processing duration
   # TYPE scom_obm_processing_duration_seconds histogram
   scom_obm_processing_duration_seconds_bucket{le="0.1"} 8500
   scom_obm_processing_duration_seconds_bucket{le="0.5"} 12000
   scom_obm_processing_duration_seconds_bucket{le="1.0"} 12480
   scom_obm_processing_duration_seconds_sum 3500.5
   scom_obm_processing_duration_seconds_count 12500

   # HELP scom_obm_api_latency_seconds OBM API call latency
   # TYPE scom_obm_api_latency_seconds histogram

   # HELP scom_obm_retry_count Total retry attempts
   # TYPE scom_obm_retry_count counter

   # HELP scom_obm_dlq_size Current DLQ size
   # TYPE scom_obm_dlq_size gauge

   # HELP scom_obm_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)
   # TYPE scom_obm_circuit_breaker_state gauge

3. Custom Metrics Endpoint:
   GET /api/metrics

   JSON Response:
   {
     "events": {
       "total": 12525,
       "success": 12500,
       "failed": 25,
       "successRate": 99.8,
       "inProgress": 0
     },
     "throughput": {
       "current": 250,        // events/hour
       "average": 235,
       "peak": 450
     },
     "latency": {
       "p50": 250,           // milliseconds
       "p95": 480,
       "p99": 750,
       "avg": 320
     },
     "dlq": {
       "size": 25,
       "oldestTimestamp": "2025-11-08T10:15:00Z"
     },
     "circuitBreaker": {
       "state": "closed",
       "failureCount": 0,
       "lastStateChange": "2025-11-09T12:00:00Z"
     },
     "uptime": {
       "seconds": 86400,
       "startTime": "2025-11-08T19:37:00Z"
     }
   }

4. Implementation:
   - Use prom-client library for Prometheus metrics
   - Create MetricsService class for metric collection
   - Implement health check logic for each component
   - Add custom health checks (OBM connectivity test)
   - Support Kubernetes liveness and readiness probes

5. Kubernetes Probes:
   Liveness: GET /health
   Readiness: GET /ready (checks if accepting events)

Include tests for health checks and metrics collection.
```

#### Prompt 4.3: Audit Logging and Event Traceability
```
Implement comprehensive audit logging for complete event traceability:

1. Audit Log Requirements:
   - Log all critical operations with full context
   - Maintain event processing history (cradle to grave)
   - Include correlation IDs for end-to-end tracking
   - Store audit logs separately from application logs
   - Support audit log export and archival

2. Audit Events to Log:
   a. System Events:
      - Application start/stop
      - Configuration changes
      - User authentication/authorization
      - Admin operations

   b. Event Processing:
      - Event received (from SCOM file)
      - Event parsed (with validation result)
      - Event transformed (SCOM → OBM)
      - Event submitted (to OBM API)
      - Event acknowledged (OBM response)
      - Event retry attempts
      - Event moved to DLQ

   c. Error Events:
      - Parse errors with event context
      - Transformation errors
      - API errors with request/response
      - Retry failures

3. Audit Log Format:
   {
     "auditId": "uuid",
     "timestamp": "2025-11-09T19:37:00.123Z",
     "eventType": "EventSubmitted",
     "correlationId": "event-uuid",
     "actor": "system",
     "action": "POST /opr-web/rest/9.10/event_list",
     "resource": "event:12345",
     "status": "success",
     "details": {
       "eventId": "12345",
       "severity": "critical",
       "httpStatus": 200,
       "processingTimeMs": 125
     },
     "metadata": {
       "sourceFile": "scom_events.xml",
       "eventTitle": "Server Down Alert",
       "sourceSystem": "SCOM",
       "targetSystem": "OBM"
     }
   }

4. Event Traceability:
   - Assign correlation ID to each event on ingestion
   - Include correlation ID in all logs related to that event
   - Enable querying audit log by correlation ID
   - Generate processing timeline for each event

5. Audit Log Operations:
   - Write audit entry (async, non-blocking)
   - Query audit logs (by correlation ID, date range, event type)
   - Export audit logs (CSV, JSON)
   - Archive old audit logs (compression, retention policy)
   - Verify audit log integrity (checksums)

6. Implementation:
   - Create AuditLoggerService class
   - Use separate log file for audit logs
   - Implement structured audit log format (JSON)
   - Add audit log rotation (daily or size-based)
   - Support external audit log storage (database, SIEM)

7. Audit Log API:
   GET /api/audit/event/:correlationId - Get processing history
   GET /api/audit/search - Search audit logs
   GET /api/audit/export - Export audit logs

8. Retention and Archival:
   - Audit logs retained for 90 days (configurable)
   - Daily audit log archival to compressed files
   - Support compliance requirements (GDPR, HIPAA, SOC2)

Include tests for audit logging and querying.
```

#### Prompt 4.4: Performance Monitoring and Alerting
```
Implement performance monitoring and proactive alerting:

1. Performance Metrics:
   a. Event Processing:
      - Throughput (events/second, events/minute, events/hour)
      - Processing latency (end-to-end time per event)
      - Queue depth (pending events)
      - Batch processing time

   b. API Performance:
      - API call latency (time to OBM response)
      - API success/failure rate
      - API timeout rate
      - Connection pool utilization

   c. System Resources:
      - CPU usage (percentage)
      - Memory usage (MB and percentage)
      - Disk I/O (read/write operations)
      - Network I/O (bytes sent/received)

   d. Error Rates:
      - Parse error rate
      - Transformation error rate
      - API error rate
      - Retry rate

2. Monitoring Windows:
   - Real-time (last 5 minutes)
   - Short-term (last 1 hour)
   - Mid-term (last 24 hours)
   - Long-term (last 7 days)

3. Alert Conditions:
   a. Performance Degradation:
      - Throughput drops below 50% of baseline
      - Processing latency exceeds 1 second (p95)
      - Queue depth exceeds 1000 events
      - API latency exceeds 5 seconds

   b. Error Thresholds:
      - Error rate exceeds 5%
      - DLQ size exceeds 100 events
      - Circuit breaker opens
      - Consecutive failures exceed 10

   c. Resource Exhaustion:
      - Memory usage exceeds 80%
      - Disk space below 10%
      - CPU usage exceeds 90% for 5 minutes

   d. System Health:
      - OBM connection lost
      - File watcher stopped
      - Log rotation failed

4. Alert Actions:
   - Log alert with severity (WARNING, ERROR, CRITICAL)
   - Emit event for external monitoring (Prometheus Alert Manager)
   - Send notification (email, webhook, Slack) - configuration
   - Update dashboard with alert banner
   - Trigger auto-remediation (optional)

5. Implementation:
   - Create MonitoringService class
   - Collect metrics at regular intervals (every 10 seconds)
   - Calculate rolling averages and percentiles
   - Evaluate alert conditions
   - Emit alerts via event emitter
   - Store metrics history for trending

6. Monitoring Dashboard Integration:
   - Display alert count on dashboard
   - Show active alerts in banner
   - Alert history table (last 24 hours)
   - Alert acknowledgement mechanism

7. Alert Configuration:
   alertConfig: {
     enabled: true,
     evaluationInterval: 60000,  // 1 minute
     rules: [
       {
         name: "HighErrorRate",
         condition: "errorRate > 0.05",
         severity: "ERROR",
         message: "Error rate exceeded 5%"
       },
       {
         name: "DLQSizeExceeded",
         condition: "dlqSize > 100",
         severity: "WARNING",
         message: "DLQ size exceeded threshold"
       }
     ],
     notifications: {
       email: { enabled: false },
       webhook: { enabled: true, url: "..." },
       slack: { enabled: false }
     }
   }

Include tests for metric collection, alert evaluation, and notification.
```

### Phase 5: Hardening

#### Prompt 5.1: Security Implementation
```
Implement enterprise security controls and hardening:

1. Authentication:
   a. OBM API Authentication:
      - Basic Auth with encrypted credentials
      - Support for API keys
      - Certificate-based authentication (mTLS)
      - Token rotation mechanism

   b. Dashboard Authentication:
      - Windows Authentication integration (NTLM/Kerberos)
      - Username/password with hashed storage (bcrypt)
      - Session management with secure cookies
      - Session timeout (30 minutes)

   c. API Authentication:
      - API key for programmatic access
      - JWT tokens for SSO integration
      - Role-based access control (Admin, Operator, Viewer)

2. Encryption:
   a. Data in Transit:
      - Enforce TLS 1.2+ for all API calls
      - Support custom CA certificates
      - Certificate pinning (optional)
      - Validate server certificates (configurable)

   b. Data at Rest:
      - Encrypt credentials in config (AES-256-GCM)
      - Encrypt sensitive log fields
      - Secure key storage (OS keyring, KMS)
      - Key rotation support

3. Access Control:
   - RBAC implementation:
     * Admin: Full access (config, DLQ replay, logs)
     * Operator: View dashboard, view logs, trigger DLQ replay
     * Viewer: View dashboard only
   - Audit all access attempts
   - IP allowlist/blocklist (optional)

4. Security Headers:
   - Content-Security-Policy
   - Strict-Transport-Security (HSTS)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block

5. Input Validation:
   - Validate all XML input (schema validation)
   - Sanitize event descriptions (prevent XSS)
   - Validate configuration inputs
   - Prevent XML External Entity (XXE) attacks
   - Prevent XML bomb attacks (entity expansion)

6. Secrets Management:
   - Never log secrets (passwords, tokens, keys)
   - Redact secrets in error messages
   - Support environment variables for secrets
   - Integration with secret managers:
     * Windows Credential Manager
     * HashiCorp Vault
     * Azure Key Vault
     * AWS Secrets Manager

7. Security Scanning:
   - Dependency vulnerability scanning (npm audit, Snyk)
   - Static code analysis (SonarQube, ESLint security rules)
   - Docker image scanning (Trivy, Clair)
   - OWASP ZAP for API security testing

8. Implementation:
   - Create SecurityService class
   - Implement credential encryption/decryption
   - Add authentication middleware
   - Implement RBAC checks
   - Add input sanitization utilities
   - Create secret redaction for logs

9. Security Configuration:
   securityConfig: {
     tls: {
       minVersion: 'TLSv1.2',
       verifyCertificate: true,
       customCA: '/path/to/ca.crt'
     },
     auth: {
       method: 'basic', // 'basic', 'apikey', 'certificate', 'windows'
       sessionTimeout: 1800,
       maxLoginAttempts: 5,
       lockoutDuration: 900
     },
     encryption: {
       algorithm: 'aes-256-gcm',
       keySource: 'file' // 'file', 'env', 'vault', 'keyring'
     }
   }

10. Compliance:
    - Generate security assessment report
    - Document security controls
    - OWASP Top 10 compliance checklist
    - CIS Benchmark alignment

Include comprehensive security tests and penetration testing scenarios.
```

#### Prompt 5.2: Performance Optimization
```
Optimize application performance for production workloads:

1. Event Processing Optimization:
   a. Streaming XML Parsing:
      - Use SAX parser instead of DOM for large files
      - Process events as stream (don't load entire file)
      - Implement backpressure handling

   b. Batch Processing:
      - Configurable batch size (default: 50)
      - Parallel batch processing (worker threads)
      - Batch compression for API calls (if OBM supports)

   c. Concurrency:
      - Worker thread pool for CPU-intensive tasks (parsing, transformation)
      - Connection pooling for API calls
      - Async/await for I/O operations
      - Event-driven architecture (non-blocking)

2. Memory Optimization:
   a. Memory Management:
      - Stream processing (avoid large objects in memory)
      - Object pooling for frequent allocations
      - Clear references after processing
      - Monitor memory leaks (heapdump analysis)

   b. Caching:
      - Cache frequently accessed configurations
      - Cache transformation rules
      - LRU cache for recent events (deduplication)
      - Clear cache periodically

3. Network Optimization:
   a. HTTP Client:
      - Connection keep-alive
      - Connection pooling (max 10 concurrent)
      - Request compression (gzip)
      - Response streaming for large payloads

   b. API Calls:
      - Batch API calls when possible
      - Reduce payload size (remove unnecessary fields)
      - Implement request deduplication

4. Database Optimization (if using database):
   - Use indexes on frequently queried fields
   - Implement connection pooling
   - Batch inserts for audit logs
   - Periodic vacuum/optimize

5. File I/O Optimization:
   - Buffered file reads/writes
   - Async file operations
   - Use SSD for log files
   - Implement file write batching

6. Code Optimization:
   - Profile hot paths (CPU profiling)
   - Optimize regular expressions
   - Reduce object allocations
   - Use efficient data structures (Map vs Object)

7. Performance Benchmarks:
   Target metrics:
   - Throughput: 10,000+ events/hour
   - Latency: p95 < 500ms, p99 < 1000ms
   - Memory: < 2GB under normal load
   - CPU: < 50% of 2 cores

8. Load Testing:
   - Use k6 or Apache JMeter
   - Simulate various load patterns:
     * Normal load: 10,000 events/hour for 24 hours
     * Burst load: 20,000 events/hour for 1 hour
     * Stress test: Ramp up until failure
     * Soak test: 7-day continuous run

9. Performance Monitoring:
   - Track event processing rate
   - Monitor memory usage trends
   - CPU usage per operation
   - I/O wait times
   - GC pause times (Node.js)

10. Optimization Checklist:
    ✅ Enable production mode (NODE_ENV=production)
    ✅ Minify and bundle code
    ✅ Enable compression middleware
    ✅ Use efficient logging (disable DEBUG in prod)
    ✅ Implement caching where appropriate
    ✅ Optimize database queries
    ✅ Use CDN for static assets (dashboard)
    ✅ Enable HTTP/2 for API

Include performance test suite and profiling results.
```

#### Prompt 5.3: Docker Containerization
```
Create production-ready Docker container for the adapter:

1. Dockerfile (Multi-stage build):
   # Build stage
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build

   # Production stage
   FROM node:18-alpine
   RUN apk add --no-cache tini
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/package.json ./
   
   # Create non-root user
   RUN addgroup -S appgroup && adduser -S appuser -G appgroup
   RUN chown -R appuser:appgroup /app
   
   # Create data directories
   RUN mkdir -p /app/data /app/logs /app/config && \
       chown -R appuser:appgroup /app/data /app/logs /app/config
   
   USER appuser
   EXPOSE 3000 9090
   
   # Use tini for proper signal handling
   ENTRYPOINT ["/sbin/tini", "--"]
   CMD ["node", "dist/index.js"]

2. Docker Compose:
   version: '3.8'
   services:
     scom-obm-adapter:
       build: .
       container_name: scom-obm-adapter
       restart: unless-stopped
       environment:
         - NODE_ENV=production
         - LOG_LEVEL=info
       volumes:
         - ./config:/app/config:ro
         - ./data:/app/data
         - ./logs:/app/logs
         - ./scom-events:/app/scom-events:ro
       ports:
         - "3000:3000"   # Dashboard
         - "9090:9090"   # Metrics
       healthcheck:
         test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
         interval: 30s
         timeout: 10s
         retries: 3
         start_period: 40s
       networks:
         - adapter-network

     # Optional: Prometheus for metrics
     prometheus:
       image: prom/prometheus:latest
       container_name: prometheus
       volumes:
         - ./prometheus.yml:/etc/prometheus/prometheus.yml
         - prometheus-data:/prometheus
       ports:
         - "9091:9090"
       networks:
         - adapter-network

     # Optional: Grafana for visualization
     grafana:
       image: grafana/grafana:latest
       container_name: grafana
       ports:
         - "3001:3000"
       environment:
         - GF_SECURITY_ADMIN_PASSWORD=admin
       volumes:
         - grafana-data:/var/lib/grafana
       networks:
         - adapter-network

   networks:
     adapter-network:
       driver: bridge

   volumes:
     prometheus-data:
     grafana-data:

3. .dockerignore:
   node_modules
   npm-debug.log
   .git
   .gitignore
   .env
   .env.local
   *.md
   tests
   coverage
   .vscode
   .idea
   dist
   logs
   data

4. Security Hardening:
   - Use minimal base image (alpine)
   - Run as non-root user
   - Use multi-stage build (smaller image)
   - Scan for vulnerabilities (docker scan)
   - Use specific image tags (not latest)
   - Implement proper signal handling (tini)
   - Read-only root filesystem (where possible)

5. Configuration:
   - Use environment variables for runtime config
   - Mount config files as volumes
   - Support config via ConfigMaps (Kubernetes)
   - Externalize secrets

6. Data Persistence:
   - Volume for logs (/app/logs)
   - Volume for data (/app/data)
   - Volume for DLQ (/app/data/dlq)
   - Volume for SCOM events (/app/scom-events)

7. Health Checks:
   - Liveness probe: /health
   - Readiness probe: /ready
   - Startup probe: /health (longer timeout)

8. Resource Limits (Kubernetes):
   resources:
     requests:
       memory: "512Mi"
       cpu: "500m"
     limits:
       memory: "2Gi"
       cpu: "2000m"

9. Logging:
   - Log to stdout/stderr (Docker best practice)
   - JSON log format for parsing
   - Use logging driver (json-file, syslog)
   - Configure log rotation

10. Build and Push:
    # Build
    docker build -t scom-obm-adapter:1.0.0 .
    
    # Tag
    docker tag scom-obm-adapter:1.0.0 myregistry/scom-obm-adapter:1.0.0
    docker tag scom-obm-adapter:1.0.0 myregistry/scom-obm-adapter:latest
    
    # Push
    docker push myregistry/scom-obm-adapter:1.0.0
    docker push myregistry/scom-obm-adapter:latest

Include Docker build test and container security scanning.
```

#### Prompt 5.4: Kubernetes Deployment
```
Create Kubernetes manifests for production deployment:

1. Deployment (deployment.yaml):
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: scom-obm-adapter
     namespace: monitoring
     labels:
       app: scom-obm-adapter
       version: v1.0.0
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: scom-obm-adapter
     strategy:
       type: RollingUpdate
       rollingUpdate:
         maxSurge: 1
         maxUnavailable: 0
     template:
       metadata:
         labels:
           app: scom-obm-adapter
           version: v1.0.0
         annotations:
           prometheus.io/scrape: "true"
           prometheus.io/port: "9090"
           prometheus.io/path: "/metrics"
       spec:
         serviceAccountName: scom-obm-adapter
         securityContext:
           runAsNonRoot: true
           runAsUser: 1000
           fsGroup: 1000
         containers:
         - name: adapter
           image: myregistry/scom-obm-adapter:1.0.0
           imagePullPolicy: IfNotPresent
           ports:
           - containerPort: 3000
             name: http
             protocol: TCP
           - containerPort: 9090
             name: metrics
             protocol: TCP
           env:
           - name: NODE_ENV
             value: "production"
           - name: LOG_LEVEL
             value: "info"
           - name: OBM_API_URL
             valueFrom:
               configMapKeyRef:
                 name: adapter-config
                 key: obm.api.url
           - name: OBM_USERNAME
             valueFrom:
               secretKeyRef:
                 name: obm-credentials
                 key: username
           - name: OBM_PASSWORD
             valueFrom:
               secretKeyRef:
                 name: obm-credentials
                 key: password
           resources:
             requests:
               memory: "512Mi"
               cpu: "500m"
             limits:
               memory: "2Gi"
               cpu: "2000m"
           volumeMounts:
           - name: config
             mountPath: /app/config
             readOnly: true
           - name: data
             mountPath: /app/data
           - name: logs
             mountPath: /app/logs
           - name: scom-events
             mountPath: /app/scom-events
             readOnly: true
           livenessProbe:
             httpGet:
               path: /health
               port: 3000
             initialDelaySeconds: 30
             periodSeconds: 30
             timeoutSeconds: 5
             failureThreshold: 3
           readinessProbe:
             httpGet:
               path: /ready
               port: 3000
             initialDelaySeconds: 10
             periodSeconds: 10
             timeoutSeconds: 5
             failureThreshold: 3
           startupProbe:
             httpGet:
               path: /health
               port: 3000
             initialDelaySeconds: 10
             periodSeconds: 10
             timeoutSeconds: 5
             failureThreshold: 30
         volumes:
         - name: config
           configMap:
             name: adapter-config
         - name: data
           persistentVolumeClaim:
             claimName: adapter-data
         - name: logs
           emptyDir: {}
         - name: scom-events
           nfs:
             server: scom-server.example.com
             path: /scom/events

2. Service (service.yaml):
   apiVersion: v1
   kind: Service
   metadata:
     name: scom-obm-adapter
     namespace: monitoring
     labels:
       app: scom-obm-adapter
   spec:
     type: ClusterIP
     ports:
     - port: 3000
       targetPort: 3000
       protocol: TCP
       name: http
     - port: 9090
       targetPort: 9090
       protocol: TCP
       name: metrics
     selector:
       app: scom-obm-adapter

3. ConfigMap (configmap.yaml):
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: adapter-config
     namespace: monitoring
   data:
     obm.api.url: "https://obm.example.com/opr-web/rest/9.10/event_list"
     scom.xml.path: "/app/scom-events/scom_events.xml"
     processing.batch.size: "50"
     processing.delay.ms: "500"
     retry.max.attempts: "5"
     dlq.enabled: "true"
     log.level: "info"

4. Secret (secret.yaml):
   apiVersion: v1
   kind: Secret
   metadata:
     name: obm-credentials
     namespace: monitoring
   type: Opaque
   data:
     username: <base64-encoded-username>
     password: <base64-encoded-password>

5. PersistentVolumeClaim (pvc.yaml):
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: adapter-data
     namespace: monitoring
   spec:
     accessModes:
     - ReadWriteOnce
     resources:
       requests:
         storage: 10Gi
     storageClassName: standard

6. ServiceAccount (serviceaccount.yaml):
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: scom-obm-adapter
     namespace: monitoring

7. HorizontalPodAutoscaler (hpa.yaml):
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: scom-obm-adapter
     namespace: monitoring
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: scom-obm-adapter
     minReplicas: 2
     maxReplicas: 5
     metrics:
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: 70
     - type: Resource
       resource:
         name: memory
         target:
           type: Utilization
           averageUtilization: 80

8. NetworkPolicy (networkpolicy.yaml):
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: scom-obm-adapter
     namespace: monitoring
   spec:
     podSelector:
       matchLabels:
         app: scom-obm-adapter
     policyTypes:
     - Ingress
     - Egress
     ingress:
     - from:
       - namespaceSelector:
           matchLabels:
             name: monitoring
       ports:
       - protocol: TCP
         port: 3000
       - protocol: TCP
         port: 9090
     egress:
     - to:
       - namespaceSelector: {}
       ports:
       - protocol: TCP
         port: 443  # OBM API
     - to:
       - namespaceSelector: {}
       ports:
       - protocol: TCP
         port: 53   # DNS
       - protocol: UDP
         port: 53

9. Deployment Commands:
   # Create namespace
   kubectl create namespace monitoring
   
   # Apply manifests
   kubectl apply -f secret.yaml
   kubectl apply -f configmap.yaml
   kubectl apply -f pvc.yaml
   kubectl apply -f serviceaccount.yaml
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   kubectl apply -f hpa.yaml
   kubectl apply -f networkpolicy.yaml
   
   # Verify deployment
   kubectl get pods -n monitoring
   kubectl logs -f deployment/scom-obm-adapter -n monitoring
   kubectl get svc -n monitoring

Include Helm chart for easier deployment and Kustomize overlays for environments.
```

### Phase 6: Testing & Documentation

#### Prompt 6.1: Comprehensive Test Suite
```
Create comprehensive test suite covering all aspects:

1. Unit Tests (80%+ coverage):
   
   a. Configuration Tests:
      - Load valid configuration
      - Reject invalid configuration
      - Environment variable overrides
      - Default values
      - Configuration validation

   b. Event Parsing Tests:
      - Parse valid XML events
      - Handle malformed XML
      - Extract all fields correctly
      - Handle missing fields with defaults
      - Handle multiple events per file
      - Handle large files (streaming)

   c. Event Transformation Tests:
      - Severity mapping (all combinations)
      - DateTime formatting (various formats)
      - Description truncation
      - Field mapping accuracy
      - Custom attribute preservation

   d. Retry Logic Tests:
      - Exponential backoff calculation
      - Jitter randomness
      - Max retry enforcement
      - Retry on correct conditions
      - No retry on client errors

   e. Circuit Breaker Tests:
      - State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
      - Failure threshold triggering
      - Success threshold in half-open
      - Timeout reset

   f. DLQ Tests:
      - Write to DLQ
      - Read from DLQ
      - Replay events
      - Rotation on size/count
      - Archive old entries

2. Integration Tests:
   
   a. File Watcher Integration:
      - Detect new files
      - Detect modified files
      - Handle concurrent files
      - Handle locked files

   b. API Client Integration (Mock Server):
      - Successful event submission
      - Handle HTTP errors (4xx, 5xx)
      - Handle network errors
      - Handle timeouts
      - Retry on transient failures
      - Circuit breaker integration

   c. End-to-End Processing:
      - XML file → Parse → Transform → Submit → Audit
      - Error handling at each stage
      - DLQ on max retries
      - Metrics collection

3. System Integration Tests (Real Environment):
   
   a. SCOM Integration:
      - Process real SCOM XML files
      - Handle all SCOM event types
      - Validate event completeness

   b. OBM Integration:
      - Submit to real OBM instance
      - Verify events in OBM console
      - Test authentication methods
      - Test SSL/TLS configurations

4. Performance Tests:
   
   a. Load Tests (k6):
      - Normal load: 10,000 events/hour for 24 hours
      - Burst load: 20,000 events/hour for 1 hour
      - Validate latency (p95 < 500ms)
      - Validate throughput

   b. Stress Tests:
      - Ramp up load until failure
      - Identify bottlenecks
      - Measure max capacity

   c. Soak Tests:
      - Run for 7 days continuous
      - Monitor for memory leaks
      - Monitor for performance degradation

5. Security Tests:
   
   a. Vulnerability Scanning:
      - npm audit for dependencies
      - Snyk or Trivy for container scanning
      - OWASP ZAP for API testing

   b. Penetration Testing:
      - SQL injection (if using database)
      - XSS in dashboard
      - XXE in XML parsing
      - Authentication bypass
      - Authorization checks

6. Reliability Tests:
   
   a. Chaos Engineering:
      - Kill OBM connection (verify retry and DLQ)
      - Corrupt XML files (verify error handling)
      - Fill disk (verify graceful degradation)
      - High CPU/memory (verify resource limits)

   b. Recovery Tests:
      - Restart after crash (verify state recovery)
      - Configuration reload (verify hot reload)
      - Network partition (verify eventual consistency)

7. Test Implementation:
   
   # Unit Test Example (Jest)
   describe('EventTransformerService', () => {
     it('should map SCOM Critical severity to OBM critical', () => {
       const transformer = new EventTransformerService();
       const scomEvent = { severity: 'Critical', ... };
       const obmEvent = transformer.transform(scomEvent);
       expect(obmEvent.event.severity).toBe('critical');
     });
   });

   # Integration Test Example
   describe('API Client Integration', () => {
     it('should submit event to OBM successfully', async () => {
       const mockServer = setupMockObmServer();
       const apiClient = new ObmApiClient(config);
       const result = await apiClient.postEvent(obmEvent);
       expect(result.statusCode).toBe(200);
     });
   });

   # Performance Test Example (k6)
   import http from 'k6/http';
   export let options = {
     stages: [
       { duration: '10m', target: 100 },  // Ramp up
       { duration: '30m', target: 100 },  // Stay at peak
       { duration: '10m', target: 0 },    // Ramp down
     ],
     thresholds: {
       http_req_duration: ['p(95)<500'],
     },
   };

8. CI/CD Integration:
   - Run unit tests on every commit
   - Run integration tests on pull requests
   - Run full test suite on main branch
   - Generate code coverage reports
   - Block merge if tests fail or coverage < 80%

Include comprehensive test data sets and test documentation.
```

#### Prompt 6.2: Documentation Suite
```
Create comprehensive documentation for the SCOM to OBM adapter:

1. README.md:
   # SCOM to OBM Event Integration Adapter
   
   ## Overview
   Enterprise-grade adapter for real-time event synchronization between Microsoft SCOM and OpenText OBM.
   
   ## Features
   - Real-time event processing
   - Automatic retry with exponential backoff
   - Dead Letter Queue for failed events
   - Real-time monitoring dashboard
   - Prometheus metrics integration
   - Comprehensive audit logging
   - Docker and Kubernetes support
   
   ## Quick Start
   ### Prerequisites
   - Node.js 18+ / .NET 8.0 / Python 3.9+
   - Access to SCOM XML event export
   - OBM REST API endpoint
   
   ### Installation
   ```bash
   # npm
   npm install -g scom-obm-adapter
   
   # Docker
   docker pull myregistry/scom-obm-adapter:latest
   ```
   
   ### Configuration
   Copy config/config.template.json to config/config.json and update with your settings.
   
   ### Running
   ```bash
   # npm
   scom-obm-adapter start
   
   # Docker
   docker-compose up -d
   
   # Kubernetes
   kubectl apply -f k8s/
   ```
   
   ### Accessing Dashboard
   Open http://localhost:3000
   
   ## Documentation
   - [Installation Guide](docs/installation.md)
   - [Configuration Reference](docs/configuration.md)
   - [Operations Manual](docs/operations.md)
   - [Troubleshooting Guide](docs/troubleshooting.md)
   - [API Documentation](docs/api.md)
   - [Architecture Overview](docs/architecture.md)

2. Installation Guide (docs/installation.md):
   # Installation Guide
   
   ## System Requirements
   ### Hardware
   - CPU: 2 cores minimum, 4 cores recommended
   - Memory: 2GB minimum, 4GB recommended
   - Disk: 10GB minimum for logs and DLQ
   - Network: 100 Mbps minimum bandwidth
   
   ### Software
   - OS: Windows Server 2016+ / RHEL 7+ / Ubuntu 18.04+
   - Runtime: Node.js 18+ / .NET 8.0 / Python 3.9+
   - SCOM: 2016, 2019, 2022, 2025
   - OBM: 9.10, 10.x, 2020.x, 2023.x, 2024.x
   
   ## Installation Methods
   ### Method 1: NPM Package
   ### Method 2: Docker Container
   ### Method 3: Kubernetes Deployment
   ### Method 4: Manual Installation
   
   ## Post-Installation Steps
   - Configure SCOM event export
   - Verify OBM connectivity
   - Set up monitoring
   - Configure log rotation

3. Configuration Reference (docs/configuration.md):
   # Configuration Reference
   
   ## Configuration File Structure
   ## OBM Connection Settings
   ## SCOM Event Source Settings
   ## Processing Configuration
   ## Retry and Resilience Settings
   ## Logging Configuration
   ## Security Settings
   ## Performance Tuning
   ## Environment Variables
   ## Configuration Examples

4. Operations Manual (docs/operations.md):
   # Operations Manual
   
   ## Starting and Stopping
   ## Monitoring and Alerting
   ## Health Checks
   ## Log Management
   ## DLQ Management
   ## Performance Tuning
   ## Backup and Recovery
   ## Upgrade Procedures
   ## Scaling Guidelines
   ## Disaster Recovery

5. Troubleshooting Guide (docs/troubleshooting.md):
   # Troubleshooting Guide
   
   ## Common Issues
   ### Events Not Being Processed
   - Check file watcher status
   - Verify XML file permissions
   - Check logs for parse errors
   
   ### Events Failing to Submit to OBM
   - Verify OBM connectivity (ping, telnet)
   - Check OBM credentials
   - Verify OBM API endpoint URL
   - Check SSL/TLS configuration
   - Review OBM logs
   
   ### High Memory Usage
   ### High CPU Usage
   ### DLQ Growing Rapidly
   ### Circuit Breaker Stuck Open
   
   ## Diagnostic Commands
   ## Log Analysis
   ## Performance Debugging
   ## Getting Support

6. API Documentation (docs/api.md):
   # API Documentation
   
   ## REST API Endpoints
   ### Health Check: GET /health
   ### Metrics: GET /metrics
   ### Statistics: GET /api/stats
   ### Recent Events: GET /api/events/recent
   ### DLQ Management: GET /api/dlq, POST /api/dlq/replay/:id
   ### Configuration: GET /api/config
   ### Audit Logs: GET /api/audit/event/:correlationId
   
   ## WebSocket Events (for dashboard)
   ## Authentication
   ## Rate Limiting
   ## Error Responses

7. Architecture Overview (docs/architecture.md):
   # Architecture Overview
   
   ## High-Level Architecture Diagram
   ## Component Descriptions
   ## Data Flow Diagrams
   ## Event Processing Pipeline
   ## Error Handling Flow
   ## Security Architecture
   ## Deployment Architectures
   ## Scalability Considerations

8. Developer Guide (docs/developer.md):
   # Developer Guide
   
   ## Development Setup
   ## Code Structure
   ## Adding New Features
   ## Testing Guidelines
   ## Code Style Guide
   ## Contributing Guidelines
   ## Release Process

9. Security Guide (docs/security.md):
   # Security Guide
   
   ## Authentication and Authorization
   ## Encryption
   ## Credential Management
   ## Network Security
   ## Compliance Considerations
   ## Security Best Practices
   ## Security Audit Checklist

10. Release Notes (CHANGELOG.md):
    # Changelog
    
    ## [1.0.0] - 2026-Q1
    ### Added
    - Initial release
    - Real-time event processing
    - Retry logic with exponential backoff
    - Dead Letter Queue
    - Monitoring dashboard
    - Prometheus metrics
    - Docker and Kubernetes support
    
    ### Known Issues
    - None

Include diagrams (architecture, flow charts, sequence diagrams) using Mermaid or PlantUML.
```

---

## Testing Workflow

### Pre-Development Testing
1. Review existing PowerShell script functionality
2. Extract test cases from PowerShell script behavior
3. Create sample SCOM XML event files (valid and edge cases)
4. Set up mock OBM server for testing

### Development Testing (Per Phase)
1. Write tests BEFORE implementing features (TDD approach)
2. Run unit tests on every code change
3. Achieve 80%+ code coverage before moving to next feature
4. Run integration tests after component completion
5. Peer code review with test validation

### Integration Testing
1. Set up test environment with SCOM/OBM simulators
2. Run end-to-end tests with sample events
3. Validate event transformation accuracy
4. Verify error handling and retry logic
5. Test DLQ functionality

### Performance Testing
1. Baseline performance with PowerShell script
2. Run load tests (10,000 events/hour)
3. Run stress tests (increasing load until failure)
4. Run soak tests (7-day continuous)
5. Compare performance metrics vs baseline

### Security Testing
1. Dependency vulnerability scanning
2. Static code analysis
3. Docker image scanning
4. API penetration testing
5. Credential exposure checks

### User Acceptance Testing (UAT)
1. Deploy to pre-production environment
2. Process real SCOM events
3. Validate events in OBM console
4. User testing (ITOM engineers)
5. Collect feedback and iterate

---

## Quality Gates

### Phase Completion Criteria

#### Phase 1: Foundation
- ✅ Project structure created
- ✅ Configuration system working
- ✅ Logging framework functional
- ✅ Data models defined and validated
- ✅ Unit tests passing (>80% coverage)
- ✅ Code review completed

#### Phase 2: Integration
- ✅ File watcher detecting events
- ✅ XML parsing working correctly
- ✅ Event transformation accurate
- ✅ API client submitting to OBM
- ✅ End-to-end processing functional
- ✅ Integration tests passing

#### Phase 3: Resilience
- ✅ Retry logic working with backoff
- ✅ Circuit breaker state transitions correct
- ✅ DLQ storing and replaying events
- ✅ Connection pooling optimized
- ✅ Graceful shutdown implemented
- ✅ Reliability tests passing

#### Phase 4: Observability
- ✅ Dashboard displaying real-time data
- ✅ Health check endpoint responsive
- ✅ Metrics exposed for Prometheus
- ✅ Audit logging comprehensive
- ✅ Performance monitoring active
- ✅ Dashboard tests passing

#### Phase 5: Hardening
- ✅ Security controls implemented
- ✅ Performance optimized (meets benchmarks)
- ✅ Docker container built and tested
- ✅ Kubernetes manifests working
- ✅ Security scan passed (zero high-severity)
- ✅ Load tests passing

#### Phase 6: Testing & Documentation
- ✅ All test suites passing
- ✅ Code coverage >80%
- ✅ Security audit completed
- ✅ All documentation complete
- ✅ UAT sign-off received
- ✅ Production readiness checklist complete

### Release Criteria (Final)
- ✅ All P0 requirements implemented
- ✅ All critical bugs resolved
- ✅ Performance benchmarks met
- ✅ Security review passed
- ✅ Documentation complete and reviewed
- ✅ Deployment guides tested
- ✅ Support process defined
- ✅ Training materials created
- ✅ Stakeholder approval received

---

## Deployment Workflow

### Pre-Deployment Checklist
- ✅ All tests passing
- ✅ Security scan clean
- ✅ Documentation complete
- ✅ Backup plan ready
- ✅ Rollback procedure documented
- ✅ Monitoring configured
- ✅ Support team briefed

### Deployment Phases

#### Phase 1: Pilot Deployment (Week 1)
- Deploy to 1-2 pilot customers
- Close monitoring (24x7 for first week)
- Gather feedback
- Fix critical issues
- Validate performance

#### Phase 2: Limited Release (Week 2-3)
- Deploy to 5-10 customers
- Monitor stability
- Validate scalability
- Refine documentation based on feedback
- Address P1 bugs

#### Phase 3: General Availability (Week 4+)
- Public release announcement
- Full support enabled
- Marketing materials published
- Training sessions scheduled
- Continuous monitoring

### Post-Deployment
- Monitor metrics dashboard
- Review DLQ daily
- Analyze performance trends
- Collect user feedback
- Plan feature enhancements
- Regular maintenance updates

---

## Success Metrics

### Technical Metrics
- Event processing rate: 10,000+ events/hour
- Event delivery success rate: ≥99.9%
- Average latency: <500ms (p95)
- System uptime: ≥99.95%
- DLQ size: <100 events
- Test coverage: >80%

### Operational Metrics
- Deployment time: <15 minutes
- Upgrade time: <5 minutes
- MTTR (Mean Time To Resolution): <1 hour for P0 issues
- Support ticket rate: <5% of deployments
- Customer satisfaction: >4.5/5

### Business Metrics
- Adoption: 10+ enterprise deployments in 90 days
- Manual effort reduction: >95%
- Incident detection time: Reduced by >50%
- TCO reduction: >30% vs custom scripts

---

## Appendix: Cursor AI Tips

### Effective Prompt Writing
1. **Be Specific**: Reference existing code/scripts when available
2. **Provide Context**: Include business requirements and constraints
3. **Request Tests**: Always ask for unit tests with implementation
4. **Iterate**: Start simple, add complexity in follow-up prompts
5. **Code Quality**: Explicitly request SOLID principles, error handling, documentation

### Managing Complex Projects
1. **Break Down**: Split large features into smaller prompts
2. **Sequential**: Complete one phase before moving to next
3. **Review**: Ask Cursor to review generated code for issues
4. **Refactor**: Request refactoring for better design
5. **Document**: Generate documentation as you go

### Debugging with Cursor
1. **Explain Errors**: Paste error messages for debugging help
2. **Code Review**: Ask Cursor to review for bugs
3. **Performance**: Request optimization suggestions
4. **Security**: Ask for security vulnerability analysis

### Useful Cursor Commands
- "Implement [feature] following [pattern]"
- "Add comprehensive unit tests for [component]"
- "Refactor [code] to improve [aspect]"
- "Review this code for [security/performance/bugs]"
- "Generate documentation for [component]"
- "Optimize [code] for better performance"

---

**End of Cursor AI Development Workflow**
