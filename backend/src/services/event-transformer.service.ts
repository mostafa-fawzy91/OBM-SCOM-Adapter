import { randomUUID } from 'node:crypto';

import { configService } from '@/config/config.service';
import type { ObmEvent, ObmEventPayload, ObmSeverity, ScomEvent } from '@/types/events';
import { DateTimeUtils } from '@/utils/datetime';

export class EventTransformerService {
  transform(events: ScomEvent[]): ObmEvent[] {
    const config = configService.getConfig();
    return events.map((event) => this.transformSingle(event, config.processing));
  }

  transformSingle(
    event: ScomEvent,
    processingConfig = configService.getConfig().processing
  ): ObmEvent {
    const correlationId = randomUUID();
    const occurredAt =
      event.timeRaised ?? event.timeAdded ?? DateTimeUtils.normalize(event.receivedAt) ?? DateTimeUtils.nowIso();

    const payload: ObmEventPayload = {
      title: event.name,
      severity: this.mapSeverity(event.severity),
      source: 'SCOM',
      category: event.category ?? 'Alert',
      application: 'SCOM',
      object: event.netbiosComputerName ?? event.monitoringObjectPath ?? 'Unknown',
      description: this.truncateDescription(event.description, 1000),
      occurredAt,
      receivedAt: event.receivedAt,
      correlationId,
      ...(event.customFields ? { customAttributes: event.customFields } : {}),
    };

    return { event: payload };
  }

  private mapSeverity(severity: ScomEvent['severity']): ObmSeverity {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'error':
        return 'critical';
      case 'warning':
        return 'warning';
      case 'information':
      case 'informational':
      case 'verbose':
      default:
        return 'normal';
    }
  }

  private truncateDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }
    return `${description.substring(0, maxLength - 3)}...`;
  }
}

export const eventTransformer = new EventTransformerService();

