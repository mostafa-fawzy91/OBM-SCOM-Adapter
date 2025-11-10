jest.mock('@/logger', () => ({
  logger: jest.fn(() => ({
    warn: jest.fn(),
    info: jest.fn(),
  })),
}));

import { CircuitBreakerService } from '@/services/circuit-breaker.service';
import { configService } from '@/config/config.service';

describe('CircuitBreakerService', () => {
  const config = {
    circuitBreaker: {
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
      volumeThreshold: 1,
      errorThresholdPercentage: 50,
      halfOpenMaxCalls: 1,
    },
  };

  beforeEach(() => {
    jest.spyOn(configService, 'getConfig').mockReturnValue(config as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens after failure threshold and transitions to half-open after timeout', () => {
    const breaker = new CircuitBreakerService();
    let currentTime = 1000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    breaker.recordFailure();
    currentTime = 1500;
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');

    currentTime = 1800;
    expect(breaker.canProceed()).toBe(false);

    currentTime = 2600;
    expect(breaker.canProceed()).toBe(true);
    expect(breaker.getState()).toBe('half-open');

    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
    nowSpy.mockRestore();
  });

  it('reopens when failure occurs in half-open state', () => {
    const breaker = new CircuitBreakerService();
    let currentTime = 1000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    breaker.recordFailure();
    currentTime = 1500;
    breaker.recordFailure();
    currentTime = 2500;
    expect(breaker.canProceed()).toBe(true);
    expect(breaker.getState()).toBe('half-open');

    currentTime = 2600;
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
    nowSpy.mockRestore();
  });
});