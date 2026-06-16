import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlanGuard } from './plan.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('PlanGuard', () => {
  let guard: PlanGuard;
  let prisma: any;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  function createMockContext(orgId: string, plan: string) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'user-1', orgId, role: 'Owner' },
        }),
      }),
    } as any;
  }

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<PlanGuard>(PlanGuard);
    (guard as any).reflector = mockReflector;
    mockReflector.getAllAndOverride.mockReset();
  });

  describe('no plan/feature requirement', () => {
    it('allows access when no plan or feature is required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const result = await guard.canActivate(createMockContext('org-1', 'Free'));
      expect(result).toBe(true);
    });
  });

  describe('plan requirement', () => {
    it('allows access when org meets plan requirement', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'plan') return 'Pro';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Pro' });

      const result = await guard.canActivate(createMockContext('org-1', 'Pro'));
      expect(result).toBe(true);
    });

    it('allows access when org exceeds plan requirement', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'plan') return 'Pro';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Business' });

      const result = await guard.canActivate(createMockContext('org-1', 'Business'));
      expect(result).toBe(true);
    });

    it('denies access when org does not meet plan requirement', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'plan') return 'Pro';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });

      await expect(
        guard.canActivate(createMockContext('org-1', 'Free')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies access with descriptive error message', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'plan') return 'Business';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });

      try {
        await guard.canActivate(createMockContext('org-1', 'Free'));
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('Business');
        expect(e.message).toContain('Free');
      }
    });
  });

  describe('feature requirement', () => {
    it('allows access when org plan has the feature', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'remoteSupport';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Business' });

      const result = await guard.canActivate(createMockContext('org-1', 'Business'));
      expect(result).toBe(true);
    });

    it('denies access when org plan lacks the feature', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'remoteSupport';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });

      await expect(
        guard.canActivate(createMockContext('org-1', 'Free')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies access to customBranding on Free plan', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'customBranding';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });

      await expect(
        guard.canActivate(createMockContext('org-1', 'Free')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows access to customBranding on Pro plan', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'customBranding';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Pro' });

      const result = await guard.canActivate(createMockContext('org-1', 'Pro'));
      expect(result).toBe(true);
    });

    it('allows access to sso on Enterprise plan', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'sso';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Enterprise' });

      const result = await guard.canActivate(createMockContext('org-1', 'Enterprise'));
      expect(result).toBe(true);
    });

    it('denies access to sso on Business plan', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'feature') return 'sso';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Business' });

      await expect(
        guard.canActivate(createMockContext('org-1', 'Business')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('no org context', () => {
    it('denies access when no user on request', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('Pro');
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as any;

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('denies access when org not found', async () => {
      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'plan') return 'Pro';
        return undefined;
      });
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        guard.canActivate(createMockContext('org-nonexistent', 'Free')),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
