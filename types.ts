export type CircuitState = 'closed' | 'half-open' | 'open';

export interface StatsResponse {
  total: number;
  success: number;
  failed: number;
  retries: number;
  lastError?: string;
  successRate: number;
  failureRate: number;
  circuitBreaker: CircuitState;
}

export interface RecentEvent {
  eventId: string;
  title: string;
  severity: string;
  status: 'success' | 'failed';
  timestamp: string;
  correlationId: string;
  details?: Record<string, unknown>;
}

export interface DlqRecord {
  eventId: string;
  correlationId: string;
  failureReason: string;
  failureTimestamp: string;
  retryCount: number;
  lastHttpStatus?: number;
  metadata?: Record<string, unknown>;
}

export interface AlertEvent {
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  triggeredAt: string;
  context?: Record<string, unknown>;
}

export interface HealthComponent {
  status: string;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
  components: Record<string, HealthComponent>;
}

export interface TrendPoint {
  timestamp: number;
  value: number;
}

type AuthMethod = 'basic' | 'apikey' | 'certificate';

export interface DashboardConfigAuth {
  method: AuthMethod;
  username?: string;
  credentialAlias?: string;
  tokenEndpoint?: string;
  audience?: string;
  hasPassword: boolean;
  hasApiKey: boolean;
}

export interface DashboardTlsConfig {
  verify: boolean;
  minVersion: 'TLSv1.2' | 'TLSv1.3';
  caFilePath?: string;
  certFilePath?: string;
  keyFilePath?: string;
  allowSelfSigned?: boolean;
}

export interface DashboardObmConfig {
  baseUrl: string;
  eventEndpoint: string;
  auth: DashboardConfigAuth;
  tls: DashboardTlsConfig;
  rateLimitMs: number;
  connectionTimeoutMs: number;
  readTimeoutMs: number;
  keepAlive: boolean;
  maxSockets: number;
}

export interface DashboardScomConfig {
  xmlDirectory: string;
  filePattern: string;
  pollingIntervalMs: number;
  encoding: string;
  concurrentParsers: number;
  schemaPath?: string;
  maxFileSizeMb: number;
}

export interface DashboardProcessingConfig {
  batchSize: number;
  batchTimeoutMs: number;
  maxConcurrentBatches: number;
  queueCapacity: number;
  rateLimitMs: number;
  maxEventsPerFile: number;
}

export interface DashboardRetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
  budgetPerMinute: number;
}

export interface DashboardCircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  halfOpenMaxCalls: number;
}

export interface DashboardDlqConfig {
  enabled: boolean;
  directory: string;
  fileName: string;
  maxFileSizeMb: number;
  maxEvents: number;
  rotationStrategy: 'size' | 'count' | 'daily';
  retentionDays: number;
  alertThreshold: number;
}

export interface DashboardSecurityConfig {
  credentialStore?: 'windows' | 'file' | 'env';
  credentialStoreNamespace?: string;
  redactFields: string[];
  hasEncryptionKey: boolean;
}

export interface DashboardMonitoringRule {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

export interface DashboardMonitoringConfig {
  alertEvaluationIntervalMs: number;
  alertRules: DashboardMonitoringRule[];
}

export interface AdapterConfigViewModel {
  environment: string;
  obm: DashboardObmConfig;
  scom: DashboardScomConfig;
  processing: DashboardProcessingConfig;
  retry: DashboardRetryConfig;
  circuitBreaker: DashboardCircuitBreakerConfig;
  dlq: DashboardDlqConfig;
  logging: {
    level: string;
    prettyPrint: boolean;
    directory: string;
    maxSizeMb: number;
    maxFiles: number;
    includeRequestId: boolean;
    redact: string[];
  };
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
    defaultLabels: Record<string, string>;
  };
  dashboard: {
    enabled: boolean;
    port: number;
    host: string;
    corsOrigins: string[];
    sessionTimeoutMinutes: number;
  };
  audit: {
    directory: string;
    retentionDays: number;
    maxFileSizeMb: number;
    exportDirectory: string;
  };
  security: DashboardSecurityConfig;
  monitoring: DashboardMonitoringConfig;
}

export interface AdapterConfigUpdateRequest {
  obm?: {
    baseUrl?: string;
    eventEndpoint?: string;
    auth?: {
      method?: AuthMethod;
      username?: string;
      credentialAlias?: string;
    };
    tls?: {
      allowSelfSigned?: boolean;
      minVersion?: 'TLSv1.2' | 'TLSv1.3';
    };
  };
  scom?: {
    xmlDirectory?: string;
    filePattern?: string;
    pollingIntervalMs?: number;
    maxFileSizeMb?: number;
  };
}

export interface AdapterConfigUpdateResponse extends AdapterConfigViewModel {
  meta: {
    requiresRestart: boolean;
    changedKeys: string[];
  };
}

export interface AdapterSecretUpdateRequest {
  obm?: {
    password?: string;
    apiKey?: string;
  };
}

export interface AdapterSecretUpdateResponse {
  updated: string[];
  message: string;
}



