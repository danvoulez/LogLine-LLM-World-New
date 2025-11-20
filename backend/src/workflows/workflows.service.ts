import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { Workflow, WorkflowType } from './entities/workflow.entity';
import { WorkflowValidatorService } from './validators/workflow-validator.service';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    private workflowValidator: WorkflowValidatorService,
  ) {}

  async create(createWorkflowDto: CreateWorkflowDto): Promise<Workflow> {
    // Validate workflow definition
    if (createWorkflowDto.definition) {
      this.workflowValidator.validateWorkflowDefinition(createWorkflowDto.definition);
    }

    const workflow = this.workflowRepository.create({
      ...createWorkflowDto,
      version: createWorkflowDto.version || '1.0.0',
      type: createWorkflowDto.type || WorkflowType.LINEAR,
    });
    return this.workflowRepository.save(workflow);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Workflow[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.workflowRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async update(
    id: string,
    updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<Workflow> {
    const workflow = await this.findOne(id);

    // Validate workflow definition if being updated
    if (updateWorkflowDto.definition) {
      this.workflowValidator.validateWorkflowDefinition(updateWorkflowDto.definition);
    }

    Object.assign(workflow, updateWorkflowDto);
    return this.workflowRepository.save(workflow);
  }

  async remove(id: string): Promise<void> {
    const workflow = await this.findOne(id);
    await this.workflowRepository.remove(workflow);
  }
}
