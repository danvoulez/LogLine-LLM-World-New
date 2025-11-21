import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  RegistryContract,
  ContractState,
} from './entities/registry-contract.entity';
import { RegistryContractStateHistory } from './entities/registry-contract-state-history.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { LogLineIdService } from '../common/logline-id.service';
import { RegistryEventsService } from '../registry-events.service';

/**
 * Contracts Service - Executable State Machine
 * 
 * Handles:
 * - Contract creation and state management
 * - State transitions (RASCUNHO → VIGENTE → QUESTIONADO / CONCLUÍDO / CANCELADO)
 * - Questioning and defense periods
 * - Penalty application
 * - Dispatch mechanisms
 */
@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(RegistryContract)
    private contractRepository: Repository<RegistryContract>,
    @InjectRepository(RegistryContractStateHistory)
    private stateHistoryRepository: Repository<RegistryContractStateHistory>,
    private dataSource: DataSource,
    private loglineIdService: LogLineIdService,
    private eventsService: RegistryEventsService,
  ) {}

  /**
   * Create a new contract (starts in RASCUNHO state)
   */
  async create(dto: CreateContractDto): Promise<RegistryContract> {
    const contract = this.contractRepository.create({
      ...dto,
      estado_atual: 'RASCUNHO',
      moeda: dto.moeda || 'BRL',
      periodo_defesa_dias: 3,
    });

    // Calculate data_limite if prazo_dias is provided
    if (dto.data_inicio && dto.prazo_dias) {
      const inicio = new Date(dto.data_inicio);
      inicio.setDate(inicio.getDate() + dto.prazo_dias);
      contract.data_limite = inicio;
    }

    const saved = await this.contractRepository.save(contract);

    // Create initial state history
    await this.transitionState(saved.id, 'RASCUNHO', dto.autor_logline_id, 'Contract created');

    this.eventsService.emitContractCreated(saved);

    return saved;
  }

  /**
   * Find contract by ID
   */
  async findOne(id: string): Promise<RegistryContract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['state_history'],
      order: { state_history: { created_at: 'DESC' } },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  /**
   * Find contracts by criteria
   */
  async findAll(filters: {
    tenant_id?: string;
    estado_atual?: ContractState;
    autor_logline_id?: string;
    contraparte_logline_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: RegistryContract[]; total: number; page: number; limit: number }> {
    const query = this.contractRepository.createQueryBuilder('contract');

    if (filters.tenant_id) {
      query.andWhere('contract.tenant_id = :tenantId', { tenantId: filters.tenant_id });
    }

    if (filters.estado_atual) {
      query.andWhere('contract.estado_atual = :estado', { estado: filters.estado_atual });
    }

    if (filters.autor_logline_id) {
      query.andWhere('contract.autor_logline_id = :autorId', {
        autorId: filters.autor_logline_id,
      });
    }

    if (filters.contraparte_logline_id) {
      query.andWhere('contract.contraparte_logline_id = :contraparteId', {
        contraparteId: filters.contraparte_logline_id,
      });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    query.skip(skip).take(limit).orderBy('contract.created_at', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Sign contract (RASCUNHO → VIGENTE)
   */
  async sign(
    contractId: string,
    signedByLoglineId: string,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(contractId);

    if (contract.estado_atual !== 'RASCUNHO') {
      throw new BadRequestException(
        `Contract ${contractId} cannot be signed. Current state: ${contract.estado_atual}`,
      );
    }

    // Verify signer is autor or contraparte
    if (
      signedByLoglineId !== contract.autor_logline_id &&
      signedByLoglineId !== contract.contraparte_logline_id
    ) {
      throw new BadRequestException(
        `Only autor or contraparte can sign the contract`,
      );
    }

    // Transition to VIGENTE
    await this.transitionState(contractId, 'VIGENTE', signedByLoglineId, 'Contract signed');

    return this.findOne(contractId);
  }

  /**
   * Question contract (VIGENTE → QUESTIONADO)
   */
  async question(
    contractId: string,
    razao: string,
    questionedByLoglineId: string,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(contractId);

    if (contract.estado_atual !== 'VIGENTE') {
      throw new BadRequestException(
        `Contract ${contractId} cannot be questioned. Current state: ${contract.estado_atual}`,
      );
    }

    contract.questionamento_razao = razao;
    contract.questionamento_data = new Date();

    await this.contractRepository.save(contract);
    await this.transitionState(
      contractId,
      'QUESTIONADO',
      questionedByLoglineId,
      `Questioned: ${razao}`,
    );

    return this.findOne(contractId);
  }

  /**
   * Defend contract (provide justification)
   */
  async defend(
    contractId: string,
    justificativa: string,
    defendedByLoglineId: string,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(contractId);

    if (contract.estado_atual !== 'QUESTIONADO') {
      throw new BadRequestException(
        `Contract ${contractId} is not in QUESTIONADO state`,
      );
    }

    contract.justificativa = justificativa;

    await this.contractRepository.save(contract);

    return this.findOne(contractId);
  }

  /**
   * Resolve question (accept or reject justification)
   */
  async resolve(
    id: string,
    aceitaJustificativa: boolean,
    resolvedByLoglineId: string,
    penalidade_cents?: number,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(id);

    if (contract.estado_atual !== 'QUESTIONADO') {
      throw new BadRequestException(
        `Cannot resolve contract ${id} because it is in state ${contract.estado_atual}`,
      );
    }

    contract.justificativa_aceita = aceitaJustificativa;

    if (aceitaJustificativa) {
      // Return to VIGENTE
      await this.transitionState(
        id,
        'VIGENTE',
        resolvedByLoglineId,
        'Justification accepted',
      );
    } else {
      // Override penalty calculation if provided
      if (penalidade_cents !== undefined) {
        contract.penalidade_aplicada_cents = penalidade_cents;
        contract.penalidade_data = new Date();
        await this.contractRepository.save(contract);
        await this.transitionState(
          id,
          'PENALIZADO',
          resolvedByLoglineId,
          'Justification rejected, custom penalty applied',
        );
        return this.findOne(id);
      }

      // Apply penalty and move to PENALIZADO
      // Calculate penalty based on multa_atraso if configured
      let penaltyAmount = 0;
      if (contract.multa_atraso) {
        if (contract.multa_atraso.tipo === 'percentual_dia' && contract.valor_total_cents) {
          // Example: 2% per day (simplified)
          // Using integer math for cents: (total * percent) / 100
          penaltyAmount = Math.floor((contract.valor_total_cents * contract.multa_atraso.valor) / 100);
        } else if (contract.multa_atraso.tipo === 'valor_fixo') {
          // Assuming valor is also in cents for consistency
          penaltyAmount = contract.multa_atraso.valor;
        }
      }

      contract.penalidade_aplicada_cents = penaltyAmount;
      contract.penalidade_data = new Date();

      await this.contractRepository.save(contract);
      await this.transitionState(
        id,
        'PENALIZADO',
        resolvedByLoglineId,
        'Justification rejected, penalty applied',
      );
    }

    return this.findOne(id);
  }

  /**
   * Complete contract (VIGENTE → CONCLUÍDO)
   */
  async complete(
    contractId: string,
    completedByLoglineId: string,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(contractId);

    if (contract.estado_atual !== 'VIGENTE') {
      throw new BadRequestException(
        `Contract ${contractId} cannot be completed. Current state: ${contract.estado_atual}`,
      );
    }

    await this.transitionState(
      contractId,
      'CONCLUÍDO',
      completedByLoglineId,
      'Contract completed',
    );

    return this.findOne(contractId);
  }

  /**
   * Cancel contract
   */
  async cancel(
    contractId: string,
    motivo: string,
    cancelledByLoglineId: string,
  ): Promise<RegistryContract> {
    const contract = await this.findOne(contractId);

    if (['CONCLUÍDO', 'CANCELADO'].includes(contract.estado_atual)) {
      throw new BadRequestException(
        `Contract ${contractId} cannot be cancelled. Current state: ${contract.estado_atual}`,
      );
    }

    await this.transitionState(
      contractId,
      'CANCELADO',
      cancelledByLoglineId,
      motivo,
    );

    return this.findOne(contractId);
  }

  /**
   * Transition contract state (with history)
   */
  private async transitionState(
    contractId: string,
    newState: ContractState,
    changedByLoglineId: string,
    motivo?: string,
  ): Promise<void> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    const oldState = contract.estado_atual;
    contract.estado_atual = newState;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(contract);

      // Create state history
      const history = this.stateHistoryRepository.create({
        contract_id: contractId,
        estado_anterior: oldState,
        estado_novo: newState,
        motivo,
        changed_by_logline_id: changedByLoglineId,
      });

      await manager.save(history);
    });

    // Emit event after transaction commits
    this.eventsService.emitContractStateChanged(
      contractId,
      oldState,
      newState,
      changedByLoglineId,
    );
  }

  /**
   * Get state history for a contract
   */
  async getStateHistory(contractId: string): Promise<RegistryContractStateHistory[]> {
    await this.findOne(contractId); // Verify contract exists

    return this.stateHistoryRepository.find({
      where: { contract_id: contractId },
      order: { created_at: 'DESC' },
    });
  }
}
