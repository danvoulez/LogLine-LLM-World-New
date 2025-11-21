import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RunsService } from './runs.service';
import { Run, RunStatus } from './entities/run.entity';
import { Step } from './entities/step.entity';
import { Event } from './entities/event.entity';
import { NotFoundException } from '@nestjs/common';

describe('RunsService', () => {
  let service: RunsService;
  let runRepository: Repository<Run>;
  let stepRepository: Repository<Step>;
  let eventRepository: Repository<Event>;

  const mockRunRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockStepRepository = {
    find: jest.fn(),
  };

  const mockEventRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunsService,
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Step),
          useValue: mockStepRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
      ],
    }).compile();

    service = module.get<RunsService>(RunsService);
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    stepRepository = module.get<Repository<Step>>(getRepositoryToken(Step));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return a run by id', async () => {
      const mockRun = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: RunStatus.COMPLETED,
        steps: [],
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);

      const result = await service.findOne('run-123');

      expect(result.id).toBe('run-123');
      expect(result.workflow_id).toBe('workflow-123');
      expect(mockRunRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        relations: ['steps'],
      });
    });

    it('should throw NotFoundException if run not found', async () => {
      mockRunRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a run', async () => {
      const updateDto = { status: RunStatus.COMPLETED };
      const mockRun = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: RunStatus.COMPLETED,
      };

      mockRunRepository.update = jest.fn().mockResolvedValue({ affected: 1 });
      mockRunRepository.findOne.mockResolvedValue(mockRun);

      const result = await service.update('run-123', updateDto);

      expect(result).toEqual(mockRun);
      expect(mockRunRepository.update).toHaveBeenCalledWith('run-123', updateDto);
    });
  });

  describe('findEvents', () => {
    it('should return events for a run', async () => {
      const mockEvents = [
        { id: 'event-1', run_id: 'run-123', kind: 'run_started', ts: new Date() },
        { id: 'event-2', run_id: 'run-123', kind: 'step_started', ts: new Date() },
      ];

      mockEventRepository.find.mockResolvedValue(mockEvents);

      const result = await service.findEvents('run-123');

      expect(result.length).toBe(2);
      expect(mockEventRepository.find).toHaveBeenCalledWith({
        where: { run_id: 'run-123' },
        order: { ts: 'ASC' },
      });
    });
  });
});

