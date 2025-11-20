import { RunStatus, RunMode } from '../entities/run.entity';

export class RunResponseDto {
  id: string;
  workflow_id: string;
  workflow_version: string;
  app_id: string | null;
  app_action_id: string | null;
  user_id: string | null;
  tenant_id: string;
  status: RunStatus;
  mode: RunMode;
  input: Record<string, any>;
  result: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

