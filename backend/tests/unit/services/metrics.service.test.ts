import client from 'prom-client';

import { MetricsService, metricsService } from '@/services/metrics.service';
import { configService } from '@/config/config.service';

const baseConfig = {
  metrics: {
    enabled: true,
    port: 9090,
    path: '/metrics',
    defaultLabels: { service: 'unit-test' },
  },
} as const;

describe('MetricsService (class)', () => {
  beforeEach(() => {
    client.register.clear();
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseConfig as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers default metrics and records observations', async () => {
    const service = new MetricsService();
    service.initialize();

    service.eventsTotal.inc({ status: 'success' });
    service.retryCount.inc();
    service.apiLatency.observe(0.5);
    service.processingDuration.observe(0.25);
    service.circuitBreakerState.set(0);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('scom_obm_events_total');
    expect(metrics).toContain('scom_obm_retry_count');
    expect(metrics).toContain('service="unit-test"');
  });
});

describe('metricsService singleton', () => {
  beforeEach(() => {
    client.register.clear();
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseConfig as never);
    metricsService.initialize();
  });

  afterEach(async () => {
    await metricsService.reset();
    jest.restoreAllMocks();
  });

  it('records counters and histograms', async () => {
    metricsService.eventsTotal.inc({ status: 'success' });
    metricsService.processingDuration.observe(0.2);
    metricsService.apiLatency.observe(0.1);
    metricsService.retryCount.inc();
    metricsService.dlqSize.set(5);
    metricsService.circuitBreakerState.set(1);

    const output = await metricsService.getMetrics();
    expect(output).toContain('scom_obm_events_total{status="success",service="unit-test"} 1');
    expect(output).toContain('scom_obm_processing_duration_seconds_bucket');
    expect(output).toContain('scom_obm_dlq_size{service="unit-test"} 5');
  });

  it('returns text/plain content type', () => {
    expect(metricsService.getContentType()).toContain('text/plain');
  });
});
