import { Logger } from '@nestjs/common';

/**
 * Retry utility with exponential backoff
 */
export class RetryUtil {
  /**
   * Retry a function with exponential backoff
   * @param fn Function to retry
   * @param maxAttempts Maximum number of attempts
   * @param baseDelay Base delay in milliseconds
   * @param logger Optional logger for retry attempts
   * @returns Result of the function
   * @throws Last error if all attempts fail
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    logger?: Logger,
  ): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          if (logger) {
            logger.warn(
              `Non-retryable error on attempt ${attempt}/${maxAttempts}`,
              error,
            );
          }
          throw error;
        }

        // Don't wait after last attempt
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          if (logger) {
            logger.warn(
              `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`,
              error instanceof Error ? error.message : String(error),
            );
          }
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    if (logger) {
      logger.error(
        `All ${maxAttempts} attempts failed`,
        lastError instanceof Error ? lastError.stack : String(lastError),
      );
    }
    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const retryablePatterns = [
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /ECONNREFUSED/i,
      /rate limit/i,
      /429/i,
      /503/i,
      /502/i,
      /504/i,
    ];

    const errorMessage = error.message || '';
    const errorName = error.name || '';

    return retryablePatterns.some(
      (pattern) => pattern.test(errorMessage) || pattern.test(errorName),
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

