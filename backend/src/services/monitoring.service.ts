import { EventEmitter } from 'eventemitter3';

import { configService } from '@/config/config.service';
import { logger } from '@/logger';
import { realtimeService } from '@/services/realtime.service';

export interface AlertEvent {
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  triggeredAt: string;
  context?: Record<string, unknown>;
}

type MonitoringEvents = {
  alert: (alert: AlertEvent) => void;
};

export class MonitoringService {
  private readonly emitter = new EventEmitter<MonitoringEvents>();

  evaluate(metricContext: Record<string, unknown>): void {
    const monitoring = configService.getConfig().monitoring;
    const now = new Date().toISOString();

    for (const rule of monitoring.alertRules) {
      try {
        const condition = rule.condition.replace(
          /([a-zA-Z0-9_]+)/g,
          (_, key) => String(metricContext[key] ?? 'undefined')
        );
        // eslint-disable-next-line no-eval
        const result = eval(condition) as boolean;
        if (result) {
          const alert: AlertEvent = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            triggeredAt: now,
            context: metricContext,
          };
          this.emitter.emit('alert', alert);
          realtimeService.emitAlert(alert);
          logger().warn({ component: 'MonitoringService', alert }, 'Alert triggered');
        }
      } catch (error) {
        logger().error(
          { component: 'MonitoringService', error, rule },
          'Failed to evaluate monitoring rule'
        );
      }
    }
  }

  onAlert(listener: (alert: AlertEvent) => void): void {
    this.emitter.on('alert', listener);
  }
}

export const monitoringService = new MonitoringService();

