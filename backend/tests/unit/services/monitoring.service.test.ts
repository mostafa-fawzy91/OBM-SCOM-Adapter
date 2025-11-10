jest.mock('@/services/realtime.service', () => ({
  realtimeService: {
    emitAlert: jest.fn(),
  },
}));

jest.mock('@/logger', () => ({
  logger: jest.fn(() => ({
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import { MonitoringService } from '@/services/monitoring.service';
import { configService } from '@/config/config.service';
import { realtimeService } from '@/services/realtime.service';
import { logger } from '@/logger';

describe('MonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits alerts and logs when condition evaluates to true', () => {
    jest.spyOn(configService, 'getConfig').mockReturnValue({
      monitoring: {
        alertEvaluationIntervalMs: 60000,
        alertRules: [
          {
            name: 'HighErrorRate',
            condition: 'errorRate > threshold',
            severity: 'critical',
            message: 'Error rate exceeded threshold',
          },
        ],
        notifications: {
          email: { enabled: false, to: [] },
          webhook: { enabled: false },
          slack: { enabled: false },
        },
      },
    } as never);

    const service = new MonitoringService();
    service.evaluate({ errorRate: 10, threshold: 5 });

    const loggerInstance = (logger as jest.Mock).mock.results.at(-1)?.value as {
      warn: jest.Mock;
    };
    expect(realtimeService.emitAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HighErrorRate',
        severity: 'critical',
        message: 'Error rate exceeded threshold',
      })
    );
    expect(loggerInstance?.warn).toHaveBeenCalled();
  });

  it('invokes alert listeners registered on the instance', () => {
    jest.spyOn(configService, 'getConfig').mockReturnValue({
      monitoring: {
        alertEvaluationIntervalMs: 60000,
        alertRules: [
          {
            name: 'HighErrorRate',
            condition: 'errorRate > limit',
            severity: 'warning',
            message: 'Approaching capacity',
          },
        ],
        notifications: {
          email: { enabled: false, to: [] },
          webhook: { enabled: false },
          slack: { enabled: false },
        },
      },
    } as never);

    const service = new MonitoringService();
    const events: unknown[] = [];
    service.onAlert((alert) => events.push(alert));

    service.evaluate({ errorRate: 8, limit: 5 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'HighErrorRate',
      severity: 'warning',
      message: 'Approaching capacity',
    });
  });

  it('logs evaluation errors without throwing', () => {
    const loggerInstance = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    (logger as jest.Mock).mockReturnValue(loggerInstance);

    jest.spyOn(configService, 'getConfig').mockReturnValue({
      monitoring: {
        alertEvaluationIntervalMs: 60000,
        alertRules: [
          {
            name: 'InvalidRule',
            condition: '(() => { throw new Error("bad") })()',
            severity: 'warning',
            message: 'This should fail',
          },
        ],
        notifications: {
          email: { enabled: false, to: [] },
          webhook: { enabled: false },
          slack: { enabled: false },
        },
      },
    } as never);

    const service = new MonitoringService();
    expect(() => service.evaluate({ errorRate: 1 })).not.toThrow();
    expect(loggerInstance.error).toHaveBeenCalled();
  });
});
