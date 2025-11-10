import type { ObmEvent, ScomEvent } from '@/types/events';

const mockConfig = {
  processing: {
    maxConcurrentBatches: 2,
    batchSize: 10,
    batchTimeoutMs: 1000,
    queueCapacity: 100,
    rateLimitMs: 0,
    maxEventsPerFile: 100,
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableStatusCodes: [429, 500],
    retryableErrors: ['ECONNRESET'],
    budgetPerMinute: 50,
  },
  dlq: {
    enabled: true,
    directory: './data/dlq',
    fileName: 'dlq.jsonl',
    maxFileSizeMb: 10,
    maxEvents: 1000,
    rotationStrategy: 'size',
    retentionDays: 30,
    alertThreshold: 10,
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 1,
    timeoutMs: 1000,
    volumeThreshold: 5,
    errorThresholdPercentage: 50,
    halfOpenMaxCalls: 2,
  },
  metrics: {
    enabled: true,
    port: 9100,
    path: '/metrics',
    defaultLabels: { service: 'unit-test' },
  },
  monitoring: {
    alertRules: [],
    alertEvaluationIntervalMs: 60000,
    notifications: {
      email: { enabled: false, to: [] },
      webhook: { enabled: false },
      slack: { enabled: false },
    },
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
    exportDirectory: './logs/audit/exports',
    retentionDays: 90,
    maxFileSizeMb: 100,
  },
  logging: {
    level: 'info',
    prettyPrint: false,
    directory: './logs',
    maxSizeMb: 100,
    maxFiles: 7,
    includeRequestId: true,
    redact: [],
  },
  security: {
    credentialStore: 'env',
    credentialStoreNamespace: 'unit',
    redactFields: [],
  },
  obm: {
    baseUrl: 'https://obm.local',
    eventEndpoint: '/opr-web/rest/9.10/event_list',
    auth: { method: 'basic' },
    tls: { verify: true, minVersion: 'TLSv1.2', allowSelfSigned: false },
    rateLimitMs: 0,
    connectionTimeoutMs: 5000,
    readTimeoutMs: 5000,
    keepAlive: true,
    maxSockets: 10,
  },
  scom: {
    xmlDirectory: './scom',
    filePattern: '*.xml',
    pollingIntervalMs: 1000,
    encoding: 'utf8',
    concurrentParsers: 2,
    maxFileSizeMb: 10,
  },
};

jest.mock('@/config/config.service', () => ({
  configService: {
    getConfig: jest.fn(() => mockConfig),
    on: jest.fn(),
  },
}));

jest.mock('@/services/event-transformer.service', () => ({
  eventTransformer: {
    transform: jest.fn((events: ScomEvent[]) =>
      events.map(() => ({
        event: {
          title: 'Server Down',
          severity: 'critical',
          description: 'Server down description',
          source: 'SCOM',
          correlationId: 'corr-1',
        },
      }))
    ),
    transformSingle: jest.fn(() => ({
      event: {
        title: 'Server Down',
        severity: 'critical',
        description: 'Server down description',
        source: 'SCOM',
        correlationId: 'corr-1',
      },
    })),
  },
}));

jest.mock('@/services/retry.service', () => ({
  retryService: {
    execute: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  },
}));

jest.mock('@/services/obm-api-client.service', () => ({
  obmApiClient: {
    initialize: jest.fn(),
    postEvent: jest.fn(async () => ({ status: 200, durationMs: 25 })),
  },
}));

jest.mock('@/services/dlq.service', () => ({
  dlqService: {
    initialize: jest.fn(),
    write: jest.fn(),
    read: jest.fn(),
    replay: jest.fn(),
    getSize: jest.fn(() => 0),
  },
}));

