jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    watch: jest.fn((_path: string, _listener: (eventType: string) => void) => ({
      close: jest.fn(),
    })),
  };
});

jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises');
  return {
    ...actual,
    writeFile: jest.fn().mockResolvedValue(undefined),
  };
});

import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ConfigService } from '@/config/config.service';
import { adapterConfigSchema } from '@/config/config.schema';
import YAML from 'yaml';
import { writeFile as writeFileAsync } from 'node:fs/promises';

const { mkdtempSync, rmSync, writeFileSync } = fs;

const baseConfig = adapterConfigSchema.parse({
  environment: 'development',
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
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
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
    credentialStore: 'env',
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

describe('ConfigService behavior', () => {
  let tempDir: string;
  let configPath: string;
  let service: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'config-service-'));
    configPath = join(tempDir, 'config.yaml');
    writeFileSync(configPath, YAML.stringify(baseConfig), 'utf-8');
  });

  afterEach(() => {
    service?.['watcher']?.close();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.ADAPTER_ENVIRONMENT;
  });

  it('loads configuration from file and exposes it', async () => {
    service = new ConfigService();
    await service.initialize(configPath);

    const config = service.getConfig();
    expect(config.environment).toBe('development');
    expect(config.processing.batchSize).toBe(10);
  });

  it('applies environment variable overrides', async () => {
    process.env.ADAPTER_ENVIRONMENT = 'staging';
    service = new ConfigService();
    await service.initialize(configPath);

    expect(service.getConfig().environment).toBe('staging');
  });

  it('detects hot reloadable changes', () => {
    const instance = new ConfigService();

    const prevConfig = structuredClone(baseConfig);
    const nextConfig = structuredClone(baseConfig);
    nextConfig.processing.batchSize = 20;

    expect((instance as unknown as { isHotReload: Function }).isHotReload.call(instance, prevConfig, nextConfig)).toBe(
      true
    );

    nextConfig.dlq.directory = '/new/path';
    expect((instance as unknown as { isHotReload: Function }).isHotReload.call(instance, prevConfig, nextConfig)).toBe(
      false
    );
  });

  it('diffs configuration objects to list changed keys', () => {
    const instance = new ConfigService();
    const prev = { a: 1, b: { c: 1, d: 2 } };
    const next = { a: 1, b: { c: 2, d: 2 } };
    const diffConfigs = (instance as unknown as { diffConfigs: Function }).diffConfigs.bind(instance);
    expect(diffConfigs(prev, next)).toContain('b.c');
  });

  it('updates configuration and marks restart requirement for non-hot-reload keys', async () => {
    service = new ConfigService();
    await service.initialize(configPath);

    const result = await service.updateConfig({
      obm: {
        baseUrl: 'https://updated.example.com',
      },
    });

    expect(result.requiresRestart).toBe(true);
    expect(result.changedKeys).toContain('obm.baseUrl');
    expect(service.getConfig().obm.baseUrl).toBe('https://updated.example.com');
  });

  it('updates hot-reloadable keys without restart', async () => {
    service = new ConfigService();
    await service.initialize(configPath);

    const result = await service.updateConfig({
      processing: {
        batchSize: 25,
      },
    });

    expect(result.requiresRestart).toBe(false);
    expect(result.changedKeys).toContain('processing.batchSize');
    expect(service.getConfig().processing.batchSize).toBe(25);
  });

});

