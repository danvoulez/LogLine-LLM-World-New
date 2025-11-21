import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { CreateFileDto } from './dto/create-file.dto';
import { normalizeAndValidatePath } from '../common/utils/path-validator.util';

// Maximum file size: 10MB (for serverless memory constraints)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const WARN_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB (warn above this)

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {}

  async create(createFileDto: CreateFileDto): Promise<File> {
    // Path validation is done in DTO via class-validator
    // Normalize path for consistency
    const normalizedPath = normalizeAndValidatePath(createFileDto.path);
    
    // Calculate actual file size
    const fileSize = Buffer.byteLength(createFileDto.content, 'utf8');
    
    // Validate file size
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size (${(fileSize / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. ` +
        `For large files, consider using Vercel Blob Storage or AWS S3 and storing only the URL in the database.`,
      );
    }

    // Warn for large files (may cause performance issues in serverless)
    if (fileSize > WARN_FILE_SIZE_BYTES) {
      this.logger.warn(
        `Large file upload detected: ${(fileSize / (1024 * 1024)).toFixed(2)}MB. ` +
        `Consider using external storage (Vercel Blob/S3) for better performance.`,
        { path: normalizedPath, size: fileSize },
      );
    }
    
    const file = this.fileRepository.create({
      ...createFileDto,
      path: normalizedPath,
      size: fileSize,
    });
    return this.fileRepository.save(file);
  }

  async findOne(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return file;
  }

  async findByRun(runId: string): Promise<File[]> {
    return this.fileRepository.find({
      where: { run_id: runId },
      order: { path: 'ASC' },
    });
  }

  async findByApp(appId: string): Promise<File[]> {
    return this.fileRepository.find({
      where: { app_id: appId },
      order: { path: 'ASC' },
    });
  }

  async update(id: string, content: string): Promise<File> {
    const file = await this.findOne(id);
    file.content = content;
    file.size = Buffer.byteLength(content, 'utf8');
    file.version += 1;
    return this.fileRepository.save(file);
  }

  async delete(id: string): Promise<void> {
    const file = await this.findOne(id);
    await this.fileRepository.remove(file);
  }

  async getChunk(
    id: string,
    chunkSize: number = 64 * 1024,
    chunkIndex: number = 0,
  ): Promise<{ chunk: string; totalChunks: number; chunkIndex: number }> {
    const file = await this.findOne(id);
    const totalChunks = Math.ceil(file.content.length / chunkSize);
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.content.length);
    const chunk = file.content.slice(start, end);

    return {
      chunk,
      totalChunks,
      chunkIndex,
    };
  }
}

