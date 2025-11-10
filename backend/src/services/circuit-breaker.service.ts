import { configService } from '@/config/config.service';
import { logger } from '@/logger';

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreakerService {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt = 0;

  canProceed(): boolean {
    const config = configService.getConfig().circuitBreaker;
    if (this.state === 'open') {
      const sinceOpen = Date.now() - this.lastFailureAt;
      if (sinceOpen >= config.timeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
        this.failureCount = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    const config = configService.getConfig().circuitBreaker;
    if (this.state === 'half-open') {
      this.successCount += 1;
      if (this.successCount >= config.successThreshold) {
        this.close();
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    const config = configService.getConfig().circuitBreaker;
    this.failureCount += 1;
    if (this.state === 'half-open') {
      this.open();
      return;
    }
    if (this.failureCount >= config.failureThreshold) {
      this.open();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private open(): void {
    this.state = 'open';
    this.lastFailureAt = Date.now();
    logger().warn({ component: 'CircuitBreaker', state: this.state }, 'Circuit opened');
  }

  private close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    logger().info({ component: 'CircuitBreaker', state: this.state }, 'Circuit closed');
  }
}

export const circuitBreakerService = new CircuitBreakerService();

