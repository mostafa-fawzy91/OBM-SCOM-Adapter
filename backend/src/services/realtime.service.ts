import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { configService } from '@/config/config.service';
import type { AlertEvent } from '@/services/monitoring.service';
import type { RecentEvent } from '@/services/event-processor.service';
import type { ProcessingStatistics } from '@/types/statistics';

class RealtimeService {
  private io?: Server;

  initialize(server: HttpServer): void {
    const { dashboard } = configService.getConfig();
    this.io = new Server(server, {
      cors: {
        origin: dashboard.corsOrigins,
        credentials: true,
      },
    });
  }

  emitStats(stats: ProcessingStatistics): void {
    this.io?.emit('stats:update', stats);
  }

  emitRecentEvent(event: RecentEvent): void {
    this.io?.emit('events:recent', event);
  }

  emitAlert(alert: AlertEvent): void {
    this.io?.emit('alerts:new', alert);
  }
}

export const realtimeService = new RealtimeService();

