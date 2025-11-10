import https from 'node:https';
import { readFileSync } from 'node:fs';

import axios, { AxiosError, AxiosHeaders, AxiosInstance } from 'axios';

import { configService } from '@/config/config.service';
import { credentialStore } from '@/security/credential.store';
import type { ObmEvent } from '@/types/events';
import type { AdapterConfig } from '@/types/config';

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  durationMs: number;
}

export class ObmApiClient {
  private static instance: ObmApiClient;
  private axiosInstance!: AxiosInstance;
  private config!: AdapterConfig;

  private constructor() {}

  static getInstance(): ObmApiClient {
    if (!this.instance) {
      this.instance = new ObmApiClient();
    }
    return this.instance;
  }

  initialize(): void {
    this.config = configService.getConfig();
    this.axiosInstance = this.createAxiosInstance(this.config);

    configService.on('reloaded', (newConfig: AdapterConfig) => {
      this.config = newConfig;
      this.axiosInstance = this.createAxiosInstance(newConfig);
    });
  }

  async postEvent(event: ObmEvent): Promise<ApiResponse> {
    const url = new URL(this.config.obm.eventEndpoint, this.config.obm.baseUrl).toString();
    const startedAt = Date.now();

    try {
      const response = await this.axiosInstance.post(url, event, {
        headers: this.buildHeaders(),
      });

      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw this.normalizeError(error as AxiosError);
    }
  }

  private createAxiosInstance(config: AdapterConfig): AxiosInstance {
    const tls = config.obm.tls;
    const ca = this.safeReadFile(tls.caFilePath);
    const cert = this.safeReadFile(tls.certFilePath);
    const key = this.safeReadFile(tls.keyFilePath);
    const agent = new https.Agent({
      keepAlive: config.obm.keepAlive,
      maxSockets: config.obm.maxSockets,
      timeout: config.obm.connectionTimeoutMs,
      rejectUnauthorized: tls.verify && !tls.allowSelfSigned,
      ca,
      cert,
      key,
      minVersion: tls.minVersion === 'TLSv1.3' ? 'TLSv1.3' : 'TLSv1.2',
    });

    const instance = axios.create({
      timeout: config.obm.readTimeoutMs,
      httpsAgent: agent,
      maxBodyLength: Infinity,
    });

    instance.interceptors.request.use((req) => {
      const headers = AxiosHeaders.from(req.headers ?? {});
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');

      const authHeaders = this.buildHeaders();
      for (const [key, value] of Object.entries(authHeaders)) {
        if (value) {
          headers.set(key, value);
        }
      }

      req.headers = headers;
      return req;
    });

    return instance;
  }

  private buildHeaders(): Record<string, string> {
    const { auth } = this.config.obm;
    if (auth.method === 'basic') {
      const username =
        auth.username ?? credentialStore.getSecret('obm.username') ?? '';
      const password =
        auth.password ?? credentialStore.getSecret('obm.password') ?? '';
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      return {
        Authorization: `Basic ${token}`,
      };
    }

    if (auth.method === 'apikey') {
      const apiKey = auth.apiKey ?? credentialStore.getSecret('obm.apiKey') ?? '';
      return {
        'X-API-Key': apiKey,
      };
    }

    return {};
  }

  private normalizeError(error: AxiosError): Error {
    if (error.response) {
      const err = new Error(
        `OBM API error: ${error.response.status} ${error.response.statusText}`
      );
      (err as unknown as AxiosError).response = error.response;
      return err;
    }

    if (error.request) {
      return new Error(`OBM API request failed: ${error.message}`);
    }

    return new Error(error.message);
  }

  private safeReadFile(path?: string): string | undefined {
    if (!path) return undefined;
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return undefined;
    }
  }
}

export const obmApiClient = ObmApiClient.getInstance();

