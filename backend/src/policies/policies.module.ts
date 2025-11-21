import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyEngineV0Service } from './policy-engine-v0.service';
import { Tool } from '../tools/entities/tool.entity';
import { Run } from '../runs/entities/run.entity';
import { Event } from '../runs/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tool, Run, Event])],
  providers: [PolicyEngineV0Service],
  exports: [PolicyEngineV0Service],
})
export class PoliciesModule {}

