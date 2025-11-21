import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IdeasService } from './ideas.service';
import { RegistryIdea } from './entities/registry-idea.entity';
import { RegistryIdeaVote } from './entities/registry-idea-vote.entity';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { VoteIdeaDto } from './dto/vote-idea.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IdeasService', () => {
  let service: IdeasService;
  let ideaRepository: Repository<RegistryIdea>;
  let voteRepository: Repository<RegistryIdeaVote>;
  let dataSource: DataSource;

  const mockIdeaRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockVoteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdeasService,
        {
          provide: getRepositoryToken(RegistryIdea),
          useValue: mockIdeaRepository,
        },
        {
          provide: getRepositoryToken(RegistryIdeaVote),
          useValue: mockVoteRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<IdeasService>(IdeasService);
    ideaRepository = module.get<Repository<RegistryIdea>>(
      getRepositoryToken(RegistryIdea),
    );
    voteRepository = module.get<Repository<RegistryIdeaVote>>(
      getRepositoryToken(RegistryIdeaVote),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new idea', async () => {
      const dto: CreateIdeaDto = {
        tenant_id: 'tenant-123',
        titulo: 'Implement CRM',
        descricao: 'New CRM system',
        autor_logline_id: 'LL-BR-2024-000000001',
        prioridade_autor: 9,
        custo_estimado_cents: 1500000, // 15000.00
      };

      const idea = {
        id: 'idea-123',
        ...dto,
        status: 'aguardando_votos',
        moeda: 'BRL',
        periodo_votacao_dias: 7,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockIdeaRepository.create.mockReturnValue(idea);
      mockIdeaRepository.save.mockResolvedValue(idea);

      const result = await service.create(dto);

      expect(result).toEqual(idea);
      expect(result.status).toBe('aguardando_votos');
    });
  });

  describe('vote', () => {
    it('should create a new vote', async () => {
      const idea = {
        id: 'idea-123',
        status: 'aguardando_votos',
        prioridade_autor: 9,
        periodo_votacao_dias: 7,
        votes: [],
      };

      const voteDto: VoteIdeaDto = {
        prioridade: 8,
        comentario: 'Great idea',
        peso: 1.0,
      };

      const vote = {
        id: 'vote-123',
        idea_id: 'idea-123',
        voter_logline_id: 'LL-BR-2024-000000002',
        ...voteDto,
      };

      mockIdeaRepository.findOne.mockResolvedValue(idea);
      mockVoteRepository.findOne.mockResolvedValue(null);
      mockVoteRepository.create.mockReturnValue(vote);
      mockVoteRepository.save.mockResolvedValue(vote);
      mockVoteRepository.find.mockResolvedValue([vote]);
      mockIdeaRepository.save.mockResolvedValue({
        ...idea,
        status: 'em_votacao',
        prioridade_consensual: 8,
      });

      const result = await service.vote('idea-123', 'LL-BR-2024-000000002', voteDto);

      expect(result.vote).toEqual(vote);
      expect(result.idea.status).toBe('em_votacao');
    });

    it('should update existing vote', async () => {
      const idea = {
        id: 'idea-123',
        status: 'em_votacao',
        prioridade_autor: 9,
      };

      const existingVote = {
        id: 'vote-123',
        idea_id: 'idea-123',
        voter_logline_id: 'LL-BR-2024-000000002',
        prioridade: 7,
      };

      const voteDto: VoteIdeaDto = {
        prioridade: 8,
        comentario: 'Updated vote',
      };

      mockIdeaRepository.findOne.mockResolvedValue(idea);
      mockVoteRepository.findOne.mockResolvedValue(existingVote);
      mockVoteRepository.save.mockResolvedValue({
        ...existingVote,
        ...voteDto,
      });
      mockVoteRepository.find.mockResolvedValue([
        { ...existingVote, ...voteDto },
      ]);
      mockIdeaRepository.save.mockResolvedValue({
        ...idea,
        prioridade_consensual: 8,
      });

      const result = await service.vote('idea-123', 'LL-BR-2024-000000002', voteDto);

      expect(result.vote.prioridade).toBe(8);
    });
  });

  describe('recalculateConsensusPriority', () => {
    it('should calculate weighted average priority', async () => {
      const votes = [
        { prioridade: 8, peso: 1.0 },
        { prioridade: 9, peso: 1.5 },
        { prioridade: 7, peso: 1.0 },
      ];

      const idea = {
        id: 'idea-123',
        prioridade_autor: 9,
        prioridade_consensual: null,
      };

      mockVoteRepository.find.mockResolvedValue(votes);
      mockIdeaRepository.findOne.mockResolvedValue(idea);
      mockIdeaRepository.save.mockResolvedValue({
        ...idea,
        prioridade_consensual: 8.14, // (8*1 + 9*1.5 + 7*1) / (1 + 1.5 + 1)
      });

      await service.recalculateConsensusPriority('idea-123');

      expect(mockIdeaRepository.save).toHaveBeenCalled();
    });
  });

  describe('getCostPriorityMatrix', () => {
    it('should return cost vs priority matrix', async () => {
      const ideas = [
        {
          id: 'idea-1',
          titulo: 'Quick Win',
          custo_estimado_cents: 100000, // 1000.00
          prioridade_consensual: 9,
          status: 'em_votacao',
        },
        {
          id: 'idea-2',
          titulo: 'Strategic',
          custo_estimado_cents: 5000000, // 50000.00
          prioridade_consensual: 8,
          status: 'em_votacao',
        },
      ];

      mockIdeaRepository.find.mockResolvedValue(ideas);

      const result = await service.getCostPriorityMatrix('tenant-123');

      expect(result.ideas).toHaveLength(2);
      expect(result.quadrants).toHaveProperty('quick_wins');
      expect(result.quadrants).toHaveProperty('strategic_investments');
    });
  });

  describe('approve', () => {
    it('should approve an idea', async () => {
      const idea = {
        id: 'idea-123',
        status: 'em_votacao',
        data_aprovacao: null,
      };

      mockIdeaRepository.findOne.mockResolvedValue(idea);
      mockIdeaRepository.save.mockResolvedValue({
        ...idea,
        status: 'aprovada',
        data_aprovacao: expect.any(Date),
      });

      const result = await service.approve('idea-123', 'LL-BR-2024-000000001');

      expect(result.status).toBe('aprovada');
      expect(result.data_aprovacao).toBeDefined();
    });

    it('should throw BadRequestException if idea cannot be approved', async () => {
      const idea = {
        id: 'idea-123',
        status: 'concluida',
      };

      mockIdeaRepository.findOne.mockResolvedValue(idea);

      await expect(
        service.approve('idea-123', 'LL-BR-2024-000000001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