jest.mock('@/services/circuit-breaker.service', () => ({
  circuitBreakerService: {
    canProceed: jest.fn(() => true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    getState: jest.fn(() => 'closed'),
  },
}));

jest.mock('@/services/metrics.service', () => ({
  metricsService: {
    initialize: jest.fn(),
    eventsTotal: { inc: jest.fn() },
    retryCount: { inc: jest.fn() },
    processingDuration: { observe: jest.fn() },
    apiLatency: { observe: jest.fn() },
    circuitBreakerState: { set: jest.fn() },
  },
}));

jest.mock('@/services/monitoring.service', () => ({
  monitoringService: {
    evaluate: jest.fn(),
  },
}));

jest.mock('@/services/realtime.service', () => ({
  realtimeService: {
    emitStats: jest.fn(),
    emitRecentEvent: jest.fn(),
  },
}));

jest.mock('@/services/audit-logger.service', () => ({
  auditLoggerService: {
    logEventReceived: jest.fn().mockResolvedValue(undefined),
    logEventSubmission: jest.fn().mockResolvedValue(undefined),
    logEventToDlq: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/file-watcher.service', () => ({
  fileWatcherService: {
    initialize: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('@/logger', () => ({
  logger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import { EventProcessorService } from '@/services/event-processor.service';
import { auditLoggerService } from '@/services/audit-logger.service';
import { circuitBreakerService } from '@/services/circuit-breaker.service';
import { dlqService } from '@/services/dlq.service';
import { eventTransformer } from '@/services/event-transformer.service';
import { metricsService } from '@/services/metrics.service';
import { monitoringService } from '@/services/monitoring.service';
import { obmApiClient } from '@/services/obm-api-client.service';
import { realtimeService } from '@/services/realtime.service';
import { retryService } from '@/services/retry.service';

describe('EventProcessorService', () => {
  const scomEvent: ScomEvent = {
    eventId: 'evt-1',
    name: 'Server Down',
    severity: 'Critical',
    description: 'Server down description',
    receivedAt: new Date().toISOString(),
  } as ScomEvent;

  const obmEvent: ObmEvent = {
    event: {
      title: 'Server Down',
      severity: 'critical',
      description: 'Server down description',
      source: 'SCOM',
      correlationId: 'corr-1',
    } as never,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes events successfully and updates stats', async () => {
    const service = new EventProcessorService();
    await (service as unknown as { processEvents: (events: ScomEvent[], source: string) => Promise<void> }).processEvents(
      [scomEvent],
      'source.xml'
    );

    const stats = service.getStatistics();
    expect(stats.total).toBe(1);
    expect(stats.success).toBe(1);
    expect(metricsService.eventsTotal.inc).toHaveBeenCalledWith({ status: 'success' });
    expect(auditLoggerService.logEventSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1' }),
      obmEvent,
      expect.objectContaining({ success: true })
    );
    expect(realtimeService.emitRecentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', status: 'success' })
    );
    expect(monitoringService.evaluate).toHaveBeenCalled();
  });

  it('routes failed events to DLQ and records failure metrics', async () => {
    (obmApiClient.postEvent as jest.Mock).mockRejectedValueOnce(new Error('OBM unavailable'));

    const service = new EventProcessorService();
    await (service as unknown as { processEvents: (events: ScomEvent[], source: string) => Promise<void> }).processEvents(
      [scomEvent],
      'source.xml'
    );

    const stats = service.getStatistics();
    expect(stats.total).toBe(1);
    expect(stats.failed).toBe(1);
    expect(dlqService.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', failureReason: 'OBM unavailable' })
    );
    expect(metricsService.eventsTotal.inc).toHaveBeenCalledWith({ status: 'failed' });
    expect(circuitBreakerService.recordFailure).toHaveBeenCalled();
  });

  it('increments retry metrics when retry hook executed', async () => {
    (obmApiClient.postEvent as jest.Mock).mockRejectedValueOnce(new Error('temporary'));
    (retryService.execute as jest.Mock).mockImplementationOnce(async (fn, _ctx, hooks) => {
      try {
        await fn();
      } catch (error) {
        hooks?.onRetry?.(1, 1000);
        throw error;
      }
    });

    const service = new EventProcessorService();
    await (service as unknown as { processSingleEvent: Function }).processSingleEvent(
      scomEvent,
      obmEvent,
      'source.xml'
    );

    expect(metricsService.retryCount.inc).toHaveBeenCalled();
  });

  it('replays DLQ record using transformer when payload missing', async () => {
    const service = new EventProcessorService();
    const record = {
      originalEvent: scomEvent,
      transformedEvent: undefined,
      eventId: 'dlq-replay',
      correlationId: 'corr-id',
      failureReason: 'timeout',
      failureTimestamp: new Date().toISOString(),
      retryCount: 2,
      metadata: { sourceFile: 'dlq' },
    };

    await (service as unknown as { replayDlqRecord: (record: unknown) => Promise<void> }).replayDlqRecord(record);

    expect(eventTransformer.transformSingle).toHaveBeenCalledWith(scomEvent);
    expect(obmApiClient.postEvent).toHaveBeenCalled();
  });
});
