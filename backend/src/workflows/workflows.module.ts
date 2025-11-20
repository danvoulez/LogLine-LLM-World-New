import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { Workflow } from './entities/workflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
