import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { dlqService } from '@/services/dlq.service';
import { adapterConfigSchema } from '@/config/config.schema';
import { configService } from '@/config/config.service';
import type { DlqRecord } from '@/services/dlq.service';

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

describe('DlqService', () => {
  let dir: string;

  beforeAll(async () => {
    await configService.initialize('tests/__fixtures__/config.valid.yaml');
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dlq-'));
    (configService as unknown as { config: typeof baseConfig }).config = {
      ...baseConfig,
      dlq: {
        ...baseConfig.dlq,
        directory: dir,
      },
    };
    (dlqService as unknown as { initialized: boolean }).initialized = false;
    dlqService.initialize();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes and reads records', async () => {
    const record: DlqRecord = {
      eventId: '1',
      correlationId: 'corr',
      originalEvent: {
        eventId: '1',
        name: 'Event',
        severity: 'Critical',
        description: 'Desc',
        receivedAt: new Date().toISOString(),
      },
      failureReason: 'fail',
      failureTimestamp: new Date().toISOString(),
      retryCount: 1,
    };

    await dlqService.write(record);
    const entries = await dlqService.read();
    expect(entries).toHaveLength(1);
    expect(entries[0].eventId).toBe('1');
  });

  it('replays and removes records', async () => {
    const record: DlqRecord = {
      eventId: '2',
      correlationId: 'c2',
      originalEvent: {
        eventId: '2',
        name: 'Event2',
        severity: 'Warning',
        description: 'Desc',
        receivedAt: new Date().toISOString(),
      },
      failureReason: 'fail',
      failureTimestamp: new Date().toISOString(),
      retryCount: 1,
    };
    await dlqService.write(record);

    const handler = jest.fn(async () => Promise.resolve());
    const replayed = await dlqService.replay(
      (item) => item.eventId === '2',
      handler
    );

    expect(replayed).toBe(1);
    expect(handler).toHaveBeenCalled();
    const remaining = await dlqService.read();
    expect(remaining).toHaveLength(0);
  });

  it('clears DLQ file and resets size', async () => {
    await dlqService.write({
      eventId: 'clear-test',
      correlationId: 'corr',
      originalEvent: {
        eventId: 'clear-test',
        name: 'Event',
        severity: 'Critical',
        description: 'Desc',
        receivedAt: new Date().toISOString(),
      },
      failureReason: 'fail',
      failureTimestamp: new Date().toISOString(),
      retryCount: 1,
    });

    await dlqService.clear();
    expect(await dlqService.read()).toHaveLength(0);
    expect(dlqService.getSize()).toBe(0);
  });

  it('rotates file when size threshold exceeded', async () => {
    const config = (configService as unknown as { config: typeof baseConfig }).config;
    (configService as unknown as { config: typeof baseConfig }).config = {
      ...config,
      dlq: {
        ...config.dlq,
        maxFileSizeMb: 0.0001,
      },
    };
    (dlqService as unknown as { initialized: boolean }).initialized = false;
    dlqService.initialize();

    const record = {
      eventId: 'rotate',
      correlationId: 'corr',
      originalEvent: {
        eventId: 'rotate',
        name: 'Event',
        severity: 'Critical',
        description: 'Desc',
        receivedAt: new Date().toISOString(),
      },
      failureReason: 'fail',
      failureTimestamp: new Date().toISOString(),
      retryCount: 1,
    };

    await dlqService.write(record);
    await dlqService.write({ ...record, eventId: 'rotate-2' });

    const files = readdirSync(dir);
    const rotated = files.find((name) => name.endsWith('.gz'));
    expect(rotated).toBeDefined();
    expect(dlqService.getSize()).toBe(1);
  });
});
