import { configService } from '@/config/config.service';
import { auditLoggerService } from '@/services/audit-logger.service';
import { circuitBreakerService } from '@/services/circuit-breaker.service';
import { dlqService, type DlqRecord } from '@/services/dlq.service';
import { eventTransformer } from '@/services/event-transformer.service';
import { fileWatcherService } from '@/services/file-watcher.service';
import { monitoringService } from '@/services/monitoring.service';
import { obmApiClient } from '@/services/obm-api-client.service';
import { retryService } from '@/services/retry.service';
import { metricsService } from '@/services/metrics.service';
import { logger } from '@/logger';
import type { ObmEvent, ProcessingContext, ScomEvent } from '@/types/events';
import type { ProcessingStatistics } from '@/types/statistics';
import { AsyncQueue } from '@/utils/async-queue';
import { DateTime } from 'luxon';
import { realtimeService } from '@/services/realtime.service';

export interface RecentEvent {
  eventId: string;
  title: string;
  severity: string;
  status: 'success' | 'failed';
  timestamp: string;
  correlationId: string;
  details?: Record<string, unknown>;
}

export class EventProcessorService {
  private queue!: AsyncQueue;
  private stats: ProcessingStatistics = {
    total: 0,
    success: 0,
    failed: 0,
    retries: 0,
  };
  private recentEvents: RecentEvent[] = [];

  async initialize(): Promise<void> {
    const config = configService.getConfig();
    metricsService.initialize();
    obmApiClient.initialize();
    dlqService.initialize();
    await fileWatcherService.initialize();

    this.queue = new AsyncQueue(config.processing.maxConcurrentBatches);

    fileWatcherService.on('eventBatch', (events, metadata) => {
      this.queue.add(() => this.processBatch(events, metadata.filePath));
    });
  }

  getStatistics(): ProcessingStatistics {
    return this.stats;
  }

  getRecentEvents(): RecentEvent[] {
    return this.recentEvents;
  }

  async replayDlqRecord(record: DlqRecord): Promise<void> {
    const transformed =
      record.transformedEvent ?? eventTransformer.transformSingle(record.originalEvent);
    const sourceFile = (record.metadata?.sourceFile as string | undefined) ?? 'dlq';
    await this.processSingleEvent(record.originalEvent, transformed, sourceFile);
  }

  private async processBatch(events: ScomEvent[], sourceFile: string): Promise<void> {
    const config = configService.getConfig();
    const batches = this.chunk(events, config.processing.batchSize);

    for (const batch of batches) {
      await this.processEvents(batch, sourceFile);
    }
  }

  private async processEvents(events: ScomEvent[], sourceFile: string): Promise<void> {
    const transformed = eventTransformer.transform(events);

    for (const [index, scomEvent] of events.entries()) {
      const obmEvent =
        transformed[index] ?? eventTransformer.transformSingle(scomEvent);
      await this.processSingleEvent(scomEvent, obmEvent, sourceFile);
    }

    monitoringService.evaluate({
      throughput: this.stats.total,
      successRate: this.stats.total
        ? (this.stats.success / this.stats.total) * 100
        : 0,
      errorRate: this.stats.total ? (this.stats.failed / this.stats.total) * 100 : 0,
      retryCount: this.stats.retries,
      dlqSize: dlqService.getSize(),
      circuitBreakerState:
        circuitBreakerService.getState() === 'closed'
          ? 0
          : circuitBreakerService.getState() === 'half-open'
          ? 1
          : 2,
    });
    realtimeService.emitStats(this.stats);
  }

  private async processSingleEvent(
    scomEvent: ScomEvent,
    obmEvent: ObmEvent,
    sourceFile: string
  ): Promise<void> {
    const start = Date.now();
    const context: ProcessingContext = {
      correlationId: obmEvent.event.correlationId,
      eventId: scomEvent.eventId,
      sourceFile,
      attempt: 0,
      startedAt: start,
    };

    this.stats.total += 1;
    await auditLoggerService.logEventReceived(scomEvent);

    const execute = async () => {
      if (!circuitBreakerService.canProceed()) {
        throw new Error('Circuit breaker open');
      }

      context.attempt += 1;
      const response = await obmApiClient.postEvent(obmEvent);
      circuitBreakerService.recordSuccess();
      {
        const state = circuitBreakerService.getState();
        metricsService.circuitBreakerState.set(
          state === 'closed' ? 0 : state === 'half-open' ? 1 : 2
        );
      }
      metricsService.apiLatency.observe(response.durationMs / 1000);
      metricsService.eventsTotal.inc({ status: 'success' });
      metricsService.processingDuration.observe((Date.now() - start) / 1000);
      this.stats.success += 1;
      await auditLoggerService.logEventSubmission(context, obmEvent, {
        success: true,
        statusCode: response.status,
        processingTimeMs: Date.now() - start,
      });
      this.pushRecent({
        eventId: scomEvent.eventId,
        title: obmEvent.event.title,
        severity: obmEvent.event.severity,
        status: 'success',
        timestamp: new Date().toISOString(),
        correlationId: obmEvent.event.correlationId,
      });
    };

    try {
      await retryService.execute(
        execute,
        { eventId: scomEvent.eventId },
        {
          onRetry: (attempt, waitTime) => {
            metricsService.retryCount.inc();
            this.stats.retries += 1;
            logger().warn(
              {
                component: 'EventProcessor',
                eventId: scomEvent.eventId,
                attempt,
                waitTime,
              },
              'Retry scheduled for event'
            );
          },
        }
      );
    } catch (error) {
      circuitBreakerService.recordFailure();
      const state = circuitBreakerService.getState();
      metricsService.circuitBreakerState.set(state === 'closed' ? 0 : state === 'half-open' ? 1 : 2);
      metricsService.eventsTotal.inc({ status: 'failed' });
      this.stats.failed += 1;
      this.stats.lastError = (error as Error).message;
      await auditLoggerService.logEventSubmission(context, obmEvent, {
        success: false,
        errorMessage: (error as Error).message,
        processingTimeMs: Date.now() - start,
      });
      await dlqService.write({
        eventId: scomEvent.eventId,
        correlationId: context.correlationId,
        originalEvent: scomEvent,
        transformedEvent: obmEvent,
        failureReason: (error as Error).message,
        failureTimestamp: DateTime.now().toISO(),
        retryCount: context.attempt,
        metadata: {
          sourceFile,
        },
      });
      await auditLoggerService.logEventToDlq({
        eventId: scomEvent.eventId,
        correlationId: context.correlationId,
        reason: (error as Error).message,
      });
      this.pushRecent({
        eventId: scomEvent.eventId,
        title: obmEvent.event.title,
        severity: obmEvent.event.severity,
        status: 'failed',
        timestamp: new Date().toISOString(),
        correlationId: obmEvent.event.correlationId,
        details: {
          error: (error as Error).message,
        },
      });
    }
  }

  private chunk<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private pushRecent(event: RecentEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents.pop();
    }
    realtimeService.emitRecentEvent(event);
  }
}

export const eventProcessorService = new EventProcessorService();

