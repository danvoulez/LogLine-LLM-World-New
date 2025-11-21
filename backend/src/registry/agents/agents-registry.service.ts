import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';
import { AgentTrainingHistory, TrainingResult } from './entities/agent-training-history.entity';
import { AgentEvaluation } from './entities/agent-evaluation.entity';
import { CreateAgentRegistryDto } from './dto/create-agent-registry.dto';
import { TrainAgentDto } from './dto/train-agent.dto';
import { EvaluateAgentDto } from './dto/evaluate-agent.dto';
import { LogLineIdService } from '../common/logline-id.service';
import { RegistryEventsService } from '../registry-events.service';

/**
 * Agents Registry Service - Manages Agent Identity, Onboarding, Training, and Contracts
 * 
 * Handles:
 * - LogLine Agent ID generation (LL-AGENT-YYYY-XXXXXXXX)
 * - Agent onboarding and status management
 * - Training history and certification
 * - Contract scope management
 * - Evaluation and reputation scoring
 */
@Injectable()
export class AgentsRegistryService {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(AgentTrainingHistory)
    private trainingHistoryRepository: Repository<AgentTrainingHistory>,
    @InjectRepository(AgentEvaluation)
    private evaluationRepository: Repository<AgentEvaluation>,
    private dataSource: DataSource,
    private loglineIdService: LogLineIdService,
    private registryEventsService: RegistryEventsService,
  ) {}

  /**
   * Generate LogLine Agent ID: LL-AGENT-YYYY-XXXXXXXX-CHECKSUM
   * Format: LL-AGENT-{YEAR}-{SEQUENTIAL}-{CHECKSUM}
   */
  private async generateLogLineAgentId(agentId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LL-AGENT-${year}-`;

    // Find the highest sequential number for this year
    const lastAgent = await this.agentRepository
      .createQueryBuilder('agent')
      .where('agent.logline_agent_id LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('agent.logline_agent_id', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastAgent?.logline_agent_id) {
      // Extract sequence from last ID (handle both with and without checksum)
      const baseId = this.loglineIdService.extractBaseId(lastAgent.logline_agent_id);
      const match = baseId.match(/-(\d+)$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    // Generate ID with checksum
    return this.loglineIdService.generateAgentId(agentId, year, sequence);
  }

  /**
   * Register a new agent in the Registry
   * Creates agent with LogLine Agent ID and initial onboarding status
   */
  async register(dto: CreateAgentRegistryDto): Promise<Agent> {
    // Check if agent already exists
    const existing = await this.agentRepository.findOne({
      where: { id: dto.id },
    });

    if (existing) {
      throw new ConflictException(`Agent with ID ${dto.id} already exists`);
    }

    // Generate LogLine Agent ID
    const loglineAgentId = await this.generateLogLineAgentId(dto.id);

    // Create agent
    const agent = this.agentRepository.create({
      ...dto,
      logline_agent_id: loglineAgentId,
      onboarding_status: 'pending',
      memory_enabled: dto.memory_enabled ?? true,
      memory_scope: dto.memory_scope || 'private',
      visibility: dto.visibility || 'tenant',
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      accountability_enabled: true,
    });

    return this.agentRepository.save(agent);
  }

  /**
   * Find agent by ID or LogLine Agent ID
   */
  async findOne(identifier: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: [{ id: identifier }, { logline_agent_id: identifier }],
      relations: [],
    });

    if (!agent) {
      throw new NotFoundException(`Agent with identifier ${identifier} not found`);
    }

    return agent;
  }

  /**
   * Find agents by criteria
   */
  async findAll(filters: {
    tenant_id?: string;
    onboarding_status?: string;
    visibility?: string;
    owner_logline_id?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Agent[]; total: number; page: number; limit: number }> {
    const query = this.agentRepository.createQueryBuilder('agent');

    if (filters.tenant_id) {
      query.andWhere('agent.tenant_id = :tenantId', { tenantId: filters.tenant_id });
    }

    if (filters.onboarding_status) {
      query.andWhere('agent.onboarding_status = :status', {
        status: filters.onboarding_status,
      });
    }

    if (filters.visibility) {
      query.andWhere('agent.visibility = :visibility', { visibility: filters.visibility });
    }

    if (filters.owner_logline_id) {
      query.andWhere('agent.owner_logline_id = :ownerId', {
        ownerId: filters.owner_logline_id,
      });
    }

    if (filters.q) {
      query.andWhere(
        '(agent.name ILIKE :q OR agent.description ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    query.skip(skip).take(limit).orderBy('agent.created_at', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Start training for an agent
   */
  async train(agentId: string, dto: TrainAgentDto): Promise<{
    agent: Agent;
    training: AgentTrainingHistory;
  }> {
    const agent = await this.findOne(agentId);

    // Update agent status
    agent.onboarding_status = 'in_training';
    agent.training_type = dto.training_type;
    agent.training_data = dto.training_data;

    // Create training history record
    const training = this.trainingHistoryRepository.create({
      agent_id: agentId,
      training_type: dto.training_type,
      training_data: dto.training_data,
      trained_by_logline_id: dto.trained_by_logline_id,
    });

    // Save in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const savedAgent = await manager.save(agent);
      const savedTraining = await manager.save(training);
      return { agent: savedAgent, training: savedTraining };
    });

    return result;
  }

  /**
   * Complete training and update status
   */
  async completeTraining(
    agentId: string,
    result: TrainingResult,
    performanceMetrics?: Record<string, any>,
  ): Promise<Agent> {
    const agent = await this.findOne(agentId);

    if (agent.onboarding_status !== 'in_training') {
      throw new BadRequestException(
        `Agent ${agentId} is not in training. Current status: ${agent.onboarding_status}`,
      );
    }

    // Update agent
    agent.onboarding_status = result === 'success' ? 'trained' : 'pending';
    agent.training_completed_at = new Date();

    // Update latest training record
    const latestTraining = await this.trainingHistoryRepository.findOne({
      where: { agent_id: agentId },
      order: { created_at: 'DESC' },
    });

    if (latestTraining) {
      latestTraining.result = result;
      latestTraining.performance_metrics = performanceMetrics;
      await this.trainingHistoryRepository.save(latestTraining);
    }

    return this.agentRepository.save(agent);
  }

  /**
   * Certify an agent (approve training)
   */
  async certify(
    agentId: string,
    certifiedByLoglineId: string,
  ): Promise<Agent> {
    const agent = await this.findOne(agentId);

    if (agent.onboarding_status !== 'trained') {
      throw new BadRequestException(
        `Agent ${agentId} must be in 'trained' status before certification. Current: ${agent.onboarding_status}`,
      );
    }

    agent.onboarding_status = 'certified';
    agent.certified_by_logline_id = certifiedByLoglineId;

    return this.agentRepository.save(agent);
  }

  /**
   * Assign contract to agent
   */
  async assignContract(
    agentId: string,
    contractId: string,
    contractScope: {
      allowed_tools?: string[];
      max_cost_per_run_cents?: number;
      max_llm_calls_per_run?: number;
      allowed_workflows?: string[];
      restricted_actions?: string[];
    },
    assignedBy: string, // NEW: Track who assigned
  ): Promise<Agent> {
    const agent = await this.findOne(agentId);

    agent.active_contract_id = contractId;
    agent.contract_scope = contractScope;

    const savedAgent = await this.agentRepository.save(agent);

    // Emit event
    this.registryEventsService.emitAgentContractAssigned(agentId, contractId, assignedBy);

    return savedAgent;
  }

  /**
   * Remove contract from agent
   */
  async removeContract(agentId: string): Promise<Agent> {
    const agent = await this.findOne(agentId);

    agent.active_contract_id = undefined;
    agent.contract_scope = undefined;

    return this.agentRepository.save(agent);
  }

  /**
   * Evaluate an agent (for reputation scoring)
   */
  async evaluate(
    agentId: string,
    evaluatorLoglineId: string,
    dto: EvaluateAgentDto,
  ): Promise<{ evaluation: AgentEvaluation; agent: Agent }> {
    const agent = await this.findOne(agentId);

    // Create evaluation
    const evaluation = this.evaluationRepository.create({
      agent_id: agentId,
      evaluator_logline_id: evaluatorLoglineId,
      run_id: dto.run_id,
      rating: dto.rating,
      evaluation: dto.evaluation,
      criteria: dto.criteria,
    });

    // Calculate new reputation score
    const allEvaluations = await this.evaluationRepository.find({
      where: { agent_id: agentId },
    });

    const avgRating =
      allEvaluations.reduce((sum, e) => sum + e.rating, 0) / allEvaluations.length;

    // Save in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const savedEvaluation = await manager.save(evaluation);
      agent.reputation_score = Math.round(avgRating * 100) / 100; // Round to 2 decimals
      const savedAgent = await manager.save(agent);
      return { evaluation: savedEvaluation, agent: savedAgent };
    });

    return result;
  }

  /**
   * Get training history for an agent
   */
  async getTrainingHistory(agentId: string): Promise<AgentTrainingHistory[]> {
    await this.findOne(agentId); // Verify agent exists

    return this.trainingHistoryRepository.find({
      where: { agent_id: agentId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get evaluations for an agent
   */
  async getEvaluations(agentId: string): Promise<AgentEvaluation[]> {
    await this.findOne(agentId); // Verify agent exists

    return this.evaluationRepository.find({
      where: { agent_id: agentId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Update agent metrics (called after runs)
   */
  async updateMetrics(
    agentId: string,
    metrics: {
      total_runs?: number;
      successful_runs?: number;
      failed_runs?: number;
      avg_cost_per_run_cents?: number;
    },
  ): Promise<Agent> {
    const agent = await this.findOne(agentId);

    if (metrics.total_runs !== undefined) {
      agent.total_runs = metrics.total_runs;
    }
    if (metrics.successful_runs !== undefined) {
      agent.successful_runs = metrics.successful_runs;
    }
    if (metrics.failed_runs !== undefined) {
      agent.failed_runs = metrics.failed_runs;
    }
    if (metrics.avg_cost_per_run_cents !== undefined) {
      agent.avg_cost_per_run_cents = metrics.avg_cost_per_run_cents;
    }

    return this.agentRepository.save(agent);
  }
}
