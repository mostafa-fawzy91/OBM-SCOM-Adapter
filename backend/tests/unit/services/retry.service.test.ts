import { retryService } from '@/services/retry.service';
import { configService } from '@/config/config.service';
import { adapterConfigSchema } from '@/config/config.schema';

const baseConfig = adapterConfigSchema.parse({
  obm: {
    baseUrl: 'https://example.com',
    eventEndpoint: '/events',
    auth: { method: 'basic', username: 'user', password: 'pass' },
    tls: { verify: true, minVersion: 'TLSv1.2' },
  },
  scom: {
    xmlDirectory: './data',
    filePattern: '*.xml',
    pollingIntervalMs: 1000,
    encoding: 'utf8',
    concurrentParsers: 1,
    maxFileSizeMb: 10,
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
    initialDelayMs: 10,
    maxDelayMs: 40,
    backoffMultiplier: 2,
    jitterFactor: 0,
    retryableStatusCodes: [500],
    retryableErrors: ['EFAIL'],
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
    defaultLabels: { service: 'test' },
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

// Force config service to use baseline config for retry tests.
beforeAll(async () => {
  await configService.initialize('tests/__fixtures__/config.valid.yaml');
  // Override with in-memory config to control retry values
  (configService as unknown as { config: typeof baseConfig }).config = baseConfig;
});

describe('RetryService', () => {
  it('retries failing operation', async () => {
    let attempt = 0;
    const fn = jest.fn(async () => {
      attempt += 1;
      if (attempt < 2) {
        const error = new Error('fail');
        (error as NodeJS.ErrnoException).code = 'EFAIL';
        throw error;
      }
      return 'ok';
    });

    const result = await retryService.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after max attempts', async () => {
    const fn = jest.fn(async () => {
      const error = new Error('fail');
      (error as NodeJS.ErrnoException).code = 'EFAIL';
      throw error;
    });

    await expect(retryService.execute(fn)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(baseConfig.retry.maxAttempts);
  });
});

