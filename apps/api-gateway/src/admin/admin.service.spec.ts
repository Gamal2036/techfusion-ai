import { AdminService } from './admin.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function createMockPrisma() {
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AdminService(prisma);
  });

  describe('listUsers', () => {
    it('returns users for the given org', async () => {
      const users = [
        { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Owner', createdAt: new Date(), updatedAt: new Date() },
        { id: 'u2', email: 'b@test.com', displayName: 'B', role: 'Admin', createdAt: new Date(), updatedAt: new Date() },
      ];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.listUsers('org-1');
      expect(result).toEqual(users);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        select: expect.objectContaining({ id: true, email: true, role: true }),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when org has no users', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.listUsers('empty-org');
      expect(result).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('returns user from the same org', async () => {
      const user = { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Owner' };
      prisma.user.findFirst.mockResolvedValue(user);
      const result = await service.getUser('org-1', 'u1');
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getUser('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user belongs to different org', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getUser('org-1', 'u2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('allows Owner to change role of another user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', role: 'Technician', orgId: 'org-1' });
      prisma.user.update.mockResolvedValue({ id: 'u2', email: 'b@test.com', displayName: 'B', role: 'Admin', updatedAt: new Date() });

      const result = await service.updateUserRole('org-1', 'owner-id', 'u2', 'Admin');
      expect(result.role).toBe('Admin');
    });

    it('rejects invalid role', async () => {
      await expect(service.updateUserRole('org-1', 'owner-id', 'u2', 'InvalidRole')).rejects.toThrow(BadRequestException);
    });

    it('rejects changing role of another Owner', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u3', role: 'Owner', orgId: 'org-1' });
      await expect(service.updateUserRole('org-1', 'owner-id', 'u3', 'Admin')).rejects.toThrow(BadRequestException);
    });

    it('allows Owner to change their own role', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'owner-id', role: 'Owner', orgId: 'org-1' });
      prisma.user.update.mockResolvedValue({ id: 'owner-id', role: 'Admin', updatedAt: new Date() });
      const result = await service.updateUserRole('org-1', 'owner-id', 'owner-id', 'Admin');
      expect(result.role).toBe('Admin');
    });

    it('throws NotFoundException for nonexistent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.updateUserRole('org-1', 'owner-id', 'nonexistent', 'Admin')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeUser', () => {
    it('allows Owner to remove another user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', role: 'Technician', orgId: 'org-1' });
      prisma.user.delete.mockResolvedValue({});
      const result = await service.removeUser('org-1', 'owner-id', 'u2');
      expect(result).toEqual({ message: 'User removed' });
    });

    it('rejects removing the Owner', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u3', role: 'Owner', orgId: 'org-1' });
      await expect(service.removeUser('org-1', 'owner-id', 'u3')).rejects.toThrow(BadRequestException);
    });

    it('rejects self-removal', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'owner-id', role: 'Owner', orgId: 'org-1' });
      await expect(service.removeUser('org-1', 'owner-id', 'owner-id')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for nonexistent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.removeUser('org-1', 'owner-id', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
