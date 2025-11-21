import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy, PolicyScope } from './entities/policy.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
  ) {}

  async create(createPolicyDto: CreatePolicyDto): Promise<Policy> {
    // Validate rule_expr structure
    this.validateRuleExpr(createPolicyDto.rule_expr);

    const policy = this.policyRepository.create({
      ...createPolicyDto,
      priority: createPolicyDto.priority ?? 100,
      enabled: createPolicyDto.enabled ?? true,
    });
    return this.policyRepository.save(policy);
  }

  async findAll(filters?: {
    scope?: PolicyScope;
    scope_id?: string;
    enabled?: boolean;
  }): Promise<Policy[]> {
    const where: any = {};

    if (filters?.scope) {
      where.scope = filters.scope;
    }

    if (filters?.scope_id !== undefined) {
      where.scope_id = filters.scope_id;
    }

    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    return this.policyRepository.find({
      where,
      order: { priority: 'ASC', created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Policy> {
    const policy = await this.policyRepository.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
    return policy;
  }

  async update(id: string, updatePolicyDto: UpdatePolicyDto): Promise<Policy> {
    const policy = await this.findOne(id);

    // Validate rule_expr if provided
    if (updatePolicyDto.rule_expr) {
      this.validateRuleExpr(updatePolicyDto.rule_expr);
    }

    Object.assign(policy, updatePolicyDto);
    return this.policyRepository.save(policy);
  }

  async remove(id: string): Promise<void> {
    const policy = await this.findOne(id);
    await this.policyRepository.remove(policy);
  }

  /**
   * Validate rule expression structure
   */
  private validateRuleExpr(ruleExpr: any): void {
    if (!ruleExpr || typeof ruleExpr !== 'object') {
      throw new BadRequestException('rule_expr must be an object');
    }

    if (!Array.isArray(ruleExpr.conditions)) {
      throw new BadRequestException('rule_expr.conditions must be an array');
    }

    if (ruleExpr.conditions.length === 0) {
      throw new BadRequestException('rule_expr.conditions cannot be empty');
    }

    for (const condition of ruleExpr.conditions) {
      if (!condition.field || typeof condition.field !== 'string') {
        throw new BadRequestException('Each condition must have a field (string)');
      }

      if (!condition.operator || typeof condition.operator !== 'string') {
        throw new BadRequestException('Each condition must have an operator (string)');
      }

      const validOperators = [
        'equals',
        'not_equals',
        'in',
        'not_in',
        'greater_than',
        'less_than',
        'contains',
        'starts_with',
        'ends_with',
        'exists',
        'not_exists',
      ];

      if (!validOperators.includes(condition.operator)) {
        throw new BadRequestException(
          `Invalid operator: ${condition.operator}. Valid operators: ${validOperators.join(', ')}`,
        );
      }
    }

    if (ruleExpr.logic && !['AND', 'OR'].includes(ruleExpr.logic)) {
      throw new BadRequestException('rule_expr.logic must be "AND" or "OR"');
    }
  }
}

