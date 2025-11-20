import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createFileDto: CreateFileDto) {
    return this.filesService.create(createFileDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.filesService.findOne(id);
  }

  @Get('runs/:runId')
  async findByRun(@Param('runId') runId: string) {
    return this.filesService.findByRun(runId);
  }

  @Get('apps/:appId')
  async findByApp(@Param('appId') appId: string) {
    return this.filesService.findByApp(appId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.filesService.update(id, body.content);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.filesService.delete(id);
  }

  // Chunked file transfer for mobile apps
  @Get(':id/chunks')
  async getChunk(
    @Param('id') id: string,
    @Query('chunk') chunk: string = '0',
    @Query('size') size: string = '65536', // 64KB default
    @Res() res: Response,
  ) {
    const chunkIndex = parseInt(chunk, 10);
    const chunkSize = parseInt(size, 10);

    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid chunk index',
      });
    }

    if (isNaN(chunkSize) || chunkSize <= 0 || chunkSize > 1024 * 1024) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid chunk size (max 1MB)',
      });
    }

    const result = await this.filesService.getChunk(id, chunkSize, chunkIndex);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Chunk-Index', result.chunkIndex.toString());
    res.setHeader('X-Total-Chunks', result.totalChunks.toString());

    return res.json(result);
  }
}

