import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { configService } from '@/config/config.service';
import { eventProcessorService } from '@/services/event-processor.service';
import { metricsService } from '@/services/metrics.service';
import { circuitBreakerService } from '@/services/circuit-breaker.service';
import { dlqService } from '@/services/dlq.service';
import { createConfigRouter } from '@/server/routes/config.routes';

export function createApp() {
  const app = express();
  const config = configService.getConfig();

  app.use(express.json({ limit: '5mb' }));
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.dashboard.corsOrigins,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(morgan('combined'));
  app.use('/api/config', createConfigRouter());

  app.get('/health', async (_req, res) => {
    const state = circuitBreakerService.getState();
    const healthy = state !== 'open';

    const statusPayload = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      components: {
        circuitBreaker: { status: state },
        fileWatcher: { status: 'up' },
        obmConnection: { status: healthy ? 'up' : 'down' },
      },
    };

    if (!healthy) {
      return res.status(503).json(statusPayload);
    }
    return res.json(statusPayload);
  });

  app.get('/ready', (_req, res) => {
    const state = circuitBreakerService.getState();
    if (state === 'open') {
      return res.status(503).json({ status: 'circuit_open' });
    }
    return res.json({ status: 'ready' });
  });

  app.get('/metrics', async (_req, res) => {
    if (!config.metrics.enabled) {
      return res.status(404).end();
    }
    res.set('Content-Type', metricsService.getContentType());
    const metrics = await metricsService.getMetrics();
    return res.send(metrics);
  });

  app.get('/api/stats', (_req, res) => {
    const stats = eventProcessorService.getStatistics();
    return res.json({
      ...stats,
      successRate: stats.total ? (stats.success / stats.total) * 100 : 0,
      failureRate: stats.total ? (stats.failed / stats.total) * 100 : 0,
      circuitBreaker: circuitBreakerService.getState(),
    });
  });

  app.get('/api/events/recent', (_req, res) => {
    return res.json(eventProcessorService.getRecentEvents());
  });

  app.get('/api/dlq', async (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    const offset = Number(req.query.offset ?? 0);
    const entries = await dlqService.read(limit, offset);
    res.json(entries);
  });

  app.post('/api/dlq/replay/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const replayed = await dlqService.replay(
      (record) => record.eventId === eventId,
      async (record) => {
        await eventProcessorService.replayDlqRecord(record);
      }
    );
    if (replayed === 0) {
      return res.status(404).json({ message: 'Event not found in DLQ' });
    }
    return res.json({ replayed });
  });

  app.post('/api/dlq/replay', async (req, res) => {
    const { eventIds } = req.body as { eventIds?: string[] };
    const replayed = await dlqService.replay(
      (record) => !eventIds || eventIds.length === 0 || eventIds.includes(record.eventId),
      async (record) => {
        await eventProcessorService.replayDlqRecord(record);
      }
    );
    return res.json({ replayed });
  });

  return app;
}

