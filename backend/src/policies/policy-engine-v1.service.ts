import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Policy, PolicyCondition, PolicyRuleExpr, PolicyEffect } from './entities/policy.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Run } from '../runs/entities/run.entity';
import { Agent } from '../agents/entities/agent.entity';
import { App } from '../apps/entities/app.entity';
import { ObjectsService } from '../registry/objects/objects.service';

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  modifiedContext?: Record<string, any>; // For 'modify' effect
}

export interface PolicyEvaluationContext {
  // Subject
  userId?: string;
  tenantId: string;
  appId?: string;
  role?: string;

  // Action
  action: 'tool_call' | 'run_start' | 'memory_access' | 'workflow_execution';

  // Resource
  toolId?: string;
  workflowId?: string;
  agentId?: string;
  memoryId?: string;

  // Context
  runId?: string;
  mode?: 'draft' | 'auto';
  riskLevel?: 'low' | 'medium' | 'high';
  [key: string]: any; // Additional context fields
}

@Injectable()
export class PolicyEngineV1Service {
  private readonly logger = new Logger(PolicyEngineV1Service.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(App)
    private appRepository: Repository<App>,
    private objectsService: ObjectsService,
  ) {}

  /**
   * Evaluate all applicable policies for a given context
   * Returns the final decision (allow/deny/require_approval/modify)
   */
  async evaluatePolicies(context: PolicyEvaluationContext): Promise<PolicyDecision> {
    // Load all applicable policies
    const policies = await this.loadApplicablePolicies(context);

    if (policies.length === 0) {
      // No policies → default allow
      return { allowed: true };
    }

    // Sort by priority (lower = higher priority)
    policies.sort((a, b) => a.priority - b.priority);

    // Evaluate each policy in priority order
    for (const policy of policies) {
      const matches = this.evaluatePolicyRule(policy.rule_expr, context);

      if (matches) {
        // Policy matched → apply effect
        await this.logPolicyDecision(context.runId, policy.id, policy.effect, context);

        switch (policy.effect) {
          case 'allow':
            return { allowed: true, reason: `Policy "${policy.name}" allows this action` };

          case 'deny':
            return {
              allowed: false,
              reason: `Policy "${policy.name}" denies this action`,
            };

          case 'require_approval':
            return {
              allowed: false,
              requiresApproval: true,
              reason: `Policy "${policy.name}" requires human approval`,
            };

          case 'modify':
            // Modify can only change control fields (mode, limits, flags)
            const modifiedContext = this.applyModifyEffect(policy.rule_expr, context);
            return {
              allowed: true,
              reason: `Policy "${policy.name}" modified context`,
              modifiedContext,
            };

          default:
            this.logger.warn(`Unknown policy effect: ${policy.effect}`);
        }
      }
    }

    // No policy matched → default allow
    return { allowed: true };
  }

  /**
   * Check if a tool call is allowed
   */
  async checkToolCall(
    toolId: string,
    context: {
      runId: string;
      appId?: string;
      userId?: string;
      tenantId: string;
    },
  ): Promise<PolicyDecision> {
    // Load tool and run for context
    const tool = await this.toolRepository.findOne({ where: { id: toolId } });
    const run = await this.runRepository.findOne({ where: { id: context.runId } });

    if (!tool || !run) {
      return {
        allowed: false,
        reason: `Tool ${toolId} or run ${context.runId} not found`,
      };
    }

    // Get risk_level from tool entity (now a direct column)
    const riskLevel = tool.risk_level || 'low';

    const evaluationContext: PolicyEvaluationContext = {
      userId: context.userId,
      tenantId: context.tenantId,
      appId: context.appId,
      action: 'tool_call',
      toolId,
      runId: context.runId,
      mode: run.mode,
      riskLevel,
    };

    return this.evaluatePolicies(evaluationContext);
  }

  /**
   * Check if an agent can be called
   */
  async checkAgentCall(
    agentId: string,
    context: {
      runId: string;
      appId?: string;
      userId?: string;
      tenantId: string;
      toolId?: string; // For contract scope enforcement
      costCents?: number; // For contract scope enforcement
      llmCallsCount?: number; // For contract scope enforcement
    },
  ): Promise<PolicyDecision> {
    // Load agent and run for context
    const agent = await this.agentRepository.findOne({ where: { id: agentId } });
    const run = await this.runRepository.findOne({ where: { id: context.runId } });

    if (!agent || !run) {
      return {
        allowed: false,
        reason: `Agent ${agentId} or run ${context.runId} not found`,
      };
    }

    // First, check agent contract scope if agent has active contract
    if (agent.active_contract_id && agent.contract_scope) {
      const contractCheck = this.checkAgentContractScope(agent, context);
      if (!contractCheck.allowed) {
        return contractCheck;
      }
    }

    const evaluationContext: PolicyEvaluationContext = {
      userId: context.userId,
      tenantId: context.tenantId,
      appId: context.appId,
      action: 'workflow_execution', // Agent calls are part of workflow execution
      agentId,
      runId: context.runId,
      mode: run.mode,
    };

    return this.evaluatePolicies(evaluationContext);
  }

