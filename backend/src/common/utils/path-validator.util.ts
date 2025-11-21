/**
 * Utility functions for validating file paths to prevent path traversal attacks
 */

/**
 * Validates a file path to prevent directory traversal attacks
 * 
 * @param path - The path to validate
 * @returns true if path is safe, false otherwise
 */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Check for null bytes
  if (path.includes('\0')) {
    return false;
  }

  // Check for path traversal sequences
  const dangerousPatterns = [
    /\.\./,           // Parent directory traversal
    /\.\.\//,         // ../ 
    /\.\.\\/,         // ..\ (Windows)
    /\/\.\./,         // /..
    /\\\.\./,         // \.. (Windows)
    /\.\.%2F/,        // URL encoded ../
    /\.\.%5C/,        // URL encoded ..\
    /%2E%2E%2F/,      // URL encoded ../
    /%2E%2E%5C/,      // URL encoded ..\
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(path)) {
      return false;
    }
  }

  // Check for absolute paths (on Unix-like systems)
  if (path.startsWith('/') && path !== '/') {
    // Allow root path but not absolute paths to other directories
    return false;
  }

  // Check for Windows absolute paths
  if (/^[A-Za-z]:\\/.test(path)) {
    return false;
  }

  // Check for protocol handlers (http://, file://, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    return false;
  }

  return true;
}

/**
 * Normalizes and validates a file path
 * 
 * @param path - The path to normalize and validate
 * @returns Normalized path if valid, throws error if invalid
 */
export function normalizeAndValidatePath(path: string): string {
  if (!isValidPath(path)) {
    throw new Error(
      `Invalid file path: path traversal or dangerous characters detected`,
    );
  }

  // Normalize path separators (convert backslashes to forward slashes)
  let normalized = path.replace(/\\/g, '/');

  // Remove leading/trailing slashes
  normalized = normalized.replace(/^\/+|\/+$/g, '');

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  return normalized;
}

