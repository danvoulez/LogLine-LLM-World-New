import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum RegistryEvent {
  CONTRACT_CREATED = 'registry.contract.created',
  CONTRACT_STATE_CHANGED = 'registry.contract.state_changed',
  IDEA_CREATED = 'registry.idea.created',
  IDEA_APPROVED = 'registry.idea.approved',
  OBJECT_CREATED = 'registry.object.created',
  OBJECT_MOVED = 'registry.object.moved',
  AGENT_REGISTERED = 'registry.agent.registered',
  AGENT_CONTRACT_ASSIGNED = 'registry.agent.contract_assigned',
}

@Injectable()
export class RegistryEventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  emitContractCreated(contract: any) {
    this.eventEmitter.emit(RegistryEvent.CONTRACT_CREATED, contract);
  }

  emitContractStateChanged(contractId: string, oldState: string, newState: string, changedBy: string) {
    this.eventEmitter.emit(RegistryEvent.CONTRACT_STATE_CHANGED, {
      contractId,
      oldState,
      newState,
      changedBy,
      timestamp: new Date(),
    });
  }

  emitIdeaApproved(idea: any, approvedBy: string) {
    this.eventEmitter.emit(RegistryEvent.IDEA_APPROVED, {
      idea,
      approvedBy,
      timestamp: new Date(),
    });
  }

  emitObjectMoved(movement: any) {
    this.eventEmitter.emit(RegistryEvent.OBJECT_MOVED, movement);
  }

  emitAgentContractAssigned(agentId: string, contractId: string, assignedBy: string) {
    this.eventEmitter.emit(RegistryEvent.AGENT_CONTRACT_ASSIGNED, {
      agentId,
      contractId,
      assignedBy,
      timestamp: new Date(),
    });
  }
}
