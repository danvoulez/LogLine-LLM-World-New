/**
 * Utility functions for sanitizing sensitive data from logs
 */

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'api_key',
  'apikey',
  'secret',
  'secret_key',
  'access_token',
  'refresh_token',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'private_key',
  'privatekey',
  'session',
  'cookie',
  'ssn',
  'social_security',
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'pin',
  'pii',
];

/**
 * Recursively sanitize sensitive fields in an object
 * Replaces sensitive values with '[REDACTED]'
 */
export function sanitizeForLogging(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this field name contains sensitive keywords
    const isSensitive = SENSITIVE_FIELDS.some((field) =>
      lowerKey.includes(field.toLowerCase()),
    );

    if (isSensitive) {
      // Redact sensitive values
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = '[REDACTED]';
      } else if (value !== null && value !== undefined) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    } else {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    }
  }

  return sanitized;
}

