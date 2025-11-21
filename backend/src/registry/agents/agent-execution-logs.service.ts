import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AgentExecutionLog, ExecutionStatus } from './entities/agent-execution-log.entity';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';

/**
 * Agent Execution Logs Service
 * 
 * Handles:
 * - Logging agent executions
 * - Execution statistics and analytics
 * - Failure analysis
 * - Performance metrics
 */
@Injectable()
export class AgentExecutionLogsService {
  constructor(
    @InjectRepository(AgentExecutionLog)
    private executionLogRepository: Repository<AgentExecutionLog>,
  ) {}

  /**
   * Create execution log
   */
  async create(dto: CreateExecutionLogDto): Promise<AgentExecutionLog> {
    const log = this.executionLogRepository.create({
      ...dto,
      started_at: new Date(dto.started_at),
      finished_at: dto.finished_at ? new Date(dto.finished_at) : undefined,
    });

    return this.executionLogRepository.save(log);
  }

  /**
   * Update execution log (e.g., when execution finishes)
   */
  async update(
    id: string,
    updates: Partial<{
      finished_at: Date;
      status: ExecutionStatus;
      total_steps: number;
      tools_used: string[];
      cost_cents: number;
      output_summary: string;
      error_message: string;
      error_stack: string;
    }>,
  ): Promise<AgentExecutionLog> {
    const log = await this.executionLogRepository.findOne({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Execution log with ID ${id} not found`);
    }

    Object.assign(log, updates);
    return this.executionLogRepository.save(log);
  }

  /**
   * Find log by execution ID
   */
  async findByExecutionId(executionId: string): Promise<AgentExecutionLog | null> {
    return this.executionLogRepository.findOne({
      where: { execution_id: executionId },
      order: { started_at: 'DESC' },
    });
  }

  /**
   * Get execution statistics for an agent
   */
  async getExecutionStats(
    agentId: string,
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    period: string;
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    success_rate: number;
    avg_cost_cents: number;
    total_cost_cents: number;
    avg_steps: number;
    most_used_tools: Array<{ tool_id: string; count: number }>;
    peak_hours: Array<{ hour: number; count: number }>;
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const logs = await this.executionLogRepository.find({
      where: {
        agent_id: agentId,
        started_at: Between(startDate, now),
      },
    });

    const total = logs.length;
    const successful = logs.filter((l) => l.status === 'success').length;
    const failed = logs.filter((l) => l.status === 'failed').length;

    const costs = logs
      .map((l) => l.cost_cents)
      .filter((c) => c !== null && c !== undefined) as number[];
    const avgCost = costs.length > 0
      ? costs.reduce((sum, c) => sum + c, 0) / costs.length
      : 0;

    const steps = logs
      .map((l) => l.total_steps)
      .filter((s) => s !== null && s !== undefined) as number[];
    const avgSteps = steps.length > 0
      ? steps.reduce((sum, s) => sum + s, 0) / steps.length
      : 0;

    // Most used tools
    const toolCounts: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.tools_used) {
        log.tools_used.forEach((toolId) => {
          toolCounts[toolId] = (toolCounts[toolId] || 0) + 1;
        });
      }
    });

    const mostUsedTools = Object.entries(toolCounts)
      .map(([tool_id, count]) => ({ tool_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Peak hours
    const hourCounts: Record<number, number> = {};
    logs.forEach((log) => {
      const hour = new Date(log.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period,
      total_executions: total,
      successful_executions: successful,
      failed_executions: failed,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      avg_cost_cents: Math.round(avgCost),
      total_cost_cents: costs.reduce((sum, c) => sum + c, 0),
      avg_steps: Math.round(avgSteps),
      most_used_tools: mostUsedTools,
      peak_hours: peakHours,
    };
  }

  /**
   * Get recent failures for debugging
   */
  async getRecentFailures(
    agentId: string,
    limit: number = 10,
  ): Promise<AgentExecutionLog[]> {
    return this.executionLogRepository.find({
      where: {
        agent_id: agentId,
        status: 'failed',
      },
      order: { started_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get execution logs for an agent
   */
  async getExecutionLogs(
    agentId: string,
    filters?: {
      status?: ExecutionStatus;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<AgentExecutionLog[]> {
    const query = this.executionLogRepository.createQueryBuilder('log').where(
      'log.agent_id = :agentId',
      { agentId },
    );

    if (filters?.status) {
      query.andWhere('log.status = :status', { status: filters.status });
    }

    if (filters?.startDate) {
      query.andWhere('log.started_at >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters?.endDate) {
      query.andWhere('log.started_at <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('log.started_at', 'DESC');

    if (filters?.limit) {
      query.take(filters.limit);
    }

    return query.getMany();
  }
}

