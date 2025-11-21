import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RegistryIdea, IdeaStatus } from './entities/registry-idea.entity';
import { RegistryIdeaVote } from './entities/registry-idea-vote.entity';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { VoteIdeaDto } from './dto/vote-idea.dto';

/**
 * Ideas Service - Budget Democracy System
 * 
 * Handles:
 * - Idea creation and management
 * - Collaborative voting with weighted priorities
 * - Consensus priority calculation
 * - Cost vs Priority matrix generation
 * - Idea approval and contract generation
 */
@Injectable()
export class IdeasService {
  constructor(
    @InjectRepository(RegistryIdea)
    private ideaRepository: Repository<RegistryIdea>,
    @InjectRepository(RegistryIdeaVote)
    private voteRepository: Repository<RegistryIdeaVote>,
    private dataSource: DataSource,
  ) {}

  /**
   * Create a new idea
   */
  async create(dto: CreateIdeaDto): Promise<RegistryIdea> {
    const idea = this.ideaRepository.create({
      ...dto,
      status: 'aguardando_votos',
      moeda: dto.moeda || 'BRL',
      periodo_votacao_dias: dto.periodo_votacao_dias || 7,
      data_submissao: new Date(),
    });

    return this.ideaRepository.save(idea);
  }

  /**
   * Find idea by ID
   */
  async findOne(id: string): Promise<RegistryIdea> {
    const idea = await this.ideaRepository.findOne({
      where: { id },
      relations: ['votes'],
    });

    if (!idea) {
      throw new NotFoundException(`Idea with ID ${id} not found`);
    }

    return idea;
  }

