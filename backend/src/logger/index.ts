import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import pino, { transport, type TransportTargetOptions } from 'pino';

import { configService } from '@/config/config.service';
import type { LoggingConfig, AdapterConfig } from '@/types/config';

class LoggerService {
  private logger = pino();
  private auditLogger = pino();
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const config = configService.getConfig();
    this.logger = this.createLogger(config.logging, 'adapter.log');
    this.auditLogger = this.createLogger(
      {
        ...config.logging,
        directory: resolve(config.logging.directory, 'audit'),
        level: 'info',
        prettyPrint: false,
      },
      'audit.log'
    );

    configService.on('reloaded', (newConfig: AdapterConfig) => {
      this.logger.level = newConfig.logging.level;
    });
    this.initialized = true;
  }

  getLogger(): pino.Logger {
    if (!this.initialized) {
      this.initialize();
    }
    return this.logger;
  }

  getAuditLogger(): pino.Logger {
    if (!this.initialized) {
      this.initialize();
    }
    return this.auditLogger;
  }

  private createLogger(logging: LoggingConfig, fileName: string): pino.Logger {
    const directory = resolve(logging.directory);
    mkdirSync(directory, { recursive: true });

    const targets = [
      {
        target: 'pino/file',
        options: {
          destination: resolve(directory, fileName),
          mkdir: true,
          append: true,
        },
        level: logging.level,
      },
    ] as const;

    const consoleTargets =
      logging.prettyPrint
        ? [
            {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
              },
              level: logging.level,
            },
          ]
        : [];

    const fileTransport = transport({
      targets: [...targets, ...consoleTargets] as unknown as TransportTargetOptions[],
    });

    return pino(
      {
      level: logging.level,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      redact: logging.redact,
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        service: 'scom-obm-adapter',
      },
      },
      fileTransport
    );
  }
}

export const loggerService = new LoggerService();
export const logger = () => loggerService.getLogger();
export const auditLogger = () => loggerService.getAuditLogger();

