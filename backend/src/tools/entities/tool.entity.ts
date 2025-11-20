import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tools')
export class Tool {
  @PrimaryColumn('varchar')
  id: string; // e.g., 'ticketing.list_open', 'natural_language_db_read'

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('jsonb')
  input_schema: Record<string, any>; // JSON Schema for tool inputs

  @Column('varchar', { nullable: true })
  handler_type: string; // 'code', 'http', 'builtin'

  @Column('jsonb', { nullable: true })
  handler_config: Record<string, any>; // Handler-specific config

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

