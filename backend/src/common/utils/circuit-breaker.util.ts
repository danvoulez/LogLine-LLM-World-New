/**
 * Simple Circuit Breaker implementation for external service calls
 * 
 * Prevents cascading failures by "opening" the circuit after consecutive failures,
 * and allowing requests again after a cooldown period.
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly name: string = 'circuit-breaker',
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.resetTimeout) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${this.name}. Retry after ${Math.ceil((this.resetTimeout - timeSinceLastFailure) / 1000)}s`,
        );
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failure count
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      this.failures = 0;
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        throw new Error(
          `Circuit breaker OPENED for ${this.name} after ${this.failures} failures. Service unavailable.`,
        );
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

