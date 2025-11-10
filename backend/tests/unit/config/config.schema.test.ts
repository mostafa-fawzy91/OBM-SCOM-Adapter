import { join } from 'node:path';

import { adapterConfigSchema, ConfigLoader } from '@/config/config.schema';

describe('ConfigLoader', () => {
  const fixturePath = join(process.cwd(), 'tests/__fixtures__/config.valid.yaml');

  it('loads and validates configuration from YAML', () => {
    const config = ConfigLoader.load('tests/__fixtures__/config.valid.yaml');

    expect(config.environment).toBe('test');
    expect(config.obm.auth.method).toBe('basic');
    expect(config.processing.batchSize).toBe(10);
    expect(config.metrics.defaultLabels.service).toBe('test');
  });

  it('applies schema defaults when fields omitted', () => {
    const result = adapterConfigSchema.parse({
      obm: {
        baseUrl: 'https://example.com',
        eventEndpoint: '/api/events',
        auth: { method: 'apikey', apiKey: 'key' },
        tls: { verify: true, minVersion: 'TLSv1.2' },
      },
      scom: {
        xmlDirectory: './data',
        filePattern: '*.xml',
        pollingIntervalMs: 1000,
        encoding: 'utf8',
        concurrentParsers: 1,
        maxFileSizeMb: 100,
      },
      processing: {
        batchSize: 10,
        batchTimeoutMs: 1000,
        maxConcurrentBatches: 1,
        queueCapacity: 100,
        rateLimitMs: 100,
        maxEventsPerFile: 100,
      },
      retry: {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        retryableStatusCodes: [500],
        retryableErrors: ['ECONNRESET'],
        budgetPerMinute: 100,
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 1000,
        volumeThreshold: 5,
        errorThresholdPercentage: 50,
        halfOpenMaxCalls: 2,
      },
      dlq: {
        enabled: true,
        directory: './data/dlq',
        fileName: 'dlq.jsonl',
        maxFileSizeMb: 10,
        maxEvents: 100,
        rotationStrategy: 'size',
        retentionDays: 30,
        alertThreshold: 10,
      },
      logging: {
        level: 'info',
        prettyPrint: false,
        directory: './logs',
        maxSizeMb: 10,
        maxFiles: 3,
        includeRequestId: true,
        redact: ['password'],
      },
      metrics: {
        enabled: true,
        port: 9090,
        path: '/metrics',
        defaultLabels: { service: 'default' },
      },
      dashboard: {
        enabled: true,
        port: 3000,
        host: '0.0.0.0',
        corsOrigins: ['*'],
        sessionTimeoutMinutes: 30,
      },
      audit: {
        directory: './logs/audit',
        retentionDays: 30,
        maxFileSizeMb: 10,
        exportDirectory: './logs/audit/exports',
      },
      security: {
        credentialStore: 'file',
        redactFields: ['password'],
      },
      monitoring: {
        alertEvaluationIntervalMs: 60000,
        alertRules: [],
        notifications: {
          email: { enabled: false, to: [] },
          webhook: { enabled: false },
          slack: { enabled: false },
        },
      },
    });

    expect(result.environment).toBe('development');
    expect(result.obm.rateLimitMs).toBe(500);
  });

  it('throws when configuration file missing', () => {
    expect(() => ConfigLoader.load('missing.yaml')).toThrow(/not found/);
  });
});

