import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { NotFoundException } from '@nestjs/common';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: FilesService;

  const mockFilesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: getRepositoryToken(File),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a file', async () => {
      const createDto = {
        path: 'test/file.txt',
        content: 'Hello World',
      };

      const mockFile = {
        id: 'file-123',
        ...createDto,
        size: 11,
      };

      mockFilesService.create.mockResolvedValue(mockFile);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockFile);
      expect(mockFilesService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findOne', () => {
    it('should return a file by id', async () => {
      const mockFile = { id: 'file-123', path: 'test/file.txt' };

      mockFilesService.findOne.mockResolvedValue(mockFile);

      const result = await controller.findOne('file-123');

      expect(result).toEqual(mockFile);
      expect(mockFilesService.findOne).toHaveBeenCalledWith('file-123');
    });
  });

  describe('findByRun', () => {
    it('should return files for a run', async () => {
      const mockFiles = [{ id: 'file-1', run_id: 'run-123' }];

      mockFilesService.findByRun = jest.fn().mockResolvedValue(mockFiles);

      const result = await controller.findByRun('run-123');

      expect(result).toEqual(mockFiles);
      expect(mockFilesService.findByRun).toHaveBeenCalledWith('run-123');
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      mockFilesService.delete = jest.fn().mockResolvedValue(undefined);

      await controller.delete('file-123');

      expect(mockFilesService.delete).toHaveBeenCalledWith('file-123');
    });
  });
});

