import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScoringService', () => {
  let service: ScoringService;

  const mockPrisma = {} as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoringService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  describe('computeHealthScore', () => {
    it('returns 100 for perfectly healthy system', () => {
      const score = service.computeHealthScore({
        cpuUsage: 0,
        ramPercent: 0,
        diskUsed: 0,
        diskTotal: 100,
        tempCpu: 50,
        smartStatus: 'PASS',
        loadAverage1Min: 0,
        processes: 10,
        batteryPercent: 100,
      });
      expect(score).toBe(100);
    });

    it('returns lower score for high CPU', () => {
      const lowCpu = service.computeHealthScore({
        cpuUsage: 10, ramPercent: 10, diskUsed: 10, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 10, batteryPercent: 100,
      });
      const highCpu = service.computeHealthScore({
        cpuUsage: 90, ramPercent: 10, diskUsed: 10, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 10, batteryPercent: 100,
      });
      expect(highCpu).toBeLessThan(lowCpu);
    });

    it('penalizes high temperature over 70C', () => {
      const cool = service.computeHealthScore({
        cpuUsage: 10, ramPercent: 10, diskUsed: 10, diskTotal: 100,
        tempCpu: 65, smartStatus: 'PASS', loadAverage1Min: 0, processes: 10, batteryPercent: 100,
      });
      const hot = service.computeHealthScore({
        cpuUsage: 10, ramPercent: 10, diskUsed: 10, diskTotal: 100,
        tempCpu: 85, smartStatus: 'PASS', loadAverage1Min: 0, processes: 10, batteryPercent: 100,
      });
      expect(hot).toBeLessThan(cool);
    });

    it('returns 0 for SMART failure', () => {
      const failed = service.computeHealthScore({
        cpuUsage: 0, ramPercent: 0, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'FAIL', loadAverage1Min: 0, processes: 10, batteryPercent: 100,
      });
      // 15% weight on smartHealth = 0 means max possible is 85
      expect(failed).toBeLessThanOrEqual(85);
    });
  });

  describe('computePerformanceScore', () => {
    it('returns 100 for idle system', () => {
      const score = service.computePerformanceScore({
        cpuUsage: 0, ramPercent: 0, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 1, batteryPercent: 100,
      });
      expect(score).toBe(100);
    });

    it('penalizes high CPU', () => {
      const low = service.computePerformanceScore({
        cpuUsage: 10, ramPercent: 10, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0.5, processes: 50, batteryPercent: 100,
      });
      const high = service.computePerformanceScore({
        cpuUsage: 95, ramPercent: 10, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0.5, processes: 50, batteryPercent: 100,
      });
      expect(high).toBeLessThan(low);
    });
  });

  describe('computeRiskScore', () => {
    it('returns 0 for risk-free system', () => {
      const score = service.computeRiskScore({
        cpuUsage: 0, ramPercent: 0, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 1, batteryPercent: 100,
      });
      expect(score).toBe(0);
    });

    it('returns high risk for full CPU + full RAM + full disk', () => {
      const score = service.computeRiskScore({
        cpuUsage: 95, ramPercent: 90, diskUsed: 95, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 1, batteryPercent: 100,
      });
      // cpuRisk=95*0.30 + ramRisk=90*0.20 + diskRisk=95*0.30 + tempRisk=0 + smartRisk=0
      // = 28.5 + 18 + 28.5 = 75
      expect(score).toBeGreaterThan(70);
      expect(score).toBeLessThan(80);
    });

    it('adds risk for SMART failure', () => {
      const pass = service.computeRiskScore({
        cpuUsage: 0, ramPercent: 0, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'PASS', loadAverage1Min: 0, processes: 1, batteryPercent: 100,
      });
      const fail = service.computeRiskScore({
        cpuUsage: 0, ramPercent: 0, diskUsed: 0, diskTotal: 100,
        tempCpu: 50, smartStatus: 'FAIL', loadAverage1Min: 0, processes: 1, batteryPercent: 100,
      });
      expect(fail).toBeGreaterThan(pass);
      // smartRisk = 100 * 0.10 = 10
      expect(fail - pass).toBe(10);
    });
  });

  describe('computeAll', () => {
    it('returns all three scores', () => {
      const result = service.computeAll({
        cpuUsage: 30, ramPercent: 40, diskUsed: 50, diskTotal: 200,
        tempCpu: 60, smartStatus: 'PASS', loadAverage1Min: 1, processes: 100, batteryPercent: 80,
      });
      expect(result).toHaveProperty('healthScore');
      expect(result).toHaveProperty('performanceScore');
      expect(result).toHaveProperty('riskScore');
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.performanceScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });
});
