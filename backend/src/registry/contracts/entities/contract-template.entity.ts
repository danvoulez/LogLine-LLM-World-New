import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Contract Template Entity
 * 
 * Standard contract templates for quick contract creation.
 * Templates use variable interpolation for customization.
 */
@Entity('registry_contract_templates')
@Index(['tenant_id'])
@Index(['categoria'])
@Index(['ativo'], { where: 'ativo = true' })
export class ContractTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('varchar', { length: 255 })
  titulo: string;

  @Column('text', { nullable: true })
  descricao?: string;

  // Template como JSON com variáveis
  // Exemplo: { "prazo_dias": 30, "multa_percentual": 2, "clausulas": [...] }
  @Column('jsonb')
  template_data: {
    tipo?: string;
    escopo?: string[];
    prazo_dias?: number;
    multa_atraso?: {
      tipo: 'percentual_dia' | 'valor_fixo';
      valor: number;
    };
    clausulas?: {
      consequencia_normal?: string;
      possibilidades_questionamento?: string[];
      penalidades?: {
        atraso_injustificado?: string;
        nao_entrega?: string;
        qualidade_insatisfatoria?: string;
      };
    };
    [key: string]: any; // Allow additional fields
  };

  // Variáveis que devem ser preenchidas
  // Exemplo: ["valor_total", "contraparte_logline_id", "data_inicio"]
  @Column('jsonb', { default: '[]' })
  required_variables: string[];

  @Column('varchar', { length: 100, nullable: true })
  categoria?: string;

  @Column('integer', { default: 1 })
  versao: number;

  @Column('boolean', { default: true })
  ativo: boolean;

  @Column('varchar', { length: 50, nullable: true })
  created_by_logline_id?: string; // References core_people.logline_id

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

