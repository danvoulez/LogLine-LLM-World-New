import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * LogLine ID Service - ID Generation with Checksum Validation
 * 
 * Generates LogLine IDs with checksum for integrity validation.
 * Format: LL-{TYPE}-{YEAR}-{SEQUENTIAL}-{CHECKSUM}
 * Example: LL-BR-2024-000123456-A3
 * 
 * The checksum validates:
 * - ID integrity (detects typos)
 * - CPF binding (without exposing CPF)
 * - Prevents ID forgery
 */
@Injectable()
export class LogLineIdService {
  /**
   * Generate Person LogLine ID with checksum
   */
  generatePersonId(cpf: string, year: number, sequential: number): string {
    const base = `LL-BR-${year}-${sequential.toString().padStart(9, '0')}`;
    const checksum = this.calculateChecksum(base, cpf);
    return `${base}-${checksum}`;
  }

  /**
   * Generate Agent LogLine ID with checksum
   */
  generateAgentId(agentId: string, year: number, sequential: number): string {
    const base = `LL-AGENT-${year}-${sequential.toString().padStart(9, '0')}`;
    const checksum = this.calculateChecksum(base, agentId);
    return `${base}-${checksum}`;
  }

  /**
   * Calculate checksum from base ID and secret (CPF or agent ID)
   * Returns 2-character hexadecimal checksum
   */
  private calculateChecksum(base: string, secret: string): string {
    // Remove formatting from secret (dots, dashes, etc.)
    const cleanSecret = secret.replace(/[.\-\s]/g, '').toLowerCase();
    
    // Create hash from base + secret
    const hash = crypto
      .createHash('sha256')
      .update(base + cleanSecret)
      .digest('hex');
    
    // Return first 2 characters as checksum (uppercase)
    return hash.substring(0, 2).toUpperCase();
  }

  /**
   * Validate LogLine ID integrity
   * 
   * @param loglineId - The LogLine ID to validate
   * @param secret - The secret (CPF for person, agent ID for agent)
   * @returns true if checksum is valid
   */
  validateLogLineId(loglineId: string, secret: string): boolean {
    const parts = loglineId.split('-');
    
    // Format: LL-TYPE-YEAR-SEQUENTIAL-CHECKSUM (5 parts)
    if (parts.length !== 5) {
      return false;
    }

    // Reconstruct base (first 4 parts)
    const base = parts.slice(0, 4).join('-');
    const providedChecksum = parts[4];
    
    // Calculate expected checksum
    const calculatedChecksum = this.calculateChecksum(base, secret);
    
    return providedChecksum === calculatedChecksum;
  }

  /**
   * Extract base ID without checksum
   */
  extractBaseId(loglineId: string): string {
    const parts = loglineId.split('-');
    if (parts.length === 5) {
      return parts.slice(0, 4).join('-');
    }
    return loglineId; // Return as-is if no checksum
  }

  /**
   * Extract checksum from LogLine ID
   */
  extractChecksum(loglineId: string): string | null {
    const parts = loglineId.split('-');
    if (parts.length === 5) {
      return parts[4];
    }
    return null;
  }
}

