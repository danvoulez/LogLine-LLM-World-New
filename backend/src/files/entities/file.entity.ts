import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('files')
@Index(['run_id'])
@Index(['app_id'])
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  run_id: string | null; // Link to run if file is part of a run

  @Column({ type: 'varchar', nullable: true })
  app_id: string | null; // Link to app if file belongs to an app

  @Column()
  path: string; // File path (e.g., 'src/app.ts')

  @Column('text')
  content: string; // File content

  @Column({ type: 'bigint', default: 0 })
  size: number; // File size in bytes

  @Column({ type: 'varchar', nullable: true })
  mime_type: string | null; // MIME type (e.g., 'text/typescript')

  @Column({ type: 'int', default: 1 })
  version: number; // File version (for tracking changes)

  @Column({ type: 'uuid', nullable: true })
  parent_file_id: string | null; // For tracking file history

  @Column({ type: 'varchar', nullable: true })
  tenant_id: string | null; // Multi-tenancy support

  @Column({ type: 'varchar', nullable: true })
  user_id: string | null; // User who created/modified

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

