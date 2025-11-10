import http from 'node:http';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { configService } from '@/config/config.service';
import { credentialStore } from '@/security/credential.store';
import { logger } from '@/logger';
import { createApp } from '@/server/app';
import { eventProcessorService } from '@/services/event-processor.service';
import { realtimeService } from '@/services/realtime.service';

async function bootstrap() {
  loadEnv();

  const configPath = process.env.CONFIG_PATH ?? './config/config.yaml';
  await configService.initialize(configPath);
  credentialStore.initialize();
  await eventProcessorService.initialize();

  const config = configService.getConfig();
  const app = createApp();
  const server = http.createServer(app);
  realtimeService.initialize(server);

  server.listen(config.dashboard.port, config.dashboard.host, () => {
    logger().info(
      {
        component: 'Server',
        port: config.dashboard.port,
        host: config.dashboard.host,
        configPath: resolve(configPath),
      },
      'SCOM to OBM adapter backend started'
    );
  });

  const shutdown = async (signal: string) => {
    logger().info({ signal }, 'Received shutdown signal');
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void bootstrap().catch((error) => {
  logger().error({ error }, 'Failed to start adapter');
  process.exit(1);
});

