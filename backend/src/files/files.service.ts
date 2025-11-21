import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { CreateFileDto } from './dto/create-file.dto';
import { normalizeAndValidatePath } from '../common/utils/path-validator.util';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {}

  async create(createFileDto: CreateFileDto): Promise<File> {
    // Path validation is done in DTO via class-validator
    // Normalize path for consistency
    const normalizedPath = normalizeAndValidatePath(createFileDto.path);
    
    const file = this.fileRepository.create({
      ...createFileDto,
      path: normalizedPath,
      size: Buffer.byteLength(createFileDto.content, 'utf8'),
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

