import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { RunsService } from './runs.service';
import { OrchestratorService } from '../execution/orchestrator.service';
import { CreateRunDto } from './dto/create-run.dto';
import { RunResponseDto } from './dto/run-response.dto';
import { EventResponseDto } from './dto/event-response.dto';

@Controller()
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  @Post('workflows/:id/runs')
  async createRun(
    @Param('id') workflowId: string,
    @Body() createRunDto: CreateRunDto,
  ): Promise<RunResponseDto> {
    const run = await this.orchestratorService.startRun(
      workflowId,
      createRunDto.input,
      createRunDto.mode || 'draft',
      createRunDto.tenant_id || 'default-tenant',
      createRunDto.user_id,
      createRunDto.app_id,
      createRunDto.app_action_id,
    );

    return {
      id: run.id,
      workflow_id: run.workflow_id,
      workflow_version: run.workflow_version,
      app_id: run.app_id,
      app_action_id: run.app_action_id,
      user_id: run.user_id,
      tenant_id: run.tenant_id,
      status: run.status,
      mode: run.mode,
      input: run.input,
      result: run.result,
      created_at: run.created_at,
      updated_at: run.updated_at,
    };
  }

  @Get('runs/:id')
  async findOne(@Param('id') id: string): Promise<RunResponseDto> {
    return this.runsService.findOne(id);
  }

  @Get('runs/:id/events')
  async findEvents(@Param('id') id: string): Promise<EventResponseDto[]> {
    // Verify run exists
    await this.runsService.findOne(id);
    return this.runsService.findEvents(id);
  }
}

