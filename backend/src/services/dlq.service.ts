import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { appendFile, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { configService } from '@/config/config.service';
import { logger } from '@/logger';
import type { ObmEvent, ScomEvent } from '@/types/events';
import { metricsService } from '@/services/metrics.service';

export interface DlqRecord {
  eventId: string;
  correlationId: string;
  originalEvent: ScomEvent;
  transformedEvent?: ObmEvent;
  failureReason: string;
  failureTimestamp: string;
  retryCount: number;
  lastHttpStatus?: number;
  metadata?: Record<string, unknown>;
}

export class DlqService {
  private initialized = false;
  private filePath!: string;
  private currentSize = 0;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const config = configService.getConfig().dlq;
    const directory = resolve(config.directory);
    mkdirSync(directory, { recursive: true });
    this.filePath = resolve(directory, config.fileName);
    this.initialized = true;
    if (existsSync(this.filePath)) {
      void readFile(this.filePath, 'utf-8').then((content) => {
        this.currentSize = content.split('\n').filter(Boolean).length;
        metricsService.dlqSize.set(this.currentSize);
      });
    }
  }

  async write(record: DlqRecord): Promise<void> {
    if (!this.initialized) {
      this.initialize();
    }

    await this.rotateIfNeeded();

    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf-8');
    this.currentSize += 1;
    metricsService.dlqSize.set(this.currentSize);
    logger().warn(
      {
        component: 'DlqService',
        eventId: record.eventId,
        reason: record.failureReason,
      },
      'Event written to DLQ'
    );
  }

  async read(limit = 100, offset = 0): Promise<DlqRecord[]> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!existsSync(this.filePath)) {
      return [];
    }

    const content = await readFile(this.filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines
      .slice(offset, offset + limit)
      .map((line) => JSON.parse(line) as DlqRecord);
  }

  async clear(): Promise<void> {
    if (!this.initialized) {
      this.initialize();
    }
    await writeFile(this.filePath, '', 'utf-8');
    this.currentSize = 0;
    metricsService.dlqSize.set(this.currentSize);
  }

  async replay(
    predicate: (record: DlqRecord) => boolean,
    handler: (record: DlqRecord) => Promise<void>
  ): Promise<number> {
    const records = await this.read(this.currentSize || Number.MAX_SAFE_INTEGER, 0);
    let replayed = 0;
    const keep: DlqRecord[] = [];

    for (const record of records) {
      if (predicate(record)) {
        await handler(record);
        replayed += 1;
      } else {
        keep.push(record);
      }
    }

    if (replayed > 0) {
      await this.writeAll(keep);
      this.currentSize = keep.length;
      metricsService.dlqSize.set(this.currentSize);
    }

    return replayed;
  }

  private async writeAll(records: DlqRecord[]): Promise<void> {
    if (records.length === 0) {
      await writeFile(this.filePath, '', 'utf-8');
      return;
    }
    const content = records.map((record) => JSON.stringify(record)).join('\n');
    await writeFile(this.filePath, `${content}\n`, 'utf-8');
  }

  private async rotateIfNeeded(): Promise<void> {
    const config = configService.getConfig().dlq;
    if (!existsSync(this.filePath)) {
      return;
    }

    const stats = statSync(this.filePath);
    const maxBytes = config.maxFileSizeMb * 1024 * 1024;
    if (stats.size < maxBytes) {
      return;
    }

    const rotatedPath = `${this.filePath}.${Date.now()}`;
    await rename(this.filePath, rotatedPath);

    const gzipPath = `${rotatedPath}.gz`;
    await pipeline(createReadStream(rotatedPath), createGzip(), createWriteStream(gzipPath));
    await unlink(rotatedPath);
    this.currentSize = 0;
    metricsService.dlqSize.set(this.currentSize);

    logger().info(
      {
        component: 'DlqService',
        rotatedPath: gzipPath,
      },
      'DLQ rotated'
    );
  }

  getSize(): number {
    return this.currentSize;
  }
}

export const dlqService = new DlqService();

