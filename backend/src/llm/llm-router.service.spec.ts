import { Test, TestingModule } from '@nestjs/testing';
import { LlmRouterService } from './llm-router.service';

describe('LlmRouterService', () => {
  let service: LlmRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmRouterService],
    }).compile();

    service = module.get<LlmRouterService>(LlmRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have generateText method', () => {
    expect(service.generateText).toBeDefined();
    expect(typeof service.generateText).toBe('function');
  });

  it('should have streamText method', () => {
    expect(service.streamText).toBeDefined();
    expect(typeof service.streamText).toBe('function');
  });
});

