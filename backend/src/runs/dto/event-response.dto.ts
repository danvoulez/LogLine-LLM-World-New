import { EventKind } from '../entities/event.entity';

export class EventResponseDto {
  id: string;
  run_id: string;
  step_id: string | null;
  kind: EventKind;
  payload: Record<string, any>;
  ts: Date;
}

