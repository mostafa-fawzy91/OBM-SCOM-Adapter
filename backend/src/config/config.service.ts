import { EventEmitter } from 'eventemitter3';
import { existsSync, readFileSync, watch } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import YAML from 'yaml';
import { adapterConfigSchema, type AdapterConfigInput } from './config.schema';
import type { AdapterConfig } from '@/types/config';

type ConfigEvent = 'reloaded' | 'error';

interface ConfigEvents {
  reloaded: (config: AdapterConfig) => void;
  error: (error: Error) => void;
}

const CONFIG_ENV_PREFIX = 'ADAPTER_';

const HOT_RELOADABLE_KEYS = new Set<string>([
  'processing.batchSize',
  'processing.batchTimeoutMs',
  'processing.rateLimitMs',
  'retry.maxAttempts',
  'retry.initialDelayMs',
  'logging.level',
  'monitoring.alertRules',
]);

export class ConfigService {
  private static instance: ConfigService;

  private readonly emitter = new EventEmitter<ConfigEvents>();
  private config!: AdapterConfig;
  private configPath!: string;
  private watcher?: ReturnType<typeof watch>;
  private readonly hotReloadableKeys = HOT_RELOADABLE_KEYS;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!this.instance) {
      this.instance = new ConfigService();
    }
    return this.instance;
  }

  async initialize(configPath: string): Promise<void> {
    this.configPath = resolve(process.cwd(), configPath);
    if (!existsSync(this.configPath)) {
      throw new Error(`Configuration file not found at ${this.configPath}`);
    }

    await this.loadConfigFromFile();
    this.applyEnvOverrides();
    this.setupWatcher();
  }

  getConfig(): AdapterConfig {
    if (!this.config) {
      throw new Error('ConfigService not initialized');
    }
    return this.config;
  }

  on(event: ConfigEvent, listener: ConfigEvents[ConfigEvent]): void {
    this.emitter.on(event, listener as never);
  }

  off(event: ConfigEvent, listener: ConfigEvents[ConfigEvent]): void {
    this.emitter.off(event, listener as never);
  }

  async updateConfig(
    updates: Partial<AdapterConfig>
  ): Promise<{ config: AdapterConfig; requiresRestart: boolean; changedKeys: string[] }> {
    if (!this.config) {
      throw new Error('ConfigService not initialized');
    }
    const merged = this.deepMerge(structuredClone(this.config), updates);

    const result = adapterConfigSchema.safeParse(merged);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Configuration validation failed: ${message}`);
    }

    const changedKeys = this.diffConfigs(this.config, result.data);
    if (changedKeys.length === 0) {
      return { config: this.config, requiresRestart: false, changedKeys };
    }

    const requiresRestart = !this.isHotReload(this.config, result.data);

    await this.persistConfig(result.data);
    this.config = result.data;

    if (!requiresRestart) {
      this.emitter.emit('reloaded', this.config);
    } else {
      this.emitter.emit(
        'error',
        new Error('Configuration change requires restart to take effect')
      );
    }

    return { config: this.config, requiresRestart, changedKeys };
  }

  private async loadConfigFromFile(): Promise<void> {
    const contents = await readFile(this.configPath, 'utf-8');
    const parsed = this.parseConfig(contents);
    this.config = parsed;
  }

  private parseConfig(raw: string): AdapterConfig {
    const isYaml = this.configPath.endsWith('.yaml') || this.configPath.endsWith('.yml');
    const data = isYaml ? YAML.parse(raw) : JSON.parse(raw);

    const result = adapterConfigSchema.safeParse(data as AdapterConfigInput);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Configuration validation failed: ${message}`);
    }
    return result.data;
  }

  private setupWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(this.configPath, async (eventType) => {
      if (eventType !== 'change') {
        return;
      }
      try {
        const previousConfig = this.config;
        await this.loadConfigFromFile();
        this.applyEnvOverrides();

        if (this.isHotReload(previousConfig, this.config)) {
          this.emitter.emit('reloaded', this.config);
        } else {
          this.config = previousConfig;
          // Non-hot-reloadable change detected; require restart
          this.emitter.emit(
            'error',
            new Error('Configuration change requires restart to take effect')
          );
        }
      } catch (error) {
        this.emitter.emit('error', error as Error);
      }
    });
  }

  private isHotReload(previousConfig: AdapterConfig, newConfig: AdapterConfig): boolean {
    const changedKeys = this.diffConfigs(previousConfig, newConfig);
    if (changedKeys.length === 0) {
      return true;
    }
    return changedKeys.every((key) => this.hotReloadableKeys.has(key));
  }

  private getNestedValue(obj: unknown, path: string[]): unknown {
    return path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private diffConfigs(prev: unknown, next: unknown, prefix = ''): string[] {
    const changes: string[] = [];

    if (prev === next) {
      return changes;
    }

    if (typeof prev !== typeof next) {
      changes.push(prefix.slice(0, -1));
      return changes;
    }

    if (prev && typeof prev === 'object' && next && typeof next === 'object') {
      const prevKeys = new Set(Object.keys(prev as Record<string, unknown>));
      const nextKeys = new Set(Object.keys(next as Record<string, unknown>));
      const allKeys = new Set([...prevKeys, ...nextKeys]);
      for (const key of allKeys) {
        const nestedChanges = this.diffConfigs(
          (prev as Record<string, unknown>)[key],
          (next as Record<string, unknown>)[key],
          `${prefix}${key}.`
        );
        changes.push(...nestedChanges);
      }
      return changes;
    }

    changes.push(prefix.slice(0, -1));
    return changes;
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    if (!source || typeof source !== 'object') {
      return target;
    }

    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      const typedKey = key as keyof T;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const current = (target as Record<string, unknown>)[key];
        (target as Record<string, unknown>)[key] = this.deepMerge(
          current && typeof current === 'object' ? structuredClone(current) : {},
          value as Record<string, unknown>
        ) as unknown as T[keyof T];
      } else if (value !== undefined) {
        (target as Record<string, unknown>)[key] = value as unknown as T[keyof T];
      }
    }

    return target;
  }

  private async persistConfig(config: AdapterConfig): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    const serialized = this.configPath.endsWith('.yaml') || this.configPath.endsWith('.yml')
      ? YAML.stringify(config)
      : `${JSON.stringify(config, null, 2)}\n`;

    await writeFile(this.configPath, serialized, 'utf-8');
    this.setupWatcher();
  }

  private applyEnvOverrides(): void {
    const envOverrides = Object.entries(process.env)
      .filter(([key]) => key.startsWith(CONFIG_ENV_PREFIX))
      .map(([key, value]) => ({
        key: key.replace(CONFIG_ENV_PREFIX, '').toLowerCase().replace(/__/g, '.'),
        value,
      }));

    if (envOverrides.length === 0) {
      return;
    }

    const clone = structuredClone(this.config);
    for (const { key, value } of envOverrides) {
      this.setNestedValue(clone, key.split('.'), this.parseValue(value));
    }

    const result = adapterConfigSchema.safeParse(clone);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Environment configuration overrides invalid: ${message}`);
    }

    this.config = result.data;
  }

  private setNestedValue(target: unknown, path: string[], value: unknown): void {
    if (!target || typeof target !== 'object') {
      return;
    }

    const lastKey = path.pop();
    if (!lastKey) return;

    let current: Record<string, unknown> = target as Record<string, unknown>;
    for (const key of path) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[lastKey] = value;
  }

  private parseValue(value: string | undefined): unknown {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}

export const configService = ConfigService.getInstance();

