import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run } from './entities/run.entity';
import { Event } from './entities/event.entity';
import { RunResponseDto } from './dto/run-response.dto';
import { EventResponseDto } from './dto/event-response.dto';

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async findOne(id: string): Promise<RunResponseDto> {
    const run = await this.runRepository.findOne({
      where: { id },
      relations: ['steps'],
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }

    return this.toRunResponseDto(run);
  }

  async update(id: string, updates: Partial<Run>): Promise<Run> {
    await this.runRepository.update(id, updates);
    const updated = await this.runRepository.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }
    return updated;
  }

  async findEvents(
    runId: string,
  ): Promise<EventResponseDto[]> {
    const events = await this.eventRepository.find({
      where: { run_id: runId },
      order: { ts: 'ASC' },
    });

    return events.map((event) => this.toEventResponseDto(event));
  }

  private toRunResponseDto(run: Run): RunResponseDto {
    return {
      id: run.id,
      workflow_id: run.workflow_id,
      workflow_version: run.workflow_version,
      app_id: run.app_id,
      app_action_id: run.app_action_id,
      user_id: run.user_id,
      tenant_id: run.tenant_id,
      status: run.status,
      mode: run.mode,
      input: run.input,
      result: run.result,
      created_at: run.created_at,
      updated_at: run.updated_at,
    };
  }

  private toEventResponseDto(event: Event): EventResponseDto {
    return {
      id: event.id,
      run_id: event.run_id,
      step_id: event.step_id,
      kind: event.kind,
      payload: event.payload,
      ts: event.ts,
    };
  }
}

