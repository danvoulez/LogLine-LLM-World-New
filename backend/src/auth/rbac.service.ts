import { Injectable, Logger } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';

export type Resource = 'workflow' | 'tool' | 'agent' | 'app' | 'memory' | 'policy' | 'run';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute';

interface Permission {
  resource: Resource;
  actions: Action[];
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  // Role-based permissions
  private readonly rolePermissions: Record<UserRole, Permission[]> = {
    admin: [
      { resource: 'workflow', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'tool', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'agent', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'app', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'memory', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'policy', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'run', actions: ['create', 'read', 'update', 'delete', 'execute'] },
    ],
    developer: [
      { resource: 'workflow', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'tool', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'agent', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'app', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'memory', actions: ['create', 'read', 'update'] },
      { resource: 'policy', actions: ['read'] },
      { resource: 'run', actions: ['create', 'read', 'update', 'execute'] },
    ],
    user: [
      { resource: 'workflow', actions: ['read', 'execute'] },
      { resource: 'tool', actions: ['read', 'execute'] },
      { resource: 'agent', actions: ['read', 'execute'] },
      { resource: 'app', actions: ['read', 'execute'] },
      { resource: 'memory', actions: ['read'] },
      { resource: 'policy', actions: ['read'] },
      { resource: 'run', actions: ['create', 'read', 'execute'] },
    ],
  };

  /**
   * Check if user has permission for a resource and action
   */
  hasPermission(user: User | { role: UserRole }, resource: Resource, action: Action): boolean {
    const role = user.role;
    const permissions = this.rolePermissions[role] || [];

    const resourcePermission = permissions.find((p) => p.resource === resource);

    if (!resourcePermission) {
      return false;
    }

    return resourcePermission.actions.includes(action);
  }

  /**
   * Get all permissions for a user
   */
  getUserPermissions(user: User | { role: UserRole }): Permission[] {
    const role = user.role;
    return this.rolePermissions[role] || [];
  }

  /**
   * Assign role to user (for future use with user management)
   */
  assignRole(user: User, role: UserRole): void {
    // This would typically update the user in the database
    // For now, it's a placeholder
    this.logger.log(`Assigning role ${role} to user ${user.id}`);
  }

  /**
   * Revoke role from user (for future use with user management)
   */
  revokeRole(user: User, role: UserRole): void {
    // This would typically update the user in the database
    // For now, it's a placeholder
    this.logger.log(`Revoking role ${role} from user ${user.id}`);
  }
}

