jest.mock('node:fs/promises', () => ({
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

import { appendFile, mkdir } from 'node:fs/promises';

import { auditLoggerService } from '@/services/audit-logger.service';
import { configService } from '@/config/config.service';

describe('AuditLoggerService', () => {
  const baseConfig = {
    audit: {
      directory: './tmp/audit',
      exportDirectory: './tmp/audit/exports',
      retentionDays: 90,
      maxFileSizeMb: 100,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auditLoggerService as unknown as { initialized: boolean }).initialized = false;
    jest.spyOn(configService, 'getConfig').mockReturnValue(baseConfig as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes audit entry when event is received', async () => {
    await auditLoggerService.logEventReceived({
      eventId: 'evt-1',
      name: 'Server Down',
      severity: 'Critical',
      description: 'Test',
      receivedAt: new Date().toISOString(),
      rawXml: '<raw/>',
      customFields: {},
    } as never);

    expect(mkdir).toHaveBeenCalledWith('./tmp/audit', { recursive: true });
    expect(appendFile).toHaveBeenCalled();
    const payload = JSON.parse(((appendFile as jest.Mock).mock.calls[0][1] as string).trim());
    expect(payload.eventType).toBe('EventReceived');
    expect(payload.resource).toBe('scom-event:evt-1');
  });

  it('logs audit details for DLQ writes', async () => {
    await auditLoggerService.logEventToDlq({
      eventId: 'evt-2',
      correlationId: 'corr-2',
      reason: 'HTTP 500',
    });

    const payload = JSON.parse(((appendFile as jest.Mock).mock.calls.pop()?.[1] as string).trim());
    expect(payload.eventType).toBe('EventMovedToDLQ');
    expect(payload.details.reason).toBe('HTTP 500');
  });
});
