import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RegistryObject } from './entities/registry-object.entity';
import { RegistryObjectMovement, MovementType } from './entities/registry-object-movement.entity';
import { CreateObjectDto } from './dto/create-object.dto';
import { CreateServiceObjectDto } from './dto/create-service-object.dto';
import { TransferObjectDto } from './dto/transfer-object.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

/**
 * Objects Service - Manages Trackable Inanimate Items
 * 
 * Handles:
 * - CRUD operations for objects
 * - Object transfers between people/locations
 * - Movement history tracking
 * - Lost & Found matching
 */
@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(RegistryObject)
    private objectRepository: Repository<RegistryObject>,
    @InjectRepository(RegistryObjectMovement)
    private movementRepository: Repository<RegistryObjectMovement>,
    private dataSource: DataSource,
  ) {}

  /**
   * Create a new object
   */
  async create(dto: CreateObjectDto | CreateServiceObjectDto): Promise<RegistryObject> {
    // Handle service objects specially
    if ('service_type' in dto) {
      const serviceDto = dto as CreateServiceObjectDto;
      const metadata = {
        service_type: serviceDto.service_type,
        provider_logline_id: serviceDto.provider_logline_id,
        price_model: serviceDto.price_model,
        delivery_method: serviceDto.delivery_method,
        sla: serviceDto.sla,
      };

      const object = this.objectRepository.create({
        object_type: 'service',
        name: serviceDto.name,
        description: serviceDto.description,
        tenant_id: serviceDto.tenant_id,
        app_id: serviceDto.app_id,
        metadata,
        visibility: 'tenant',
        version: 1,
      });

      return this.objectRepository.save(object);
    }

    // Regular objects
    // Cast to any to avoid TS issues with union type where object_type might not exist on both
    // and ensure single entity return
    const object = this.objectRepository.create({
      ...(dto as CreateObjectDto),
      visibility: (dto as CreateObjectDto).visibility || 'tenant',
      version: 1,
    } as any) as unknown as RegistryObject;

    return this.objectRepository.save(object);
  }

  /**
   * Find object by ID
   */
  async findOne(id: string): Promise<RegistryObject> {
    const object = await this.objectRepository.findOne({
      where: { id },
      relations: ['movements'],
    });

    if (!object) {
      throw new NotFoundException(`Object with ID ${id} not found`);
    }

    return object;
  }

  /**
   * Find objects by criteria
   */
  async findAll(filters: {
    object_type?: string;
    tenant_id?: string;
    owner_logline_id?: string;
    current_custodian_logline_id?: string;
    lost_found_status?: string;
    q?: string; // Search query for name/description
    page?: number;
    limit?: number;
  }): Promise<{ data: RegistryObject[]; total: number; page: number; limit: number }> {
    const query = this.objectRepository.createQueryBuilder('object');

    if (filters.object_type) {
      query.andWhere('object.object_type = :objectType', {
        objectType: filters.object_type,
      });
    }

    if (filters.tenant_id) {
      query.andWhere('object.tenant_id = :tenantId', {
        tenantId: filters.tenant_id,
      });
    }

    if (filters.owner_logline_id) {
      query.andWhere('object.owner_logline_id = :ownerId', {
        ownerId: filters.owner_logline_id,
      });
    }

    if (filters.current_custodian_logline_id) {
      query.andWhere('object.current_custodian_logline_id = :custodianId', {
        custodianId: filters.current_custodian_logline_id,
      });
    }

    if (filters.lost_found_status) {
      query.andWhere('object.lost_found_status = :status', {
        status: filters.lost_found_status,
      });
    }

    if (filters.q) {
      query.andWhere(
        '(object.name ILIKE :q OR object.description ILIKE :q OR object.identifier ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    query.skip(skip).take(limit).orderBy('object.created_at', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Update an object
   */
  async update(
    id: string,
    updates: Partial<CreateObjectDto>,
  ): Promise<RegistryObject> {
    const object = await this.findOne(id);

    Object.assign(object, updates);
    return this.objectRepository.save(object);
  }

  /**
   * Delete an object
   */
  async remove(id: string): Promise<void> {
    const object = await this.findOne(id);
    await this.objectRepository.remove(object);
  }

  /**
   * Transfer object to another person/location
   */
  async transfer(
    id: string,
    dto: TransferObjectDto,
  ): Promise<{ object: RegistryObject; movement: RegistryObjectMovement }> {
    const object = await this.findOne(id);

    // Create movement record
    const movement = this.movementRepository.create({
      object_id: id,
      movement_type: 'transfer',
      from_logline_id: object.current_custodian_logline_id,
      to_logline_id: dto.to_logline_id,
      from_location: object.location,
      to_location: dto.to_location,
      reason: dto.reason,
      metadata: dto.metadata,
    });

    // Update object
    object.current_custodian_logline_id = dto.to_logline_id;
    if (dto.to_location) {
      object.location = dto.to_location;
    }

    // Save in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const savedMovement = await manager.save(movement);
      const savedObject = await manager.save(object);
      return { object: savedObject, movement: savedMovement };
    });

    return result;
  }

  /**
   * Create a movement record
   */
  async createMovement(
    id: string,
    dto: CreateMovementDto,
  ): Promise<RegistryObjectMovement> {
    const object = await this.findOne(id);

    const movement = this.movementRepository.create({
      object_id: id,
      ...dto,
    });

    // Update object based on movement type
    if (dto.movement_type === 'transfer' && dto.to_logline_id) {
      object.current_custodian_logline_id = dto.to_logline_id;
    }

    if (dto.to_location) {
      object.location = dto.to_location;
    }

    // Save in transaction
    return this.dataSource.transaction(async (manager) => {
      await manager.save(object);
      return manager.save(movement);
    });
  }

  /**
   * Get movement history for an object
   */
  async getMovements(id: string): Promise<RegistryObjectMovement[]> {
    await this.findOne(id); // Verify object exists

    return this.movementRepository.find({
      where: { object_id: id },
      order: { created_at: 'DESC' },
    });
  }
}
