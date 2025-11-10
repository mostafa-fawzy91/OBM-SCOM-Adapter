import client from 'prom-client';

import { configService } from '@/config/config.service';

export class MetricsService {
  private registry = new client.Registry();
  private initialized = false;

  eventsTotal = new client.Counter({
    name: 'scom_obm_events_total',
    help: 'Total events processed',
    labelNames: ['status'],
  });

  processingDuration = new client.Histogram({
    name: 'scom_obm_processing_duration_seconds',
    help: 'Event processing duration',
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  });

  apiLatency = new client.Histogram({
    name: 'scom_obm_api_latency_seconds',
    help: 'OBM API latency',
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  });

  retryCount = new client.Counter({
    name: 'scom_obm_retry_count',
    help: 'Total retries attempted',
  });

  dlqSize = new client.Gauge({
    name: 'scom_obm_dlq_size',
    help: 'Current DLQ size',
  });

  circuitBreakerState = new client.Gauge({
    name: 'scom_obm_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed,1=half-open,2=open)',
  });

  initialize(): void {
    if (this.initialized) {
      return;
    }
    const config = configService.getConfig().metrics;
    client.collectDefaultMetrics({
      register: this.registry,
    });

    this.registry.setDefaultLabels(config.defaultLabels);
    this.registry.registerMetric(this.eventsTotal);
    this.registry.registerMetric(this.processingDuration);
    this.registry.registerMetric(this.apiLatency);
    this.registry.registerMetric(this.retryCount);
    this.registry.registerMetric(this.dlqSize);
    this.registry.registerMetric(this.circuitBreakerState);
    this.initialized = true;
  }

  async getMetrics(): Promise<string> {
    if (!this.initialized) {
      this.initialize();
    }
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async reset(): Promise<void> {
    this.registry.resetMetrics();
  }
}

export const metricsService = new MetricsService();

