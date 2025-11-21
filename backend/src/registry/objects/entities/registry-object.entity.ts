import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RegistryObjectMovement } from './registry-object-movement.entity';

export type ObjectType =
  | 'document'
  | 'file'
  | 'merchandise'
  | 'collection'
  | 'lost_found'
  | 'inventory'
  | 'service';

export type Visibility = 'tenant' | 'org' | 'public';

export type LostFoundStatus = 'lost' | 'found' | 'matched' | 'returned';

/**
 * Registry Object Entity - Trackable Inanimate Items
 * 
 * Represents any inanimate, trackable item in the system:
 * - Documents (RG, CNH, certificates)
 * - Files (digital files, contracts, photos)
 * - Merchandise (products, SKUs)
 * - Collection (books, art, shared equipment)
 * - Lost & Found items
 * - Inventory instances
 */
@Entity('registry_objects')
@Index(['object_type'])
@Index(['tenant_id'])
@Index(['identifier'])
@Index(['owner_logline_id'])
@Index(['current_custodian_logline_id'])
@Index(['lost_found_status'], { where: 'lost_found_status IS NOT NULL' })
export class RegistryObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  object_type: ObjectType;

  @Column('uuid', { nullable: true })
  tenant_id?: string; // NULL = cross-app (official document)

  @Column('varchar', { length: 255, nullable: true })
  app_id?: string; // App that created this object

  // Identificação
  @Column('text', { nullable: true })
  identifier?: string; // SKU, barcode, official number

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  // Dados específicos por tipo (JSONB flexível)
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;
  // Examples:
  // document: { numero_oficial, orgao_emissor, validade, hash_arquivo }
  // merchandise: { sku, codigo_barras, fornecedor_logline_id, categoria, preco_custo, preco_venda }
  // inventory: { lote, data_fabricacao, data_validade, localizacao, unidades_disponiveis }
  // collection: { localizacao_atual, responsavel_logline_id, historico_custodia, condicao_fisica }
  // service: { service_type: 'one_time' | 'subscription' | 'usage_based', provider_logline_id, price_model: { type, amount_cents, currency }, delivery_method, sla }

  // Rastreabilidade
  @Column('varchar', { length: 50, nullable: true })
  owner_logline_id?: string; // References core_people.logline_id

  @Column('varchar', { length: 50, nullable: true })
  current_custodian_logline_id?: string; // References core_people.logline_id

  @Column('text', { nullable: true })
  location?: string;

  // Versionamento (para arquivos)
  @Column('integer', { default: 1 })
  version: number;

  @Column('uuid', { nullable: true })
  parent_object_id?: string; // For versions

  @ManyToOne(() => RegistryObject, { nullable: true })
  @JoinColumn({ name: 'parent_object_id' })
  parent_object?: RegistryObject;

  // Lost & Found específico
  @Column('text', { nullable: true })
  lost_found_status?: LostFoundStatus;

  @Column('varchar', { length: 50, nullable: true })
  lost_found_reported_by?: string; // References core_people.logline_id

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  lost_found_match_score?: number; // ML matching score

  // Visibilidade
  @Column('text', { default: 'tenant' })
  visibility: Visibility;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => RegistryObjectMovement, (movement) => movement.object)
  movements: RegistryObjectMovement[];
}

