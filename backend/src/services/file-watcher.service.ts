import { createReadStream, statSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'eventemitter3';

import { configService } from '@/config/config.service';
import { logger } from '@/logger';
import type { ScomEvent } from '@/types/events';
import { ScomXmlParser } from './scom-xml-parser.service';

type FileWatcherEvent = 'eventBatch' | 'error';

interface FileWatcherEvents {
  eventBatch: (events: ScomEvent[], metadata: { filePath: string }) => void;
  error: (error: Error) => void;
}

export class FileWatcherService {
  private static instance: FileWatcherService;
  private watcher?: FSWatcher;
  private initialized = false;
  private readonly emitter = new EventEmitter<FileWatcherEvents>();
  private processingFiles = new Set<string>();
  private lastProcessedSize = new Map<string, number>();
  private parser = new ScomXmlParser();

  private constructor() {}

  static getInstance(): FileWatcherService {
    if (!this.instance) {
      this.instance = new FileWatcherService();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const config = configService.getConfig();
    const resolvedPath = resolve(config.scom.xmlDirectory);

    this.watcher = chokidar.watch(join(resolvedPath, config.scom.filePattern), {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      ignoreInitial: false,
      depth: 0,
    });

    this.watcher.on('add', (path) => this.handleFile(path));
    this.watcher.on('change', (path) => this.handleFile(path));
    this.watcher.on('error', (error) => this.emitter.emit('error', error as Error));

    configService.on('reloaded', async () => {
      await this.restart();
    });

    this.initialized = true;
    logger().info({ component: 'FileWatcherService', directory: resolvedPath }, 'File watcher started');
  }

  on<T extends FileWatcherEvent>(event: T, listener: FileWatcherEvents[T]): void {
    this.emitter.on(event, listener as never);
  }

  off<T extends FileWatcherEvent>(event: T, listener: FileWatcherEvents[T]): void {
    this.emitter.off(event, listener as never);
  }

  async shutdown(): Promise<void> {
    await this.watcher?.close();
    this.processingFiles.clear();
    this.initialized = false;
  }

  private async restart(): Promise<void> {
    await this.shutdown();
    await this.initialize();
  }

  private async handleFile(filePath: string): Promise<void> {
    if (this.processingFiles.has(filePath)) {
      return;
    }

    this.processingFiles.add(filePath);
    try {
      await this.waitForFileReady(filePath);
      await this.processFile(filePath);
    } catch (error) {
      this.emitter.emit('error', error as Error);
    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  private async waitForFileReady(filePath: string): Promise<void> {
    const config = configService.getConfig();
    const maxSizeBytes = config.scom.maxFileSizeMb * 1024 * 1024;

    for (let attempts = 0; attempts < 10; attempts += 1) {
      try {
        await access(filePath);
        const stats = statSync(filePath);

        if (stats.size > maxSizeBytes) {
          throw new Error(`File ${filePath} exceeds max allowed size ${config.scom.maxFileSizeMb} MB`);
        }

        const lastSize = this.lastProcessedSize.get(filePath) ?? 0;
        if (stats.size === lastSize && stats.mtimeMs === stats.ctimeMs) {
          return;
        }

        this.lastProcessedSize.set(filePath, stats.size);
        await delay(config.scom.pollingIntervalMs / 2);
      } catch (error) {
        await delay(1000);
        if (attempts === 9) {
          throw error;
        }
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const config = configService.getConfig();
    const contents = await readFile(filePath, { encoding: config.scom.encoding });
    const events = await this.parser.parse(contents, {
      sourceFile: filePath,
    });

    if (events.length === 0) {
      return;
    }

    logger().info(
      {
        component: 'FileWatcherService',
        filePath,
        events: events.length,
      },
      'File processed'
    );
    this.emitter.emit('eventBatch', events, { filePath });
  }
}

export const fileWatcherService = FileWatcherService.getInstance();

