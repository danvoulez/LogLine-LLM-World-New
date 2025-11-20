import { Test, TestingModule } from '@nestjs/testing';
import { TdlnTService } from './tdln-t.service';

describe('TdlnTService', () => {
  let service: TdlnTService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TdlnTService],
    }).compile();

    service = module.get<TdlnTService>(TdlnTService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refract', () => {
    it('should refract simple text into tokens', async () => {
      const text = 'Hello world';
      const result = await service.refract(text);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((token) => {
        expect(token).toHaveProperty('frequency');
        expect(token).toHaveProperty('value');
        expect(token).toHaveProperty('phase');
      });
    });

    it('should handle empty text', async () => {
      const result = await service.refract('');
      expect(result).toEqual([]);
    });

    it('should handle text with special characters', async () => {
      const text = 'Hello, world! @test #hashtag';
      const result = await service.refract(text);

      expect(result.length).toBeGreaterThan(0);
      // Should handle special characters gracefully
      expect(result.some((t) => t.value.includes('@'))).toBe(true);
    });

    it('should throw error for invalid grammar', async () => {
      await expect(service.refract('test', 'invalid_grammar')).rejects.toThrow();
    });
  });

  describe('refractToAtomic', () => {
    it('should refract text to JSON✯Atomic format', async () => {
      const text = 'This is a test message';
      const result = await service.refractToAtomic(text);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('schema_id');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('hash');

      expect(result.type).toBe('text.refracted@1.0.0');
      expect(result.body).toHaveProperty('original_text');
      expect(result.body).toHaveProperty('tokens');
      expect(result.meta.header.status).toBe('APPROVE');
    });

    it('should include language in atomic format', async () => {
      const text = 'Test message';
      const result = await service.refractToAtomic(text, 'en');

      expect(result.body.language).toBeDefined();
    });

    it('should compute hash correctly', async () => {
      const text = 'Test message';
      const result = await service.refractToAtomic(text);

      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBe(64); // SHA-256 hex string
    });
  });

  describe('transmute', () => {
    it('should transmute refracted tokens', async () => {
      const text = 'Hello world';
      const refracted = await service.refract(text);

      const result = await service.transmute(
        refracted,
        'grammar_en_us_strict',
        'grammar_pt_br_strict',
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(refracted.length);
    });

    it('should throw error for invalid grammars', async () => {
      const refracted = await service.refract('test');
      await expect(
        service.transmute(refracted, 'invalid_grammar', 'grammar_pt_br_strict'),
      ).rejects.toThrow();
    });
  });

  describe('project', () => {
    it('should reconstruct text from tokens', async () => {
      const text = 'Hello world';
      const refracted = await service.refract(text);
      const projected = await service.project(refracted);

      expect(projected).toBeDefined();
      expect(typeof projected).toBe('string');
      // Should contain original words (may have spacing differences)
      expect(projected.toLowerCase()).toContain('hello');
    });

    it('should handle empty tokens', async () => {
      const result = await service.project([]);
      expect(result).toBe('');
    });
  });

  describe('translate', () => {
    it('should translate text through full pipeline', async () => {
      const text = 'Hello';
      const result = await service.translate(
        text,
        'grammar_en_us_strict',
        'grammar_pt_br_strict',
      );

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('refracted');
      expect(result).toHaveProperty('transmuted');
      expect(result).toHaveProperty('projected');
      expect(result.original).toBe(text);
    });

    it('should include trace when requested', async () => {
      const text = 'Hello';
      const result = await service.translate(
        text,
        'grammar_en_us_strict',
        'grammar_pt_br_strict',
        true,
      );

      expect(result.trace).toBeDefined();
      expect(result.trace?.refract_stage).toBeDefined();
    });
  });

  describe('isDeterministicTask', () => {
    it('should identify deterministic translation tasks', () => {
      expect(service.isDeterministicTask('translate hello to pt')).toBe(true);
      expect(service.isDeterministicTask('convert text')).toBe(true);
      expect(service.isDeterministicTask('transform data')).toBe(true);
    });

    it('should not identify non-deterministic tasks', () => {
      expect(service.isDeterministicTask('analyze this text')).toBe(false);
      expect(service.isDeterministicTask('what is the meaning')).toBe(false);
    });
  });

  describe('handleDeterministicTask', () => {
    it('should handle simple translation task', async () => {
      const input = 'translate hello from en to pt';
      const result = await service.handleDeterministicTask(input);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('method');
      expect(result.method).toBe('tdln-t');
      expect(result).toHaveProperty('cost');
      expect(result.cost).toBe(0);
    });

    it('should throw error for non-deterministic tasks', async () => {
      await expect(service.handleDeterministicTask('analyze this')).rejects.toThrow();
    });
  });

  describe('getAvailableGrammars', () => {
    it('should return available grammars', () => {
      const grammars = service.getAvailableGrammars();
      expect(Array.isArray(grammars)).toBe(true);
      expect(grammars.length).toBeGreaterThan(0);
    });
  });
});

