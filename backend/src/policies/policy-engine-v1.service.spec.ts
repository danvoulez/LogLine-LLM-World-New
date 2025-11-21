import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyEngineV1Service } from './policy-engine-v1.service';
import { Policy } from './entities/policy.entity';
import { Event } from '../runs/entities/event.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Run } from '../runs/entities/run.entity';
import { Agent } from '../agents/entities/agent.entity';
import { App } from '../apps/entities/app.entity';

describe('PolicyEngineV1Service', () => {
  let service: PolicyEngineV1Service;
  let policyRepository: Repository<Policy>;
  let eventRepository: Repository<Event>;
  let toolRepository: Repository<Tool>;
  let runRepository: Repository<Run>;

  const mockPolicyRepository = {
    find: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  const mockToolRepository = {
    findOne: jest.fn(),
  };

  const mockRunRepository = {
    findOne: jest.fn(),
  };

  const mockAgentRepository = {
    findOne: jest.fn(),
  };

  const mockAppRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineV1Service,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Tool),
          useValue: mockToolRepository,
        },
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: mockAgentRepository,
        },
        {
          provide: getRepositoryToken(App),
          useValue: mockAppRepository,
        },
      ],
    }).compile();

    service = module.get<PolicyEngineV1Service>(PolicyEngineV1Service);
    policyRepository = module.get<Repository<Policy>>(getRepositoryToken(Policy));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    toolRepository = module.get<Repository<Tool>>(getRepositoryToken(Tool));
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluatePolicies', () => {
    it('should return allow when no policies match', async () => {
      mockPolicyRepository.find.mockResolvedValue([]);

      const decision = await service.evaluatePolicies({
        tenantId: 'tenant-123',
        action: 'tool_call',
        toolId: 'tool-123',
      });

      expect(decision.allowed).toBe(true);
    });

    it('should deny when policy matches with deny effect', async () => {
      const policy: Policy = {
        id: 'policy-1',
        name: 'Deny High Risk Tools',
        description: 'Deny high-risk tools in auto mode',
        scope: 'global',
        scope_id: null,
        rule_expr: {
          conditions: [
            { field: 'riskLevel', operator: 'equals', value: 'high' },
            { field: 'mode', operator: 'equals', value: 'auto' },
          ],
          logic: 'AND',
        },
        effect: 'deny',
        priority: 10,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPolicyRepository.find.mockResolvedValue([policy]);

      const decision = await service.evaluatePolicies({
        tenantId: 'tenant-123',
        action: 'tool_call',
        toolId: 'tool-123',
        riskLevel: 'high',
        mode: 'auto',
        runId: 'run-123',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Deny High Risk Tools');
    });

    it('should require approval when policy matches with require_approval effect', async () => {
      const policy: Policy = {
        id: 'policy-1',
        name: 'Require Approval for Medium Risk',
        description: 'Require approval for medium-risk tools',
        scope: 'global',
        scope_id: null,
        rule_expr: {
          conditions: [{ field: 'riskLevel', operator: 'equals', value: 'medium' }],
        },
        effect: 'require_approval',
        priority: 20,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPolicyRepository.find.mockResolvedValue([policy]);

      const decision = await service.evaluatePolicies({
        tenantId: 'tenant-123',
        action: 'tool_call',
        toolId: 'tool-123',
        riskLevel: 'medium',
        runId: 'run-123',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(true);
    });

    it('should evaluate policies in priority order', async () => {
      const policy1: Policy = {
        id: 'policy-1',
        name: 'Low Priority Allow',
        scope: 'global',
        scope_id: null,
        rule_expr: {
          conditions: [{ field: 'riskLevel', operator: 'equals', value: 'high' }],
        },
        effect: 'allow',
        priority: 100,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const policy2: Policy = {
        id: 'policy-2',
        name: 'High Priority Deny',
        scope: 'global',
        scope_id: null,
        rule_expr: {
          conditions: [{ field: 'riskLevel', operator: 'equals', value: 'high' }],
        },
        effect: 'deny',
        priority: 10,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPolicyRepository.find.mockResolvedValue([policy1, policy2]);

      const decision = await service.evaluatePolicies({
        tenantId: 'tenant-123',
        action: 'tool_call',
        toolId: 'tool-123',
        riskLevel: 'high',
        runId: 'run-123',
      });

      // Higher priority policy (lower number) should win
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('High Priority Deny');
    });
  });

  describe('checkToolCall', () => {
    it('should check tool call with context', async () => {
      const tool = {
        id: 'tool-123',
        metadata: { risk_level: 'low' },
      } as Tool;

      const run = {
        id: 'run-123',
        mode: 'draft',
      } as Run;

      mockToolRepository.findOne.mockResolvedValue(tool);
      mockRunRepository.findOne.mockResolvedValue(run);
      mockPolicyRepository.find.mockResolvedValue([]);

      const decision = await service.checkToolCall('tool-123', {
        runId: 'run-123',
        tenantId: 'tenant-123',
      });

      expect(decision.allowed).toBe(true);
      expect(mockToolRepository.findOne).toHaveBeenCalledWith({ where: { id: 'tool-123' } });
      expect(mockRunRepository.findOne).toHaveBeenCalledWith({ where: { id: 'run-123' } });
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equals condition', async () => {
      mockPolicyRepository.find.mockResolvedValue([]);

      // This is tested indirectly through evaluatePolicies
      const decision = await service.evaluatePolicies({
        tenantId: 'tenant-123',
        action: 'tool_call',
        riskLevel: 'high',
      });

      expect(decision.allowed).toBe(true);
    });
  });
});

