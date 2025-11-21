import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { RegistryIdea } from './registry-idea.entity';

/**
 * Registry Idea Vote Entity
 * 
 * Votes on ideas with priority (1-10) and weight for stakeholders.
 */
@Entity('registry_idea_votes')
@Unique(['idea_id', 'voter_logline_id'])
@Index(['idea_id'])
@Index(['voter_logline_id'])
export class RegistryIdeaVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  idea_id: string;

  @ManyToOne(() => RegistryIdea, (idea) => idea.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idea_id' })
  idea: RegistryIdea;

  @Column('varchar', { length: 50 })
  voter_logline_id: string; // References core_people.logline_id

  @Column('integer')
  prioridade: number; // 1 to 10

  @Column('text', { nullable: true })
  comentario?: string;

  @Column('decimal', { precision: 3, scale: 2, default: 1.0 })
  peso: number; // Weight for stakeholders with more "skin in the game"

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