  /**
   * Find ideas by criteria
   */
  async findAll(filters: {
    tenant_id?: string;
    status?: IdeaStatus;
    autor_logline_id?: string;
    sort?: 'prioridade_consensual' | 'custo_estimado' | 'data_submissao';
    page?: number;
    limit?: number;
  }): Promise<{ data: RegistryIdea[]; total: number; page: number; limit: number }> {
    const query = this.ideaRepository.createQueryBuilder('idea');

    if (filters.tenant_id) {
      query.andWhere('idea.tenant_id = :tenantId', { tenantId: filters.tenant_id });
    }

    if (filters.status) {
      query.andWhere('idea.status = :status', { status: filters.status });
    }

    if (filters.autor_logline_id) {
      query.andWhere('idea.autor_logline_id = :autorId', {
        autorId: filters.autor_logline_id,
      });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Sort
    if (filters.sort === 'prioridade_consensual') {
      query.orderBy('idea.prioridade_consensual', 'DESC', 'NULLS LAST');
    } else if (filters.sort === 'custo_estimado') {
      query.orderBy('idea.custo_estimado_cents', 'ASC', 'NULLS LAST');
    } else {
      query.orderBy('idea.data_submissao', 'DESC');
    }

    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Vote on an idea
   */
  async vote(ideaId: string, voterLoglineId: string, dto: VoteIdeaDto): Promise<{
    vote: RegistryIdeaVote;
    idea: RegistryIdea;
  }> {
    const idea = await this.findOne(ideaId);

    // Check if already voted
    const existingVote = await this.voteRepository.findOne({
      where: {
        idea_id: ideaId,
        voter_logline_id: voterLoglineId,
      },
    });

    const voteData = {
      idea_id: ideaId,
      voter_logline_id: voterLoglineId,
      prioridade: dto.prioridade,
      comentario: dto.comentario,
      peso: dto.peso || 1.0,
    };

    let vote: RegistryIdeaVote;
    if (existingVote) {
      // Update existing vote
      Object.assign(existingVote, voteData);
      vote = await this.voteRepository.save(existingVote);
    } else {
      // Create new vote
      vote = this.voteRepository.create(voteData);
      vote = await this.voteRepository.save(vote);
    }

    // Update idea status if first vote
    if (idea.status === 'aguardando_votos') {
      idea.status = 'em_votacao';
      idea.data_fim_votacao = new Date(
        Date.now() + idea.periodo_votacao_dias * 24 * 60 * 60 * 1000,
      );
    }

    // Recalculate consensus priority
    await this.recalculateConsensusPriority(ideaId);

    // Reload idea with updated priority
    const updatedIdea = await this.findOne(ideaId);

    return {
      vote,
      idea: updatedIdea,
    };
  }

  /**
   * Recalculate consensus priority (weighted average)
   */
  async recalculateConsensusPriority(ideaId: string): Promise<void> {
    const votes = await this.voteRepository.find({
      where: { idea_id: ideaId },
    });

    if (votes.length === 0) {
      // No votes yet, use author priority
      const idea = await this.ideaRepository.findOne({ where: { id: ideaId } });
      if (idea) {
        idea.prioridade_consensual = idea.prioridade_autor;
        await this.ideaRepository.save(idea);
      }
      return;
    }

    // Calculate weighted average: sum(prioridade * peso) / sum(peso)
    let totalWeightedPriority = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      totalWeightedPriority += vote.prioridade * vote.peso;
      totalWeight += vote.peso;
    }

    const consensusPriority = totalWeight > 0 ? totalWeightedPriority / totalWeight : 0;

    // Update idea
    const idea = await this.ideaRepository.findOne({ where: { id: ideaId } });
    if (idea) {
      idea.prioridade_consensual = Math.round(consensusPriority * 100) / 100; // Round to 2 decimals
      await this.ideaRepository.save(idea);
    }
  }

  /**
   * Get cost vs priority matrix for all ideas in a tenant
   */
  async getCostPriorityMatrix(tenantId: string): Promise<{
    ideas: Array<{
      id: string;
      titulo: string;
      custo_estimado_cents: number | null;
      prioridade_consensual: number | null;
      status: IdeaStatus;
    }>;
    quadrants: {
      quick_wins: number; // High priority, low cost
      strategic_investments: number; // High priority, high cost
      fill_ins: number; // Low priority, low cost
      money_pits: number; // Low priority, high cost
    };
  }> {
    const ideas = await this.ideaRepository.find({
      where: { tenant_id: tenantId },
      order: { prioridade_consensual: { direction: 'DESC', nulls: 'LAST' } },
    });

    // Calculate median cost and priority for quadrant classification
    const costs = ideas
      .map((i) => i.custo_estimado_cents)
      .filter((c) => c !== null && c !== undefined) as number[];
    const priorities = ideas
      .map((i) => i.prioridade_consensual)
      .filter((p) => p !== null && p !== undefined) as number[];

    const medianCost = costs.length > 0 ? costs.sort((a, b) => a - b)[Math.floor(costs.length / 2)] : 0;
    const medianPriority = priorities.length > 0
      ? priorities.sort((a, b) => a - b)[Math.floor(priorities.length / 2)]
      : 5;

    const matrixData = ideas.map((idea) => ({
      id: idea.id,
      titulo: idea.titulo,
      custo_estimado_cents: idea.custo_estimado_cents ?? null, // Convert undefined to null
      prioridade_consensual: idea.prioridade_consensual ?? null, // Convert undefined to null
      status: idea.status,
    }));

    // Count by quadrant
    let quickWins = 0;
    let strategicInvestments = 0;
    let fillIns = 0;
    let moneyPits = 0;

    for (const idea of ideas) {
      const cost = idea.custo_estimado_cents ?? 0;
      const priority = idea.prioridade_consensual ?? 0;

      if (priority >= medianPriority && cost <= medianCost) {
        quickWins++;
      } else if (priority >= medianPriority && cost > medianCost) {
        strategicInvestments++;
      } else if (priority < medianPriority && cost <= medianCost) {
        fillIns++;
      } else {
        moneyPits++;
      }
    }

    return {
      ideas: matrixData,
      quadrants: {
        quick_wins: quickWins,
        strategic_investments: strategicInvestments,
        fill_ins: fillIns,
        money_pits: moneyPits,
      },
    };
  }

  /**
   * Approve an idea (can generate contract automatically)
   */
  async approve(ideaId: string, approvedByLoglineId: string): Promise<RegistryIdea> {
    const idea = await this.findOne(ideaId);

    if (idea.status !== 'em_votacao' && idea.status !== 'aguardando_votos') {
      throw new BadRequestException(
        `Idea ${ideaId} cannot be approved. Current status: ${idea.status}`,
      );
    }

    idea.status = 'aprovada';
    idea.data_aprovacao = new Date();

    return this.ideaRepository.save(idea);
  }

  /**
   * Get votes for an idea
   */
  async getVotes(ideaId: string): Promise<RegistryIdeaVote[]> {
    await this.findOne(ideaId); // Verify idea exists

    return this.voteRepository.find({
      where: { idea_id: ideaId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Update idea status
   */
  async updateStatus(ideaId: string, status: IdeaStatus): Promise<RegistryIdea> {
    const idea = await this.findOne(ideaId);
    idea.status = status;
    return this.ideaRepository.save(idea);
  }
}
