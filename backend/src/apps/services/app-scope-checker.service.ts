import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppScope, ScopeType } from '../entities/app-scope.entity';

/**
 * Service for checking if an app has permission to use a resource (tool, memory, external).
 * 
 * Scope checking is enforced when:
 * - An app context is provided (appId is set)
 * - The resource requires scope checking
 * 
 * If no app context is provided, scope checking is bypassed (for direct workflow runs).
 */
@Injectable()
export class AppScopeCheckerService {
  private readonly logger = new Logger(AppScopeCheckerService.name);

  constructor(
    @InjectRepository(AppScope)
    private appScopeRepository: Repository<AppScope>,
  ) {}

  /**
   * Check if an app has permission to use a tool.
   * 
   * @param appId - App ID (undefined for direct workflow runs)
   * @param toolId - Tool ID to check
   * @returns true if allowed, false if denied
   */
  async checkToolScope(
    appId: string | undefined,
    toolId: string,
  ): Promise<boolean> {
    // If no app context, allow (direct workflow run)
    if (!appId) {
      return true;
    }

    // Check if app has this tool in its scopes
    const scope = await this.appScopeRepository.findOne({
      where: {
        app_id: appId,
        scope_type: ScopeType.TOOL,
        scope_value: toolId,
      },
    });

    const allowed = !!scope;

    if (!allowed) {
      this.logger.warn(
        `Tool scope denied: app=${appId}, tool=${toolId}`,
      );
    }

    return allowed;
  }

  /**
   * Check if an app has permission to use a memory resource.
   * 
   * @param appId - App ID (undefined for direct workflow runs)
   * @param memoryId - Memory ID to check
   * @returns true if allowed, false if denied
   */
  async checkMemoryScope(
    appId: string | undefined,
    memoryId: string,
  ): Promise<boolean> {
    // If no app context, allow (direct workflow run)
    if (!appId) {
      return true;
    }

    // Check if app has this memory in its scopes
    const scope = await this.appScopeRepository.findOne({
      where: {
        app_id: appId,
        scope_type: ScopeType.MEMORY,
        scope_value: memoryId,
      },
    });

    const allowed = !!scope;

    if (!allowed) {
      this.logger.warn(
        `Memory scope denied: app=${appId}, memory=${memoryId}`,
      );
    }

    return allowed;
  }

  /**
   * Check if an app has permission to use an external resource.
   * 
   * @param appId - App ID (undefined for direct workflow runs)
   * @param externalId - External resource ID to check
   * @returns true if allowed, false if denied
   */
  async checkExternalScope(
    appId: string | undefined,
    externalId: string,
  ): Promise<boolean> {
    // If no app context, allow (direct workflow run)
    if (!appId) {
      return true;
    }

    // Check if app has this external resource in its scopes
    const scope = await this.appScopeRepository.findOne({
      where: {
        app_id: appId,
        scope_type: ScopeType.EXTERNAL,
        scope_value: externalId,
      },
    });

    const allowed = !!scope;

    if (!allowed) {
      this.logger.warn(
        `External scope denied: app=${appId}, external=${externalId}`,
      );
    }

    return allowed;
  }

  /**
   * Get all scopes for an app (for debugging/admin purposes).
   * 
   * @param appId - App ID
   * @returns Array of scopes
   */
  async getAppScopes(appId: string): Promise<AppScope[]> {
    return this.appScopeRepository.find({
      where: { app_id: appId },
    });
  }
}

