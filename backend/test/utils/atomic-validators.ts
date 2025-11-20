import { AtomicEvent, AtomicStep } from '../../src/agents/atomic-event-converter.service';

/**
 * Validators for JSON✯Atomic format in tests
 */
export class AtomicValidators {
  /**
   * Validate atomic event structure
   */
  static isValidAtomicEvent(event: any): event is AtomicEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      typeof event.type === 'string' &&
      /^[^@]+@[\d]+\.[\d]+\.[\d]+$/.test(event.type) &&
      typeof event.schema_id === 'string' &&
      typeof event.body === 'object' &&
      event.body !== null &&
      typeof event.meta === 'object' &&
      event.meta !== null &&
      typeof event.hash === 'string' &&
      event.hash.length === 64 // SHA-256 hex string
    );
  }

  /**
   * Validate atomic step structure
   */
  static isValidAtomicStep(step: any): step is AtomicStep {
    return (
      typeof step === 'object' &&
      step !== null &&
      typeof step.type === 'string' &&
      /^[^@]+@[\d]+\.[\d]+\.[\d]+$/.test(step.type) &&
      typeof step.schema_id === 'string' &&
      typeof step.body === 'object' &&
      step.body !== null &&
      typeof step.body.node_id === 'string' &&
      typeof step.meta === 'object' &&
      step.meta !== null &&
      typeof step.hash === 'string' &&
      step.hash.length === 64
    );
  }

  /**
   * Check if prev_hash links are valid in a chain
   */
  static validateHashChain(items: Array<AtomicEvent | AtomicStep>): boolean {
    for (let i = 1; i < items.length; i++) {
      const current = items[i];
      const previous = items[i - 1];

      if (current.prev_hash !== previous.hash) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate atomic meta structure
   */
  static isValidAtomicMeta(meta: any): boolean {
    return (
      typeof meta === 'object' &&
      meta !== null &&
      typeof meta.header === 'object' &&
      meta.header !== null &&
      typeof meta.header.who === 'object' &&
      meta.header.who !== null &&
      typeof meta.header.who.id === 'string' &&
      typeof meta.header.did === 'string' &&
      typeof meta.header.this === 'object' &&
      meta.header.this !== null &&
      typeof meta.header.this.id === 'string' &&
      typeof meta.header.when === 'object' &&
      meta.header.when !== null &&
      typeof meta.header.when.ts === 'string' &&
      typeof meta.header.status === 'string' &&
      ['APPROVE', 'REVIEW', 'DENY'].includes(meta.header.status) &&
      typeof meta.trace_id === 'string' &&
      typeof meta.context_id === 'string' &&
      typeof meta.owner_id === 'string' &&
      typeof meta.version === 'string'
    );
  }
}

