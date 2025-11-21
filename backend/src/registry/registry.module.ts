import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RegistryController } from './registry.controller';
import { PeopleService } from './people/people.service';
import { ObjectsService } from './objects/objects.service';
import { AgentsRegistryService } from './agents/agents-registry.service';
import { AgentExecutionLogsService } from './agents/agent-execution-logs.service';
import { IdeasService } from './ideas/ideas.service';
import { ContractsService } from './contracts/contracts.service';
import { ContractTemplatesService } from './contracts/contract-templates.service';
import { RelationshipsService } from './relationships/relationships.service';
import { RegistryEventsService } from './registry-events.service';
import { LogLineIdService } from './common/logline-id.service';
import { CorePerson } from './people/entities/core-person.entity';
import { TenantPeopleRelationship } from './people/entities/tenant-people-relationship.entity';
import { RegistryObject } from './objects/entities/registry-object.entity';
import { RegistryObjectMovement } from './objects/entities/registry-object-movement.entity';
import { AgentTrainingHistory } from './agents/entities/agent-training-history.entity';
import { AgentEvaluation } from './agents/entities/agent-evaluation.entity';
import { AgentExecutionLog } from './agents/entities/agent-execution-log.entity';
import { RegistryIdea } from './ideas/entities/registry-idea.entity';
import { RegistryIdeaVote } from './ideas/entities/registry-idea-vote.entity';
import { RegistryContract } from './contracts/entities/registry-contract.entity';
import { RegistryContractStateHistory } from './contracts/entities/registry-contract-state-history.entity';
import { ContractTemplate } from './contracts/entities/contract-template.entity';
import { RegistryRelationship } from './relationships/entities/registry-relationship.entity';
import { Agent } from '../agents/entities/agent.entity';
import { RegistryTool } from './registry.tool';

/**
 * Registry Module - Universal Registry
 * 
 * Manages:
 * - People (Universal Identity with LogLine ID)
 * - Objects (Trackable Inanimate Items)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CorePerson,
      TenantPeopleRelationship,
      RegistryObject,
      RegistryObjectMovement,
      Agent,
      AgentTrainingHistory,
      AgentEvaluation,
      AgentExecutionLog,
      RegistryIdea,
      RegistryIdeaVote,
      RegistryContract,
      RegistryContractStateHistory,
      ContractTemplate,
      RegistryRelationship,
    ]),
    EventEmitterModule,
  ],
  controllers: [RegistryController],
  providers: [LogLineIdService, RegistryEventsService, PeopleService, ObjectsService, AgentsRegistryService, AgentExecutionLogsService, IdeasService, ContractsService, ContractTemplatesService, RelationshipsService, RegistryTool],
  exports: [LogLineIdService, RegistryEventsService, PeopleService, ObjectsService, AgentsRegistryService, AgentExecutionLogsService, IdeasService, ContractsService, ContractTemplatesService, RelationshipsService, RegistryTool],
})
export class RegistryModule {}

