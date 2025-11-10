jest.mock('socket.io', () => {
  const emit = jest.fn();
  const serverInstance = { emit };
  const Server = jest.fn(() => serverInstance);
  return { Server, __esModule: true, default: Server };
});

import type { Server as HttpServer } from 'node:http';

import { realtimeService } from '@/services/realtime.service';
import { configService } from '@/config/config.service';
import { Server as SocketIOServer } from 'socket.io';

const mockHttpServer = {} as unknown as HttpServer;

describe('RealtimeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(configService, 'getConfig').mockReturnValue({
      dashboard: {
        corsOrigins: ['http://localhost:5173'],
      },
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes socket server with configured CORS', () => {
    realtimeService.initialize(mockHttpServer);

    expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
      cors: { origin: ['http://localhost:5173'], credentials: true },
    });
  });

  it('emits statistics, events, and alerts when initialized', () => {
    realtimeService.initialize(mockHttpServer);
    const emit = (SocketIOServer as unknown as jest.Mock).mock.results[0].value.emit as jest.Mock;

    const stats = { total: 1 };
    realtimeService.emitStats(stats);
    expect(emit).toHaveBeenCalledWith('stats:update', stats);

    const recent = { eventId: 'evt', status: 'success' };
    realtimeService.emitRecentEvent(recent);
    expect(emit).toHaveBeenCalledWith('events:recent', recent);

    const alert = { name: 'HighError', severity: 'critical' };
    realtimeService.emitAlert(alert as never);
    expect(emit).toHaveBeenCalledWith('alerts:new', alert);
  });

  it('ignores emissions before initialization', () => {
    const emit = (SocketIOServer as unknown as jest.Mock).mock.results[0]?.value?.emit as jest.Mock | undefined;
    realtimeService.emitStats({ total: 0 });
    realtimeService.emitRecentEvent({ eventId: 'evt', status: 'success' } as never);
    realtimeService.emitAlert({ name: 'Alert' } as never);
    expect(emit).toBeUndefined();
  });
});

