import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { User, UserRole } from './entities/user.entity';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RbacService],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  describe('hasPermission', () => {
    it('should allow admin to perform any action', () => {
      const adminUser: User = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
      } as User;

      expect(service.hasPermission(adminUser, 'workflow', 'delete')).toBe(true);
      expect(service.hasPermission(adminUser, 'tool', 'create')).toBe(true);
      expect(service.hasPermission(adminUser, 'policy', 'update')).toBe(true);
    });

    it('should restrict user to read/execute only', () => {
      const regularUser: User = {
        id: 'user-456',
        email: 'user@example.com',
        role: 'user',
      } as User;

      expect(service.hasPermission(regularUser, 'workflow', 'read')).toBe(true);
      expect(service.hasPermission(regularUser, 'workflow', 'execute')).toBe(true);
      expect(service.hasPermission(regularUser, 'workflow', 'delete')).toBe(false);
      expect(service.hasPermission(regularUser, 'tool', 'create')).toBe(false);
    });

    it('should allow developer to create/update but not delete', () => {
      const developerUser: User = {
        id: 'user-789',
        email: 'dev@example.com',
        role: 'developer',
      } as User;

      expect(service.hasPermission(developerUser, 'workflow', 'create')).toBe(true);
      expect(service.hasPermission(developerUser, 'workflow', 'update')).toBe(true);
      expect(service.hasPermission(developerUser, 'workflow', 'delete')).toBe(false);
      expect(service.hasPermission(developerUser, 'policy', 'read')).toBe(true);
      expect(service.hasPermission(developerUser, 'policy', 'create')).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for admin', () => {
      const adminUser: User = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
      } as User;

      const permissions = service.getUserPermissions(adminUser);

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some((p) => p.resource === 'workflow' && p.actions.includes('delete'))).toBe(
        true,
      );
    });

    it('should return limited permissions for user', () => {
      const regularUser: User = {
        id: 'user-456',
        email: 'user@example.com',
        role: 'user',
      } as User;

      const permissions = service.getUserPermissions(regularUser);

      expect(permissions.length).toBeGreaterThan(0);
      const workflowPerm = permissions.find((p) => p.resource === 'workflow');
      expect(workflowPerm?.actions).not.toContain('delete');
      expect(workflowPerm?.actions).toContain('read');
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', () => {
      const user: User = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
      } as User;

      expect(() => service.assignRole(user, 'developer')).not.toThrow();
    });
  });

  describe('revokeRole', () => {
    it('should revoke role from user', () => {
      const user: User = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
      } as User;

      expect(() => service.revokeRole(user, 'developer')).not.toThrow();
    });
  });
});

