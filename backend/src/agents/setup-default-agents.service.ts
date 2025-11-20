import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';

@Injectable()
export class SetupDefaultAgentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  async onModuleInit() {
    await this.setupDefaultAgents();
  }

  private async setupDefaultAgents() {
    // Default router agent
    const routerAgent = await this.agentRepository.findOne({
      where: { id: 'agent.router' },
    });

    if (!routerAgent) {
      const newRouterAgent = this.agentRepository.create({
        id: 'agent.router',
        name: 'Router Agent',
        instructions:
          'You are a helpful routing agent. Your job is to analyze the output from previous workflow steps and determine which route to take based on the available options. Consider the context carefully and choose the most appropriate route. Respond with the route ID (e.g., "high_priority" or "normal"). If you need clarification, feel free to ask.',
        model_profile: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 50,
        },
        allowed_tools: [],
      });
      await this.agentRepository.save(newRouterAgent);
      console.log('Created default router agent: agent.router');
    }

    // Default condition evaluator agent
    const conditionAgent = await this.agentRepository.findOne({
      where: { id: 'agent.condition_evaluator' },
    });

    if (!conditionAgent) {
      const newConditionAgent = this.agentRepository.create({
        id: 'agent.condition_evaluator',
        name: 'Condition Evaluator Agent',
        instructions:
          'You are a helpful condition evaluator. Your job is to analyze step output and determine which condition is true. Consider the context carefully and evaluate each condition. Respond with the number (1, 2, 3, etc.) of the condition that is true. If none are true, respond with "0".',
        model_profile: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 10,
        },
        allowed_tools: [],
      });
      await this.agentRepository.save(newConditionAgent);
      console.log('Created default condition evaluator agent: agent.condition_evaluator');
    }
  }
}

