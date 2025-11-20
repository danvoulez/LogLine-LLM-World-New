import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ToolRuntimeService } from './tool-runtime.service';
import { Tool } from './entities/tool.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('tools')
export class ToolsController {
  constructor(
    private readonly toolRuntime: ToolRuntimeService,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
  ) {}

  @Post()
  async create(@Body() createToolDto: Partial<Tool>): Promise<Tool> {
    const tool = this.toolRepository.create(createToolDto);
    return this.toolRepository.save(tool);
  }

  @Get()
  async findAll(): Promise<Tool[]> {
    return this.toolRuntime.getAllTools();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Tool> {
    const tool = await this.toolRuntime.getTool(id);
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }
    return tool;
  }
}

