import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import YAML from 'yaml';
import { z } from 'zod';

import type { AdapterConfig } from '@/types/config';

const envEnum = z.enum(['development', 'test', 'staging', 'production']);

const obmConfigSchema = z.object({
  baseUrl: z.string().url(),
  eventEndpoint: z.string().min(1),
  auth: z.object({
    method: z.enum(['basic', 'apikey', 'certificate']).default('basic'),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    credentialAlias: z.string().optional(),
    tokenEndpoint: z.string().url().optional(),
    audience: z.string().optional(),
  }),
  tls: z.object({
    verify: z.boolean().default(true),
    minVersion: z.enum(['TLSv1.2', 'TLSv1.3']).default('TLSv1.2'),
    caFilePath: z.string().optional(),
    certFilePath: z.string().optional(),
    keyFilePath: z.string().optional(),
    allowSelfSigned: z.boolean().default(false),
  }),
  rateLimitMs: z.number().int().nonnegative().default(500),
  connectionTimeoutMs: z.number().int().positive().default(30000),
  readTimeoutMs: z.number().int().positive().default(60000),
  keepAlive: z.boolean().default(true),
  maxSockets: z.number().int().positive().default(10),
});

const scomConfigSchema = z.object({
  xmlDirectory: z.string().min(1),
  filePattern: z.string().default('*.xml'),
  pollingIntervalMs: z.number().int().positive().default(30000),
  encoding: z
    .enum([
      'utf8',
      'utf16le',
      'latin1',
      'ascii',
      'ucs2',
      'base64',
      'hex',
    ])
    .default('utf8'),
  concurrentParsers: z.number().int().positive().default(2),
  schemaPath: z.string().optional(),
  maxFileSizeMb: z.number().int().positive().default(100),
});

const retryConfigSchema = z.object({
  maxAttempts: z.number().int().positive().default(5),
  initialDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(16000),
  backoffMultiplier: z.number().positive().default(2),
  jitterFactor: z.number().min(0).max(1).default(0.2),
  retryableStatusCodes: z.array(z.number().int()).default([429, 500, 502, 503, 504]),
  retryableErrors: z.array(z.string()).default(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']),
  budgetPerMinute: z.number().int().positive().default(500),
});

const circuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().positive().default(10),
  successThreshold: z.number().int().positive().default(3),
  timeoutMs: z.number().int().positive().default(60000),
  volumeThreshold: z.number().int().positive().default(20),
  errorThresholdPercentage: z.number().min(0).max(100).default(50),
  halfOpenMaxCalls: z.number().int().positive().default(5),
});

const dlqConfigSchema = z.object({
  enabled: z.boolean().default(true),
  directory: z.string().default('./data/dlq'),
  fileName: z.string().default('dlq.jsonl'),
  maxFileSizeMb: z.number().int().positive().default(100),
  maxEvents: z.number().int().positive().default(10000),
  rotationStrategy: z.enum(['size', 'count', 'daily']).default('size'),
  retentionDays: z.number().int().positive().default(90),
  alertThreshold: z.number().int().positive().default(100),
});

const loggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  prettyPrint: z.boolean().default(false),
  directory: z.string().default('./logs'),
  maxSizeMb: z.number().int().positive().default(100),
  maxFiles: z.number().int().positive().default(7),
  includeRequestId: z.boolean().default(true),
  redact: z.array(z.string()).default(['password', 'token', 'apiKey']),
});

const metricsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().int().positive().default(9090),
  path: z.string().default('/metrics'),
  defaultLabels: z.record(z.string(), z.string()).default({ service: 'scom-obm-adapter' }),
});

const dashboardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().int().positive().default(3000),
  host: z.string().default('0.0.0.0'),
  corsOrigins: z.array(z.string()).default(['*']),
  sessionTimeoutMinutes: z.number().int().positive().default(30),
});

