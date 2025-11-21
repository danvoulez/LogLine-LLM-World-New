import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, NotFoundException } from 'typeorm';
import { FilesService } from './files.service';
import { File } from './entities/file.entity';
import { CreateFileDto } from './dto/create-file.dto';

describe('FilesService', () => {
  let service: FilesService;
  let fileRepository: Repository<File>;

  const mockFileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(File),
          useValue: mockFileRepository,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    fileRepository = module.get<Repository<File>>(getRepositoryToken(File));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a file', async () => {
      const createDto: CreateFileDto = {
        path: 'test/file.txt',
        content: 'Hello World',
      };

      const mockFile = {
        id: 'file-123',
        path: 'test/file.txt',
        content: 'Hello World',
        size: 11,
      };

      mockFileRepository.create.mockReturnValue(mockFile);
      mockFileRepository.save.mockResolvedValue(mockFile);

      const result = await service.create(createDto);

      expect(result.path).toBe(createDto.path);
      expect(result.size).toBe(11);
      expect(mockFileRepository.create).toHaveBeenCalled();
      expect(mockFileRepository.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a file by id', async () => {
      const mockFile = {
        id: 'file-123',
        path: 'test/file.txt',
        content: 'Hello World',
      };

      mockFileRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findOne('file-123');

      expect(result).toEqual(mockFile);
      expect(mockFileRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      });
    });

    it('should throw NotFoundException if file not found', async () => {
      mockFileRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRun', () => {
    it('should return files for a run', async () => {
      const mockFiles = [
        { id: 'file-1', path: 'test1.txt', run_id: 'run-123' },
        { id: 'file-2', path: 'test2.txt', run_id: 'run-123' },
      ];

      mockFileRepository.find.mockResolvedValue(mockFiles);

      const result = await service.findByRun('run-123');

      expect(result).toEqual(mockFiles);
      expect(mockFileRepository.find).toHaveBeenCalledWith({
        where: { run_id: 'run-123' },
        order: { path: 'ASC' },
      });
    });
  });

  describe('findByApp', () => {
    it('should return files for an app', async () => {
      const mockFiles = [
        { id: 'file-1', path: 'test1.txt', app_id: 'app-123' },
      ];

      mockFileRepository.find.mockResolvedValue(mockFiles);

      const result = await service.findByApp('app-123');

      expect(result).toEqual(mockFiles);
      expect(mockFileRepository.find).toHaveBeenCalledWith({
        where: { app_id: 'app-123' },
        order: { path: 'ASC' },
      });
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      const mockFile = {
        id: 'file-123',
        path: 'test/file.txt',
      };

      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockFileRepository.remove.mockResolvedValue(mockFile);

      await service.delete('file-123');

      expect(mockFileRepository.findOne).toHaveBeenCalledWith({ where: { id: 'file-123' } });
      expect(mockFileRepository.remove).toHaveBeenCalledWith(mockFile);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockFileRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

