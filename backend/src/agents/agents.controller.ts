import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AgentRuntimeService, AgentContext } from './agent-runtime.service';
import { Agent } from './entities/agent.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus, RunMode } from '../runs/entities/run.entity';
import { Step, StepType, StepStatus } from '../runs/entities/step.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { v4 as uuidv4 } from 'uuid';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentRuntime: AgentRuntimeService,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  @Post()
  async create(@Body() createAgentDto: Partial<Agent>): Promise<Agent> {
    const agent = this.agentRepository.create(createAgentDto);
    return this.agentRepository.save(agent);
  }

  @Get()
  async findAll(): Promise<Agent[]> {
    return this.agentRepository.find();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Agent> {
    const agent = await this.agentRuntime.getAgent(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  @Post(':id/conversation')
  async conversation(
    @Param('id') agentId: string,
    @Body() body: { message: string; context?: Record<string, any>; conversation_id?: string; user_id?: string; tenant_id?: string },
    @Res() res: Response,
  ) {
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Verify agent exists
      const agent = await this.agentRuntime.getAgent(agentId);
      if (!agent) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Agent not found' })}\n\n`);
        res.end();
        return;
      }

      // Create a run for this conversation
      const runId = uuidv4();
      const stepId = uuidv4();
      const tenantId = body.tenant_id || 'default-tenant';

      const run = this.runRepository.create({
        id: runId,
        workflow_id: 'conversation', // Special workflow ID for conversations
        workflow_version: '1.0.0',
        status: RunStatus.RUNNING,
        mode: RunMode.DRAFT,
        input: { message: body.message, context: body.context },
        tenant_id: tenantId,
        user_id: body.user_id || null,
        app_id: null,
        app_action_id: null,
      });
      await this.runRepository.save(run);

      // Create a step for this conversation turn
      const step = this.stepRepository.create({
        id: stepId,
        run_id: runId,
        node_id: 'conversation',
        type: StepType.AGENT,
        status: StepStatus.RUNNING,
        input: { message: body.message },
      });
      await this.stepRepository.save(step);

      // Log conversation started event
      await this.eventRepository.save({
        run_id: runId,
        step_id: stepId,
        kind: EventKind.RUN_STARTED,
        payload: { agent_id: agentId, message: body.message },
      });

      res.write(`data: ${JSON.stringify({ type: 'connected', runId, stepId })}\n\n`);

      // Build agent context
      const agentContext: AgentContext = {
        runId,
        stepId,
        tenantId,
        userId: body.user_id || undefined,
        appId: undefined,
        workflowInput: body.context,
        previousSteps: [],
      };

      // Run agent step
      const result = await this.agentRuntime.runAgentStep(
        agentId,
        agentContext,
        body.message,
      );

      // Stream the response text
      if (result.text) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: result.text })}\n\n`);
      }

      // Stream tool calls if any
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          res.write(`data: ${JSON.stringify({ type: 'tool_call', toolCall })}\n\n`);
        }
      }

      // Update step and run
      step.status = StepStatus.COMPLETED;
      step.output = { text: result.text, toolCalls: result.toolCalls };
      step.finished_at = new Date();
      await this.stepRepository.save(step);

      run.status = RunStatus.COMPLETED;
      run.result = { text: result.text, toolCalls: result.toolCalls };
      await this.runRepository.save(run);

      // Log completion
      await this.eventRepository.save({
        run_id: runId,
        step_id: stepId,
        kind: EventKind.RUN_COMPLETED,
        payload: { result: result.text, finishReason: result.finishReason },
      });

      res.write(`data: ${JSON.stringify({ type: 'complete', runId, result: result.text })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
}

