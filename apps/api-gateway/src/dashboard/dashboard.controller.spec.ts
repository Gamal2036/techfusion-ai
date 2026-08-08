import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CombinedAuthGuard } from '../common/combined-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET = 'dashboard-controller-test-secret';

describe('DashboardController', () => {
  let app: INestApplication;
  const mockService = {
    getSummary: jest.fn(),
  };

  // Membership is the authority for org access; the guard resolves the token
  // against this membership row before letting the request through.
  const mockPrisma = {
    organizationMember: {
      findUnique: jest.fn(({ where }: any) => ({
        id: 'membership-1',
        userId: where.userId_orgId.userId,
        orgId: where.userId_orgId.orgId,
        role: 'Viewer',
      })),
    },
  };

  const summaryPayload = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    fleet: { total: 0, online: 0, offline: 0 },
    alerts: { unacknowledged: 0 },
    security: { openFindings: { total: 0 } },
    operations: { backups: {}, scans: {}, reports: {} },
    team: { total: 1 },
  };

  function tokenFor(role: string, orgId = 'org-1'): string {
    return jwt.sign(
      { sub: 'user-1', email: 'user@example.com', role, orgId },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: APP_GUARD, useClass: CombinedAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    mockService.getSummary.mockReset();
    mockService.getSummary.mockResolvedValue(summaryPayload);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no bearer token is provided', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(401);
  });

  it('returns 401 for an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  for (const role of ['Owner', 'Admin', 'Technician', 'Viewer']) {
    it(`returns 200 for a ${role} user`, async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${tokenFor(role)}`)
        .expect(200);
      expect(res.body).toEqual(summaryPayload);
      expect(mockService.getSummary).toHaveBeenCalledWith('org-1');
    });
  }

  it('scopes the summary to the organization in the token', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${tokenFor('Technician', 'org-42')}`)
      .expect(200);
    expect(mockService.getSummary).toHaveBeenCalledWith('org-42');
  });
});