  /**
   * Check if agent action complies with contract scope
   */
  private checkAgentContractScope(
    agent: Agent,
    context: {
      toolId?: string;
      costCents?: number;
      llmCallsCount?: number;
      workflowId?: string;
      action?: string;
    },
  ): PolicyDecision {
    if (!agent.contract_scope) {
      return { allowed: true };
    }

    const scope = agent.contract_scope;

    // Check allowed tools
    if (context.toolId && scope.allowed_tools) {
      if (!scope.allowed_tools.includes(context.toolId)) {
        return {
          allowed: false,
          reason: `Tool ${context.toolId} not allowed by agent contract. Allowed tools: ${scope.allowed_tools.join(', ')}`,
        };
      }
    }

    // Check max cost per run
    if (context.costCents !== undefined && scope.max_cost_per_run_cents !== undefined) {
      if (context.costCents > scope.max_cost_per_run_cents) {
        return {
          allowed: false,
          reason: `Cost ${context.costCents} cents exceeds contract limit of ${scope.max_cost_per_run_cents} cents per run`,
        };
      }
    }

    // Check max LLM calls per run
    if (context.llmCallsCount !== undefined && scope.max_llm_calls_per_run !== undefined) {
      if (context.llmCallsCount > scope.max_llm_calls_per_run) {
        return {
          allowed: false,
          reason: `LLM calls count ${context.llmCallsCount} exceeds contract limit of ${scope.max_llm_calls_per_run} per run`,
        };
      }
    }

    // Check allowed workflows
    if (context.workflowId && scope.allowed_workflows) {
      if (!scope.allowed_workflows.includes(context.workflowId)) {
        return {
          allowed: false,
          reason: `Workflow ${context.workflowId} not allowed by agent contract. Allowed workflows: ${scope.allowed_workflows.join(', ')}`,
        };
      }
    }

    // Check restricted actions
    if (context.action && scope.restricted_actions) {
      if (scope.restricted_actions.includes(context.action)) {
        return {
          allowed: false,
          reason: `Action ${context.action} is restricted by agent contract`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a run can start
   */
  async checkRunStart(
    workflowId: string,
    context: {
      appId?: string;
      userId?: string;
      tenantId: string;
      mode?: 'draft' | 'auto';
      input?: Record<string, any>;
    },
  ): Promise<PolicyDecision> {
    const evaluationContext: PolicyEvaluationContext = {
      userId: context.userId,
      tenantId: context.tenantId,
      appId: context.appId,
      action: 'run_start',
      workflowId,
      mode: context.mode || 'draft',
      input: context.input,
    };

    return this.evaluatePolicies(evaluationContext);
  }

  /**
   * Check access to a Registry Object (Ownership-Based Access Control - OBAC)
   */
  async checkObjectAccess(
    objectId: string,
    loglineId: string, // Must be the LogLine ID (not Auth User ID)
    action: 'read' | 'write' | 'transfer',
    context: {
      runId?: string;
      appId?: string;
      tenantId: string;
    },
  ): Promise<PolicyDecision> {
    // 1. Check Object Ownership/Custody
    try {
      const object = await this.objectsService.findOne(objectId);
      
      // If user is owner or custodian, ALLOW (implicit permission)
      if (
        object.owner_logline_id === loglineId ||
        object.current_custodian_logline_id === loglineId
      ) {
        return {
          allowed: true,
          reason: `User ${loglineId} is owner or custodian of object ${objectId}`,
        };
      }

      // If object is public or tenant-visible (and user in tenant)
      if (action === 'read') {
        if (object.visibility === 'public') {
          return { allowed: true, reason: 'Object is public' };
        }
        if (object.visibility === 'tenant' && object.tenant_id === context.tenantId) {
          return { allowed: true, reason: 'Object is visible to tenant' };
        }
      }
    } catch (error) {
      // Object not found or error
      return { allowed: false, reason: `Object ${objectId} not found` };
    }

    // 2. Fallback to Policy Evaluation (RBAC/ABAC)
    const evaluationContext: PolicyEvaluationContext = {
      userId: loglineId, // Treating LogLine ID as user ID for policy context
      tenantId: context.tenantId,
      appId: context.appId,
      action: 'memory_access', // Mapping object access to memory_access type for now, or add new type
      resourceId: objectId, // Generic resource ID
      runId: context.runId,
      loglineId, // Explicit field
    };

    return this.evaluatePolicies(evaluationContext);
  }

  /**
   * Load all applicable policies for a given context
   */
  private async loadApplicablePolicies(context: PolicyEvaluationContext): Promise<Policy[]> {
    const scopes: Array<{ scope: string; scope_id?: string }> = [
      { scope: 'global' }, // Always check global policies
    ];

    // Add tenant-scoped policies
    if (context.tenantId) {
      scopes.push({ scope: 'tenant', scope_id: context.tenantId });
    }

    // Add app-scoped policies
    if (context.appId) {
      scopes.push({ scope: 'app', scope_id: context.appId });
    }

    // Add tool-scoped policies
    if (context.toolId) {
      scopes.push({ scope: 'tool', scope_id: context.toolId });
    }

    // Add workflow-scoped policies
    if (context.workflowId) {
      scopes.push({ scope: 'workflow', scope_id: context.workflowId });
    }

    // Add agent-scoped policies
    if (context.agentId) {
      scopes.push({ scope: 'agent', scope_id: context.agentId });
    }

    // Build query using OR conditions for multiple scopes
    // TypeORM supports array of WHERE conditions for OR logic
    const whereConditions = scopes.map((s) => {
      const condition: any = {
        scope: s.scope,
        enabled: true,
      };
      if (s.scope_id) {
        condition.scope_id = s.scope_id;
      } else {
        // For global scope, scope_id should be null
        condition.scope_id = null;
      }
      return condition;
    });

    const policies = await this.policyRepository.find({
      where: whereConditions,
    });

    return policies;
  }

  /**
   * Evaluate a single policy rule expression
   */
  private evaluatePolicyRule(ruleExpr: PolicyRuleExpr, context: PolicyEvaluationContext): boolean {
    const { conditions, logic = 'AND' } = ruleExpr;

    if (conditions.length === 0) {
      return true; // Empty rule matches everything
    }

    const results = conditions.map((condition) => this.evaluateCondition(condition, context));

    if (logic === 'OR') {
      return results.some((r) => r);
    } else {
      // AND (default)
      return results.every((r) => r);
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
    const { field, operator, value } = condition;

    // Resolve field value from context
    const fieldValue = this.resolveFieldValue(field, context);

    switch (operator) {
      case 'equals':
        return fieldValue === value;

      case 'not_equals':
        return fieldValue !== value;

      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);

      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);

      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > value;

      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < value;

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);

      case 'starts_with':
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);

      case 'ends_with':
        return typeof fieldValue === 'string' && fieldValue.endsWith(value);

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        this.logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Resolve field value from context using dot notation
   * e.g., 'tool.risk_level' → context.tool?.risk_level
   */
  private resolveFieldValue(field: string, context: PolicyEvaluationContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Apply 'modify' effect (can only modify control fields)
   */
  private applyModifyEffect(ruleExpr: PolicyRuleExpr, context: PolicyEvaluationContext): Record<string, any> {
    // Extract modify instructions from rule_expr
    // For now, this is a placeholder - modify effects would need special handling
    // In v1, modify can only change: mode, limits, flags
    const modified: Record<string, any> = {};

    // Example: if rule contains modify instructions, apply them
    // This would need to be extended based on actual modify DSL
    if (ruleExpr.conditions.some((c) => c.field === 'mode')) {
      const modeCondition = ruleExpr.conditions.find((c) => c.field === 'mode');
      if (modeCondition && modeCondition.operator === 'equals') {
        modified.mode = modeCondition.value;
      }
    }

    return modified;
  }

  /**
   * Log policy decision as event
   */
  private async logPolicyDecision(
    runId: string | undefined,
    policyId: string,
    effect: PolicyEffect,
    context: PolicyEvaluationContext,
  ): Promise<void> {
    if (!runId) {
      return; // Can't log without runId
    }

    await this.eventRepository.save({
      run_id: runId,
      kind: EventKind.POLICY_EVAL,
      payload: {
        policy_id: policyId,
        effect,
        action: context.action,
        tool_id: context.toolId,
        workflow_id: context.workflowId,
        app_id: context.appId,
        user_id: context.userId,
        tenant_id: context.tenantId,
        policy_engine: 'v1',
      },
    });
  }
}

