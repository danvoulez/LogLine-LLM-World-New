import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Run } from '../../runs/entities/run.entity';

export enum WorkflowType {
  GRAPH = 'graph',
  LINEAR = 'linear',
  SUBGRAPH = 'subgraph',
}

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string;

  @Column({ type: 'jsonb' })
  definition: {
    nodes: Array<{
      id: string;
      type: string;
      [key: string]: any;
    }>;
    edges: Array<{
      from: string;
      to: string;
      condition?: string;
    }>;
    entryNode: string;
  };

  @Column({
    type: 'enum',
    enum: WorkflowType,
    default: WorkflowType.LINEAR,
  })
  type: WorkflowType;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Run, (run) => run.workflow)
  runs: Run[];
}