const auditConfigSchema = z.object({
  directory: z.string().default('./logs/audit'),
  retentionDays: z.number().int().positive().default(90),
  maxFileSizeMb: z.number().int().positive().default(100),
  exportDirectory: z.string().default('./logs/audit/exports'),
});

const securityConfigSchema = z.object({
  encryptionKey: z.string().optional(),
  credentialStore: z.enum(['windows', 'file', 'env']).default('file'),
  credentialStoreNamespace: z.string().optional(),
  redactFields: z.string().array().default(['password', 'apiKey', 'token']),
});

const processingConfigSchema = z.object({
  batchSize: z.number().int().positive().default(50),
  batchTimeoutMs: z.number().int().positive().default(10000),
  maxConcurrentBatches: z.number().int().positive().default(4),
  queueCapacity: z.number().int().positive().default(1000),
  rateLimitMs: z.number().int().nonnegative().default(500),
  maxEventsPerFile: z.number().int().positive().default(10000),
});

const monitoringConfigSchema = z.object({
  alertEvaluationIntervalMs: z.number().int().positive().default(60000),
  alertRules: z.array(
    z.object({
      name: z.string(),
      condition: z.string(),
      severity: z.enum(['info', 'warning', 'error', 'critical']),
      message: z.string(),
    })
  ).default([]),
  notifications: z.object({
    email: z
      .object({
        enabled: z.boolean(),
        to: z.array(z.string()),
      })
      .default({ enabled: false, to: [] }),
    webhook: z
      .object({
        enabled: z.boolean(),
        url: z.string().url().optional(),
      })
      .default({ enabled: false }),
    slack: z
      .object({
        enabled: z.boolean(),
        webhookUrl: z.string().url().optional(),
        channel: z.string().optional(),
      })
      .default({ enabled: false }),
  }),
});

export const adapterConfigSchema = z.object({
  environment: envEnum.default('development'),
  obm: obmConfigSchema,
  scom: scomConfigSchema,
  processing: processingConfigSchema,
  retry: retryConfigSchema,
  circuitBreaker: circuitBreakerConfigSchema,
  dlq: dlqConfigSchema,
  logging: loggingConfigSchema,
  metrics: metricsConfigSchema,
  dashboard: dashboardConfigSchema,
  audit: auditConfigSchema,
  security: securityConfigSchema,
  monitoring: monitoringConfigSchema,
});

export type AdapterConfigInput = z.infer<typeof adapterConfigSchema>;
export const adapterConfigUpdateSchema = z
  .object({
    obm: z
      .object({
        baseUrl: z.string().url().optional(),
        eventEndpoint: z.string().min(1).optional(),
        auth: z
          .object({
            method: z.enum(['basic', 'apikey', 'certificate']).optional(),
            username: z.string().optional().nullable(),
            credentialAlias: z.string().optional().nullable(),
          })
          .optional(),
        tls: z
          .object({
            allowSelfSigned: z.boolean().optional(),
            minVersion: z.enum(['TLSv1.2', 'TLSv1.3']).optional(),
          })
          .optional(),
      })
      .optional(),
    scom: z
      .object({
        xmlDirectory: z.string().optional(),
        filePattern: z.string().optional(),
        pollingIntervalMs: z.number().int().positive().optional(),
        maxFileSizeMb: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .strict();
export type AdapterConfigUpdateInput = z.infer<typeof adapterConfigUpdateSchema>;

export class ConfigLoader {
  static load(filePath: string): AdapterConfig {
    const absolutePath = join(process.cwd(), filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Configuration file not found at ${absolutePath}`);
    }

    const fileContents = readFileSync(absolutePath, 'utf-8');

    const parsed =
      filePath.endsWith('.yaml') || filePath.endsWith('.yml')
        ? YAML.parse(fileContents)
        : JSON.parse(fileContents);

    const result = adapterConfigSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(
        `Configuration validation failed: ${result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`
      );
    }

    return result.data;
  }
}

