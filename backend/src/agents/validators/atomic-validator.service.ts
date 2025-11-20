import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/validation.exception';
import { AtomicEvent, AtomicStep } from '../atomic-event-converter.service';
import { createHash } from 'crypto';

/**
 * Service for validating JSON✯Atomic format
 */
@Injectable()
export class AtomicValidatorService {
  /**
   * Validate atomic event structure
   */
  validateAtomicEvent(atomicEvent: AtomicEvent): void {
    const errors: Array<{ path: string; message: string }> = [];

    // Check required fields
    if (!atomicEvent.type) {
      errors.push({ path: 'type', message: 'type is required' });
    } else {
      // Validate type format (type@version)
      if (!/^[^@]+@[\d]+\.[\d]+\.[\d]+$/.test(atomicEvent.type)) {
        errors.push({
          path: 'type',
          message: `type must be in format 'type@version' (e.g., 'event.tool_call@1.0.0')`,
        });
      }
    }

    if (!atomicEvent.schema_id) {
      errors.push({ path: 'schema_id', message: 'schema_id is required' });
    } else if (atomicEvent.schema_id !== atomicEvent.type) {
      errors.push({
        path: 'schema_id',
        message: 'schema_id must match type',
      });
    }

    if (!atomicEvent.body || typeof atomicEvent.body !== 'object') {
      errors.push({
        path: 'body',
        message: 'body is required and must be an object',
      });
    }

    if (!atomicEvent.meta) {
      errors.push({ path: 'meta', message: 'meta is required' });
    } else {
      this.validateAtomicMeta(atomicEvent.meta, errors, 'meta');
    }

    if (!atomicEvent.hash || typeof atomicEvent.hash !== 'string') {
      errors.push({
        path: 'hash',
        message: 'hash is required and must be a string',
      });
    } else {
      // Validate hash computation (if possible)
      // Note: We can't fully validate without the original data, but we can check format
      if (atomicEvent.hash.length !== 64) {
        errors.push({
          path: 'hash',
          message: 'hash must be a 64-character hex string (SHA-256)',
        });
      }
    }

    if (errors.length > 0) {
      throw new ValidationException('Atomic event validation failed', errors, {
        atomic_type: atomicEvent.type,
      });
    }
  }

  /**
   * Validate atomic step structure
   */
  validateAtomicStep(atomicStep: AtomicStep): void {
    const errors: Array<{ path: string; message: string }> = [];

    // Check required fields
    if (!atomicStep.type) {
      errors.push({ path: 'type', message: 'type is required' });
    } else {
      // Validate type format
      if (!/^[^@]+@[\d]+\.[\d]+\.[\d]+$/.test(atomicStep.type)) {
        errors.push({
          path: 'type',
          message: `type must be in format 'type@version' (e.g., 'step.agent@1.0.0')`,
        });
      }
    }

    if (!atomicStep.schema_id) {
      errors.push({ path: 'schema_id', message: 'schema_id is required' });
    }

    if (!atomicStep.body || typeof atomicStep.body !== 'object') {
      errors.push({
        path: 'body',
        message: 'body is required and must be an object',
      });
    }

    if (!atomicStep.meta) {
      errors.push({ path: 'meta', message: 'meta is required' });
    } else {
      this.validateAtomicMeta(atomicStep.meta, errors, 'meta');
    }

    if (!atomicStep.hash || typeof atomicStep.hash !== 'string') {
      errors.push({
        path: 'hash',
        message: 'hash is required and must be a string',
      });
    }

    if (errors.length > 0) {
      throw new ValidationException('Atomic step validation failed', errors, {
        atomic_type: atomicStep.type,
      });
    }
  }

