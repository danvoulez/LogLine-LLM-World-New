import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyEngineV0Service } from './policy-engine-v0.service';
import { PolicyEngineV1Service } from './policy-engine-v1.service';
import { Policy } from './entities/policy.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Run } from '../runs/entities/run.entity';
import { Event } from '../runs/entities/event.entity';
import { Agent } from '../agents/entities/agent.entity';
import { App } from '../apps/entities/app.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, Tool, Run, Event, Agent, App])],
  providers: [PolicyEngineV0Service, PolicyEngineV1Service],
  exports: [PolicyEngineV0Service, PolicyEngineV1Service],
})
export class PoliciesModule {}

