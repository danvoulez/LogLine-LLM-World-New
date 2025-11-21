import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CorePerson } from './entities/core-person.entity';
import { TenantPeopleRelationship, PersonRole } from './entities/tenant-people-relationship.entity';
import { RegisterPersonDto } from './dto/register-person.dto';
import { SearchPeopleDto } from './dto/search-people.dto';
import { LogLineIdService } from '../common/logline-id.service';
import * as crypto from 'crypto';

/**
 * People Service - Manages Universal Identity for People
 * 
 * Handles:
 * - LogLine ID generation (LL-BR-YYYY-XXXXXXXX)
 * - Person registration and linking
 * - Cross-tenant identity management
 * - Privacy-preserving search (CPF hash)
 */
@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(CorePerson)
    private corePersonRepository: Repository<CorePerson>,
    @InjectRepository(TenantPeopleRelationship)
    private tenantRelationshipRepository: Repository<TenantPeopleRelationship>,
    private dataSource: DataSource,
    private loglineIdService: LogLineIdService,
  ) {}

  /**
   * Hash CPF for privacy-preserving storage
   */
  private hashCPF(cpf: string): string {
    // Remove formatting (dots, dashes)
    const cleanCPF = cpf.replace(/[.\-]/g, '');
    // Hash with SHA-256
    return crypto.createHash('sha256').update(cleanCPF).digest('hex');
  }

  /**
   * Generate LogLine ID: LL-BR-YYYY-XXXXXXXX-CHECKSUM
   * Format: LL-BR-{YEAR}-{SEQUENTIAL}-{CHECKSUM}
   */
  private async generateLogLineId(cpf: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LL-BR-${year}-`;

    // Find the highest sequential number for this year
    const lastPerson = await this.corePersonRepository
      .createQueryBuilder('person')
      .where('person.logline_id LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('person.logline_id', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastPerson) {
      // Extract sequence from last ID (e.g., "LL-BR-2024-000123456-A3" -> 123456)
      // Handle both with and without checksum
      const baseId = this.loglineIdService.extractBaseId(lastPerson.logline_id);
      const match = baseId.match(/-(\d+)$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    // Generate ID with checksum
    return this.loglineIdService.generatePersonId(cpf, year, sequence);
  }

  /**
   * Register a new person or link to existing identity
   * 
   * Returns:
   * - created: true if new person, false if linked to existing
   * - logline_id: The universal identity
   */
  async register(dto: RegisterPersonDto): Promise<{
    logline_id: string;
    created: boolean;
    tenant_relationship: TenantPeopleRelationship;
  }> {
    const cpfHash = this.hashCPF(dto.cpf);
    const role = dto.role || 'customer';

    // Check if person already exists (by CPF hash or email)
    let person = await this.corePersonRepository.findOne({
      where: [{ cpf_hash: cpfHash }, { email_primary: dto.email }],
    });

    let created = false;
    let loglineId: string;

    if (person) {
      // Person exists - link to tenant
      loglineId = person.logline_id;

      // Check if already linked to this tenant
      const existingLink = await this.tenantRelationshipRepository.findOne({
        where: {
          logline_id: loglineId,
          tenant_id: dto.tenant_id,
        },
      });

      if (existingLink) {
        throw new ConflictException(
          `Person with LogLine ID ${loglineId} is already linked to this tenant`,
        );
      }
    } else {
      // New person - create identity
      created = true;
      loglineId = await this.generateLogLineId(dto.cpf);

      person = this.corePersonRepository.create({
        logline_id: loglineId,
        cpf_hash: cpfHash,
        email_primary: dto.email,
        name: dto.name,
      });

      await this.corePersonRepository.save(person);
    }

    // Create tenant relationship
    const relationship = this.tenantRelationshipRepository.create({
      logline_id: loglineId,
      tenant_id: dto.tenant_id,
      role: role,
      tenant_specific_data: dto.tenant_specific_data,
    });

    await this.tenantRelationshipRepository.save(relationship);

    return {
      logline_id: loglineId,
      created,
      tenant_relationship: relationship,
    };
  }

  /**
   * Find person by LogLine ID
   * Optionally validates checksum if CPF is provided
   */
  async findByLogLineId(loglineId: string, cpf?: string): Promise<CorePerson> {
    const person = await this.corePersonRepository.findOne({
      where: { logline_id: loglineId },
      relations: ['tenant_relationships'],
    });

    if (!person) {
      throw new NotFoundException(`Person with LogLine ID ${loglineId} not found`);
    }

    // Validate checksum if CPF provided
    if (cpf && !this.loglineIdService.validateLogLineId(loglineId, cpf)) {
      throw new BadRequestException(
        `LogLine ID ${loglineId} checksum validation failed. ID may be corrupted or invalid.`,
      );
    }

    return person;
  }

  /**
   * Search for people by various criteria
   */
  async search(criteria: SearchPeopleDto): Promise<CorePerson[]> {
    const query = this.corePersonRepository.createQueryBuilder('person');

    if (criteria.cpf) {
      const cpfHash = this.hashCPF(criteria.cpf);
      query.andWhere('person.cpf_hash = :cpfHash', { cpfHash });
    }

    if (criteria.email) {
      query.andWhere('person.email_primary = :email', { email: criteria.email });
    }

    if (criteria.name) {
      query.andWhere('person.name ILIKE :name', { name: `%${criteria.name}%` });
    }

    // If tenant_id is provided, only return people linked to that tenant
    if (criteria.tenant_id) {
      query
        .innerJoin(
          'tenant_people_relationships',
          'rel',
          'rel.logline_id = person.logline_id',
        )
        .andWhere('rel.tenant_id = :tenantId', { tenantId: criteria.tenant_id });
    }

    return query.getMany();
  }

  /**
   * Link an existing person to a tenant
   */
  async linkToTenant(
    loglineId: string,
    tenantId: string,
    role: PersonRole,
    data?: Record<string, any>,
  ): Promise<TenantPeopleRelationship> {
    // Verify person exists
    const person = await this.findByLogLineId(loglineId);

    // Check if already linked
    const existing = await this.tenantRelationshipRepository.findOne({
      where: {
        logline_id: loglineId,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Person ${loglineId} is already linked to tenant ${tenantId}`,
      );
    }

    // Create relationship
    const relationship = this.tenantRelationshipRepository.create({
      logline_id: loglineId,
      tenant_id: tenantId,
      role,
      tenant_specific_data: data,
    });

    return this.tenantRelationshipRepository.save(relationship);
  }

  /**
   * Get all tenants a person is linked to
   */
  async getTenants(loglineId: string): Promise<TenantPeopleRelationship[]> {
    // Verify person exists
    await this.findByLogLineId(loglineId);

    return this.tenantRelationshipRepository.find({
      where: { logline_id: loglineId },
      order: { created_at: 'DESC' },
    });
  }
}