  /**
   * Validate atomic run structure
   */
  validateAtomicRun(atomicRun: AtomicEvent): void {
    const errors: Array<{ path: string; message: string }> = [];

    if (!atomicRun.type) {
      errors.push({ path: 'type', message: 'type is required' });
    }

    if (!atomicRun.schema_id) {
      errors.push({ path: 'schema_id', message: 'schema_id is required' });
    }

    if (!atomicRun.body || typeof atomicRun.body !== 'object') {
      errors.push({
        path: 'body',
        message: 'body is required and must be an object',
      });
    }

    if (!atomicRun.meta) {
      errors.push({ path: 'meta', message: 'meta is required' });
    } else {
      this.validateAtomicMeta(atomicRun.meta, errors, 'meta');
    }

    if (!atomicRun.hash || typeof atomicRun.hash !== 'string') {
      errors.push({
        path: 'hash',
        message: 'hash is required and must be a string',
      });
    }

    if (errors.length > 0) {
      throw new ValidationException('Atomic run validation failed', errors, {
        atomic_type: atomicRun.type,
      });
    }
  }

  /**
   * Validate atomic meta structure
   */
  private validateAtomicMeta(
    meta: AtomicEvent['meta'],
    errors: Array<{ path: string; message: string }>,
    prefix: string,
  ): void {
    if (!meta.header) {
      errors.push({ path: `${prefix}.header`, message: 'header is required' });
    } else {
      if (!meta.header.who || !meta.header.who.id) {
        errors.push({
          path: `${prefix}.header.who.id`,
          message: 'header.who.id is required',
        });
      }

      if (!meta.header.did || typeof meta.header.did !== 'string') {
        errors.push({
          path: `${prefix}.header.did`,
          message: 'header.did is required and must be a string',
        });
      }

      if (!meta.header.this || !meta.header.this.id) {
        errors.push({
          path: `${prefix}.header.this.id`,
          message: 'header.this.id is required',
        });
      }

      if (!meta.header.when) {
        errors.push({
          path: `${prefix}.header.when`,
          message: 'header.when is required',
        });
      } else {
        if (!meta.header.when.ts) {
          errors.push({
            path: `${prefix}.header.when.ts`,
            message: 'header.when.ts is required',
          });
        }
      }

      if (!meta.header.status) {
        errors.push({
          path: `${prefix}.header.status`,
          message: 'header.status is required',
        });
      } else {
        const validStatuses = ['APPROVE', 'REVIEW', 'DENY'];
        if (!validStatuses.includes(meta.header.status)) {
          errors.push({
            path: `${prefix}.header.status`,
            message: `header.status must be one of: ${validStatuses.join(', ')}`,
          });
        }
      }
    }

    if (!meta.trace_id || typeof meta.trace_id !== 'string') {
      errors.push({
        path: `${prefix}.trace_id`,
        message: 'trace_id is required and must be a string',
      });
    }

    if (!meta.context_id || typeof meta.context_id !== 'string') {
      errors.push({
        path: `${prefix}.context_id`,
        message: 'context_id is required and must be a string',
      });
    }

    if (!meta.owner_id || typeof meta.owner_id !== 'string') {
      errors.push({
        path: `${prefix}.owner_id`,
        message: 'owner_id is required and must be a string',
      });
    }

    if (!meta.version || typeof meta.version !== 'string') {
      errors.push({
        path: `${prefix}.version`,
        message: 'version is required and must be a string',
      });
    }
  }

  /**
   * Verify hash computation for an atomic event
   * Note: This requires the original data and previous hash
   */
  verifyHash(
    atomicEvent: AtomicEvent | AtomicStep,
    previousHash?: string,
  ): boolean {
    if (!atomicEvent.hash) {
      return false;
    }

    // Recompute hash
    const hashableContent = {
      type: atomicEvent.type,
      schema_id: atomicEvent.schema_id,
      body: atomicEvent.body,
      meta: atomicEvent.meta,
      prev_hash: previousHash,
    };

    const computedHash = createHash('sha256')
      .update(JSON.stringify(hashableContent))
      .digest('hex');

    return computedHash === atomicEvent.hash;
  }
}

