import { setTimeout as delay } from 'node:timers/promises';

import { configService } from '@/config/config.service';
import { logger } from '@/logger';

type Retryable<T> = () => Promise<T>;

interface RetryOptions {
  onRetry?: (attempt: number, waitTimeMs: number, error: unknown) => void;
}

export class RetryService {
  async execute<T>(
    operation: Retryable<T>,
    context: Record<string, unknown> = {},
    options: RetryOptions = {}
  ): Promise<T> {
    const retryConfig = configService.getConfig().retry;

    let attempt = 0;
    let delayMs = retryConfig.initialDelayMs;

    while (attempt < retryConfig.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;

        if (!this.shouldRetry(error, retryConfig.retryableStatusCodes, retryConfig.retryableErrors)) {
          throw error;
        }

        if (attempt >= retryConfig.maxAttempts) {
          throw error;
        }

        const jitter = delayMs * retryConfig.jitterFactor * Math.random();
        const waitTime = Math.min(delayMs + jitter, retryConfig.maxDelayMs);

        options.onRetry?.(attempt, waitTime, error);

        logger().warn(
          {
            component: 'RetryService',
            attempt,
            waitTime,
            error: (error as Error)?.message,
            ...context,
          },
          'Retrying operation after failure'
        );

        await delay(waitTime);
        delayMs *= retryConfig.backoffMultiplier;
      }
    }

    throw new Error('Retry attempts exhausted');
  }

  private shouldRetry(error: unknown, statusCodes: number[], errorCodes: string[]): boolean {
    if (!error) return false;
    const err = error as { code?: string; response?: { status?: number } };
    if (err.response && err.response.status) {
      return statusCodes.includes(err.response.status);
    }
    if (err.code) {
      return errorCodes.includes(err.code);
    }
    return false;
  }
}

export const retryService = new RetryService();

