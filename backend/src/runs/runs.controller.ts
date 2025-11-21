import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  Res,
  Patch,
} from '@nestjs/common';
import type { Response } from 'express';
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
    // Start run asynchronously (returns immediately)
    const run = await this.orchestratorService.startRun(
      workflowId,
      createRunDto.input,
      createRunDto.mode || 'draft',
      createRunDto.tenant_id || 'default-tenant',
      createRunDto.user_id,
      createRunDto.app_id,
      createRunDto.app_action_id,
    );

    // Return immediately - workflow executes in background
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

  @Get('runs/:id/stream')
  async streamRun(@Param('id') id: string, @Res() res: Response) {
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Verify run exists
    try {
      await this.runsService.findOne(id);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Run not found' })}\n\n`);
      res.end();
      return;
    }

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', runId: id })}\n\n`);

    // Poll for updates every 500ms
    const interval = setInterval(async () => {
      try {
        const run = await this.runsService.findOne(id);
        const events = await this.runsService.findEvents(id);

        // Send update
        res.write(
          `data: ${JSON.stringify({
            type: 'update',
            run: {
              id: run.id,
              status: run.status,
              mode: run.mode,
              result: run.result,
            },
            events: events.slice(-10), // Last 10 events
          })}\n\n`,
        );

        // Close if completed or failed
        if (run.status === 'completed' || run.status === 'failed') {
          clearInterval(interval);
          res.write(
            `data: ${JSON.stringify({
              type: 'complete',
              status: run.status,
            })}\n\n`,
          );
          res.end();
        }
      } catch (error) {
        clearInterval(interval);
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            error: error.message,
          })}\n\n`,
        );
        res.end();
      }
    }, 500);

    // Cleanup on client disconnect
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  @Patch('runs/:id/resume')
  async resumeRun(
    @Param('id') id: string,
    @Body() body: { approval_input: Record<string, any> },
  ): Promise<RunResponseDto> {
    const run = await this.orchestratorService.resumeRun(id, body.approval_input || {});
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
}

