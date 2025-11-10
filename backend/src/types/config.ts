export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface ObmAuthConfig {
  method: 'basic' | 'apikey' | 'certificate';
  username?: string;
  password?: string;
  apiKey?: string;
  credentialAlias?: string;
  tokenEndpoint?: string;
  audience?: string;
}

export interface ObmTlsConfig {
  verify: boolean;
  minVersion: 'TLSv1.2' | 'TLSv1.3';
  caFilePath?: string;
  certFilePath?: string;
  keyFilePath?: string;
  allowSelfSigned?: boolean;
}

export interface ObmConfig {
  baseUrl: string;
  eventEndpoint: string;
  auth: ObmAuthConfig;
  tls: ObmTlsConfig;
  rateLimitMs: number;
  connectionTimeoutMs: number;
  readTimeoutMs: number;
  keepAlive: boolean;
  maxSockets: number;
}

export interface ScomSourceConfig {
  xmlDirectory: string;
  filePattern: string;
  pollingIntervalMs: number;
  encoding: BufferEncoding;
  concurrentParsers: number;
  schemaPath?: string;
  maxFileSizeMb: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
  budgetPerMinute: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  halfOpenMaxCalls: number;
}

export interface DlqConfig {
  enabled: boolean;
  directory: string;
  fileName: string;
  maxFileSizeMb: number;
  maxEvents: number;
  rotationStrategy: 'size' | 'count' | 'daily';
  retentionDays: number;
  alertThreshold: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint: boolean;
  directory: string;
  maxSizeMb: number;
  maxFiles: number;
  includeRequestId: boolean;
  redact: string[];
}

export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
  defaultLabels: Record<string, string>;
}

export interface DashboardConfig {
  enabled: boolean;
  port: number;
  host: string;
  corsOrigins: string[];
  sessionTimeoutMinutes: number;
}

export interface AuditConfig {
  directory: string;
  retentionDays: number;
  maxFileSizeMb: number;
  exportDirectory: string;
}

export interface SecurityConfig {
  encryptionKey?: string;
  credentialStore?: 'windows' | 'file' | 'env';
  credentialStoreNamespace?: string;
  redactFields: string[];
}

export interface ProcessingConfig {
  batchSize: number;
  batchTimeoutMs: number;
  maxConcurrentBatches: number;
  queueCapacity: number;
  rateLimitMs: number;
  maxEventsPerFile: number;
}

export interface MonitoringConfig {
  alertEvaluationIntervalMs: number;
  alertRules: Array<{
    name: string;
    condition: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
  }>;
  notifications: {
    email?: {
      enabled: boolean;
      to: string[];
    };
    webhook?: {
      enabled: boolean;
      url?: string;
    };
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
    };
  };
}

export interface AdapterConfig {
  environment: Environment;
  obm: ObmConfig;
  scom: ScomSourceConfig;
  processing: ProcessingConfig;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  dlq: DlqConfig;
  logging: LoggingConfig;
  metrics: MetricsConfig;
  dashboard: DashboardConfig;
  audit: AuditConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

