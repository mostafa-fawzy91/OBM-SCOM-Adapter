import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { configService } from '@/config/config.service';
import type { SecurityConfig } from '@/types/config';
import { decrypt, encrypt } from '@/utils/crypto';

export class CredentialStore {
  private static instance: CredentialStore;
  private readonly cache = new Map<string, string>();
  private ready = false;
  private securityConfig!: SecurityConfig;
  private storePath!: string;

  private constructor() {}

  static getInstance(): CredentialStore {
    if (!this.instance) {
      this.instance = new CredentialStore();
    }
    return this.instance;
  }

  initialize(): void {
    if (this.ready) {
      return;
    }

    this.securityConfig = configService.getConfig().security;
    this.storePath = resolve(
      process.cwd(),
      'data',
      'secrets',
      `${this.securityConfig.credentialStoreNamespace ?? 'default'}.json`
    );
    mkdirSync(resolve(process.cwd(), 'data', 'secrets'), { recursive: true });

    this.ready = true;
  }

  getSecret(key: string): string | undefined {
    if (!this.ready) {
      this.initialize();
    }

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.securityConfig.credentialStore === 'env') {
      const envKey = key.toUpperCase().replace(/\./g, '_');
      const value = process.env[envKey];
      if (value) {
        this.cache.set(key, value);
      }
      return value;
    }

    if (this.securityConfig.credentialStore === 'file') {
      if (!existsSync(this.storePath)) {
        return undefined;
      }
      const encryptedData = JSON.parse(readFileSync(this.storePath, 'utf-8')) as Record<
        string,
        { iv: string; authTag: string; content: string }
      >;
      const encryptedSecret = encryptedData[key];
      if (!encryptedSecret) return undefined;
      const decrypted = decrypt(encryptedSecret, this.requireEncryptionKey());
      this.cache.set(key, decrypted);
      return decrypted;
    }

    // Windows credential manager integration placeholder.
    if (this.securityConfig.credentialStore === 'windows') {
      const envKey = key.toUpperCase().replace(/\./g, '_');
      const value = process.env[envKey];
      if (value) {
        this.cache.set(key, value);
      }
      return value;
    }

    return undefined;
  }

  setSecret(key: string, value: string): void {
    if (!this.ready) {
      this.initialize();
    }

    this.cache.set(key, value);

    if (this.securityConfig.credentialStore === 'file') {
      const existing = existsSync(this.storePath)
        ? JSON.parse(readFileSync(this.storePath, 'utf-8'))
        : {};

      existing[key] = encrypt(value, this.requireEncryptionKey());
      writeFileSync(this.storePath, JSON.stringify(existing, null, 2), 'utf-8');
    } else if (this.securityConfig.credentialStore === 'env') {
      process.env[key.toUpperCase().replace(/\./g, '_')] = value;
    }
  }

  private requireEncryptionKey(): string {
    const key = this.securityConfig.encryptionKey ?? process.env.ADAPTER_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key required for credential storage.');
    }
    return key;
  }
}

export const credentialStore = CredentialStore.getInstance();

