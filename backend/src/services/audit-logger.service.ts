import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { configService } from '@/config/config.service';
import type { ObmEvent, ProcessingContext, ProcessingResult, ScomEvent } from '@/types/events';

interface AuditEntry {
  auditId: string;
  timestamp: string;
  eventType: string;
  correlationId: string;
  actor: string;
  action: string;
  resource: string;
  status: 'success' | 'failure';
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class AuditLoggerService {
  private initialized = false;
  private auditPath!: string;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const config = configService.getConfig().audit;
    this.auditPath = resolve(config.directory, 'audit.log');
    await mkdir(config.directory, { recursive: true });
    await mkdir(config.exportDirectory, { recursive: true });
    this.initialized = true;
  }

  async logEventReceived(event: ScomEvent): Promise<void> {
    return this.write({
      auditId: event.eventId,
      timestamp: event.receivedAt,
      eventType: 'EventReceived',
      correlationId: event.eventId,
      actor: 'system',
      action: 'SCOM XML ingest',
      resource: `scom-event:${event.eventId}`,
      status: 'success',
      details: {
        severity: event.severity,
        sourceFile: event.sourceFile,
      },
    });
  }

  async logEventSubmission(
    context: ProcessingContext,
    obmEvent: ObmEvent,
    result: ProcessingResult
  ): Promise<void> {
    return this.write({
      auditId: context.eventId,
      timestamp: new Date().toISOString(),
      eventType: 'EventSubmitted',
      correlationId: context.correlationId,
      actor: 'system',
      action: 'POST /opr-web/rest/event_list',
      resource: `obm-event:${context.eventId}`,
      status: result.success ? 'success' : 'failure',
      details: {
        httpStatus: result.statusCode,
        processingTimeMs: result.processingTimeMs,
        attempt: context.attempt,
      },
      metadata: {
        obmEvent,
      },
    });
  }

  async logEventToDlq(record: { eventId: string; correlationId: string; reason: string }): Promise<void> {
    return this.write({
      auditId: record.eventId,
      timestamp: new Date().toISOString(),
      eventType: 'EventMovedToDLQ',
      correlationId: record.correlationId,
      actor: 'system',
      action: 'DLQ write',
      resource: `dlq-event:${record.eventId}`,
      status: 'failure',
      details: {
        reason: record.reason,
      },
    });
  }

  private async write(entry: AuditEntry): Promise<void> {
    await this.ensureInitialized();
    await appendFile(this.auditPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }
}

export const auditLoggerService = new AuditLoggerService();

