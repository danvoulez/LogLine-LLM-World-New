import { Test, TestingModule } from '@nestjs/testing';
import { LogLineIdService } from './logline-id.service';

describe('LogLineIdService', () => {
  let service: LogLineIdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogLineIdService],
    }).compile();

    service = module.get<LogLineIdService>(LogLineIdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePersonId', () => {
    it('should generate a valid LogLine ID for a person', () => {
      const cpf = '123.456.789-00';
      const year = 2024;
      const sequential = 1;

      const id = service.generatePersonId(cpf, year, sequential);

      // Format: LL-BR-2024-000000001-XX
      expect(id).toMatch(/^LL-BR-2024-000000001-[A-F0-9]{2}$/);
    });

    it('should generate consistent checksums for the same inputs', () => {
      const cpf = '123.456.789-00';
      const id1 = service.generatePersonId(cpf, 2024, 1);
      const id2 = service.generatePersonId(cpf, 2024, 1);

      expect(id1).toBe(id2);
    });

    it('should generate different checksums for different CPFs', () => {
      const id1 = service.generatePersonId('123.456.789-00', 2024, 1);
      const id2 = service.generatePersonId('987.654.321-00', 2024, 1);

      const checksum1 = id1.split('-')[4];
      const checksum2 = id2.split('-')[4];

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('generateAgentId', () => {
    it('should generate a valid LogLine ID for an agent', () => {
      const agentId = 'agent.test';
      const year = 2024;
      const sequential = 1;

      const id = service.generateAgentId(agentId, year, sequential);

      // Format: LL-AGENT-2024-000000001-XX
      expect(id).toMatch(/^LL-AGENT-2024-000000001-[A-F0-9]{2}$/);
    });
  });

  describe('validateLogLineId', () => {
    it('should return true for a valid ID and correct secret', () => {
      const cpf = '123.456.789-00';
      const id = service.generatePersonId(cpf, 2024, 1);

      const isValid = service.validateLogLineId(id, cpf);
      expect(isValid).toBe(true);
    });

    it('should return false for a valid ID but wrong secret', () => {
      const cpf = '123.456.789-00';
      const wrongCpf = '999.999.999-99';
      const id = service.generatePersonId(cpf, 2024, 1);

      const isValid = service.validateLogLineId(id, wrongCpf);
      expect(isValid).toBe(false);
    });

    it('should return false for a modified checksum', () => {
      const cpf = '123.456.789-00';
      const id = service.generatePersonId(cpf, 2024, 1);
      
      const parts = id.split('-');
      parts[4] = 'FF'; // Tampered checksum
      const tamperedId = parts.join('-');

      const isValid = service.validateLogLineId(tamperedId, cpf);
      expect(isValid).toBe(false);
    });

    it('should return false for malformed IDs', () => {
      expect(service.validateLogLineId('invalid-id', 'secret')).toBe(false);
      expect(service.validateLogLineId('LL-BR-2024-1', 'secret')).toBe(false);
    });
  });

  describe('extractBaseId', () => {
    it('should extract base ID without checksum', () => {
      const id = 'LL-BR-2024-000000001-A3';
      const base = service.extractBaseId(id);
      expect(base).toBe('LL-BR-2024-000000001');
    });

    it('should return ID as-is if it does not have checksum format', () => {
      const id = 'LL-BR-2024-000000001'; // Old format
      const base = service.extractBaseId(id);
      expect(base).toBe(id);
    });
  });
});

