import { AdminService } from './admin.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

function createMockPrisma() {
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    device: { count: jest.fn() },
    remoteSession: { count: jest.fn() },
    securityFinding: { count: jest.fn() },
    report: { count: jest.fn() },
    alert: { count: jest.fn() },
    auditLog: { findMany: jest.fn() },
  } as any;
}

function membership(overrides: Record<string, any>) {
  return {
    id: 'm-1',
    userId: 'u1',
    orgId: 'org-1',
    role: 'Technician',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'u1', email: 'a@test.com', displayName: 'A', orgId: 'org-1', isMfaEnabled: false, ssoId: null, ssoProvider: null },
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AdminService(prisma);
  });

  describe('listUsers', () => {
    it('returns members of the org resolved through OrganizationMember', async () => {
      const members = [
        membership({ id: 'm1', userId: 'u1', role: 'Owner', user: { id: 'u1', email: 'a@test.com', displayName: 'A', orgId: 'org-1', isMfaEnabled: false, ssoId: null, ssoProvider: null } }),
        membership({ id: 'm2', userId: 'u2', role: 'Admin', user: { id: 'u2', email: 'b@test.com', displayName: 'B', orgId: 'other-org', isMfaEnabled: false, ssoId: null, ssoProvider: null } }),
      ];
      prisma.organizationMember.findMany.mockResolvedValue(members);

      const result = await service.listUsers('org-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('u1');
      expect(result[0].role).toBe('Owner');
      expect(result[1].role).toBe('Admin');
      // A multi-org user (active org elsewhere) is still a member of this org.
      expect(result[1].id).toBe('u2');
      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('returns empty array when org has no members', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([]);
      const result = await service.listUsers('empty-org');
      expect(result).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('returns a member resolved through OrganizationMember', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm1', userId: 'u1', role: 'Owner' }),
      );
      const result = await service.getUser('org-1', 'u1');
      expect(result.id).toBe('u1');
      expect(result.role).toBe('Owner');
    });

    it('throws NotFoundException when user is not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.getUser('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('allows Owner to change role of another user', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm2', userId: 'u2', role: 'Technician', user: { id: 'u2', email: 'b@test.com', displayName: 'B', orgId: 'org-1' } }),
      );
      prisma.organizationMember.update.mockResolvedValue({ id: 'm2', role: 'Admin', updatedAt: new Date() });
      prisma.user.update.mockResolvedValue({ id: 'u2', role: 'Admin' });

      const result = await service.updateUserRole('org-1', 'owner-id', 'u2', 'Admin');

      expect(result.role).toBe('Admin');
      expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: { userId_orgId: { userId: 'u2', orgId: 'org-1' } },
        include: { user: true },
      });
      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { role: 'Admin' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { role: 'Admin' },
      });
    });

    it('rejects invalid role', async () => {
      await expect(service.updateUserRole('org-1', 'owner-id', 'u2', 'InvalidRole')).rejects.toThrow(BadRequestException);
    });

    it('rejects changing role of another Owner', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm3', userId: 'u3', role: 'Owner', user: { id: 'u3', orgId: 'org-1' } }),
      );
      await expect(service.updateUserRole('org-1', 'owner-id', 'u3', 'Admin')).rejects.toThrow(BadRequestException);
      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    it('allows Owner to change their own role when another Owner remains', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm-owner', userId: 'owner-id', role: 'Owner', user: { id: 'owner-id', orgId: 'org-1' } }),
      );
      prisma.organizationMember.update.mockResolvedValue({ id: 'm-owner', role: 'Admin', updatedAt: new Date() });
      prisma.user.update.mockResolvedValue({});

      const result = await service.updateUserRole('org-1', 'owner-id', 'owner-id', 'Admin');
      expect(result.role).toBe('Admin');
    });

    it('does not touch the User role snapshot when the user is not in this org', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm4', userId: 'u4', role: 'Technician', user: { id: 'u4', orgId: 'other-org' } }),
      );
      prisma.organizationMember.update.mockResolvedValue({ id: 'm4', role: 'Admin', updatedAt: new Date() });

      await service.updateUserRole('org-1', 'owner-id', 'u4', 'Admin');

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a user without a membership', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.updateUserRole('org-1', 'owner-id', 'nonexistent', 'Admin')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeUser', () => {
    it('removes the membership only and never deletes the global User', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm2', userId: 'u2', role: 'Technician', user: { id: 'u2', orgId: 'org-1' } }),
      );
      prisma.organizationMember.delete.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.removeUser('org-1', 'owner-id', 'u2');

      expect(result).toEqual({ message: 'User removed', userId: 'u2' });
      expect(prisma.organizationMember.delete).toHaveBeenCalledWith({ where: { id: 'm2' } });
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u2', orgId: 'org-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects removing the last Owner', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm3', userId: 'u3', role: 'Owner', user: { id: 'u3', orgId: 'org-1' } }),
      );
      prisma.organizationMember.count.mockResolvedValue(1);
      await expect(service.removeUser('org-1', 'owner-id', 'u3')).rejects.toThrow(ConflictException);
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });

    it('rejects self-removal', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        membership({ id: 'm-owner', userId: 'owner-id', role: 'Technician', user: { id: 'owner-id' } }),
      );
      await expect(service.removeUser('org-1', 'owner-id', 'owner-id')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a user without a membership', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.removeUser('org-1', 'owner-id', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
