import request from 'supertest';

import { configService } from '@/config/config.service';
import { circuitBreakerService } from '@/services/circuit-breaker.service';
import { dlqService } from '@/services/dlq.service';
import { eventProcessorService } from '@/services/event-processor.service';
import { metricsService } from '@/services/metrics.service';
import { createApp } from '@/server/app';
import type { AdapterConfig } from '@/types/config';
import type { DlqRecord } from '@/services/dlq.service';

describe('Adapter API routes', () => {
  const mockStats = {
    total: 50,
    success: 47,
    failed: 3,
    retries: 5,
    lastError: 'Timeout',
  };

  const mockEvents = [
    {
      eventId: 'evt-1',
      title: 'CPU High',
      severity: 'critical',
      status: 'success' as const,
      timestamp: new Date().toISOString(),
      correlationId: 'corr-1',
    },
  ];

  const mockDlqRecords: DlqRecord[] = [
    {
      eventId: 'evt-99',
      correlationId: 'corr-99',
      originalEvent: {} as never,
      transformedEvent: undefined,
      failureReason: '500 server error',
      failureTimestamp: new Date().toISOString(),
      retryCount: 5,
      lastHttpStatus: 500,
      metadata: {},
    },
  ];

  const baseConfig: Partial<AdapterConfig> = {
    metrics: {
      enabled: true,
      path: '/metrics',
      port: 9090,
      defaultLabels: { service: 'test-adapter' },
    },
    dashboard: {
      enabled: true,
      corsOrigins: ['http://localhost:5173'],
      host: '0.0.0.0',
      port: 3000,
      sessionTimeoutMinutes: 30,
    },
  };

  beforeEach(() => {
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseConfig as AdapterConfig);
    jest.spyOn(circuitBreakerService, 'getState').mockReturnValue('closed');
    jest.spyOn(eventProcessorService, 'getStatistics').mockReturnValue(mockStats);
    jest.spyOn(eventProcessorService, 'getRecentEvents').mockReturnValue(mockEvents);
    jest.spyOn(eventProcessorService, 'replayDlqRecord').mockResolvedValue(undefined);
    jest.spyOn(dlqService, 'read').mockResolvedValue(mockDlqRecords);
    jest
      .spyOn(dlqService, 'replay')
      .mockImplementation(async (_predicate, handler) => {
        await handler(mockDlqRecords[0]);
        return 1;
      });
    jest.spyOn(metricsService, 'getContentType').mockReturnValue('text/plain');
    jest.spyOn(metricsService, 'getMetrics').mockResolvedValue('metric_data 1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/stats returns statistics with derived fields', async () => {
    const app = createApp();
    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 50,
      success: 47,
      failed: 3,
      retries: 5,
      successRate: expect.closeTo((47 / 50) * 100, 5),
      failureRate: expect.closeTo((3 / 50) * 100, 5),
      circuitBreaker: 'closed',
    });
  });

  it('GET /api/events/recent returns latest events', async () => {
    const app = createApp();
    const response = await request(app).get('/api/events/recent');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ eventId: 'evt-1', status: 'success' });
  });

  it('GET /api/dlq returns DLQ entries', async () => {
    const app = createApp();
    const response = await request(app).get('/api/dlq');

    expect(dlqService.read).toHaveBeenCalledWith(100, 0);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockDlqRecords);
  });

  it('POST /api/dlq/replay/:eventId replays single DLQ record', async () => {
    const app = createApp();
    const response = await request(app).post('/api/dlq/replay/evt-99');

    expect(dlqService.replay).toHaveBeenCalled();
    expect(eventProcessorService.replayDlqRecord).toHaveBeenCalledWith(mockDlqRecords[0]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ replayed: 1 });
  });

  it('POST /api/dlq/replay/:eventId returns 404 when nothing replayed', async () => {
    (dlqService.replay as jest.Mock).mockResolvedValueOnce(0);
    const app = createApp();
    const response = await request(app).post('/api/dlq/replay/missing');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
  });

  it('POST /api/dlq/replay replays multiple records when no ids provided', async () => {
    const app = createApp();
    const response = await request(app).post('/api/dlq/replay').send({});

    expect(dlqService.replay).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ replayed: 1 });
  });

  it('GET /health reports healthy when circuit closed', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
  });

  it('GET /health reports unhealthy when circuit open', async () => {
    (circuitBreakerService.getState as jest.Mock).mockReturnValueOnce('open');
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'unhealthy');
  });

  it('GET /metrics exposes Prometheus metrics when enabled', async () => {
    const app = createApp();
    const response = await request(app).get('/metrics');

    expect(metricsService.getMetrics).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.text).toBe('metric_data 1');
  });
});

