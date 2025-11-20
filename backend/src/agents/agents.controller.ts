import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AgentRuntimeService } from './agent-runtime.service';
import { Agent } from './entities/agent.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentRuntime: AgentRuntimeService,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  @Post()
  async create(@Body() createAgentDto: Partial<Agent>): Promise<Agent> {
    const agent = this.agentRepository.create(createAgentDto);
    return this.agentRepository.save(agent);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Agent> {
    const agent = await this.agentRuntime.getAgent(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }
}

