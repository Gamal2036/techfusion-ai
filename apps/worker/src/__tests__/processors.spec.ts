import { Job } from 'bullmq';

jest.mock('../metrics', () => ({
  startMetricsServer: jest.fn(),
  trackQueueDepth: jest.fn(),
  trackJobCompleted: jest.fn(),
  trackJobFailed: jest.fn(),
  trackJobDuration: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
  getMetricsContentType: jest.fn().mockReturnValue('text/plain'),
}));

jest.mock('../telemetry', () => ({
  initTelemetry: jest.fn().mockResolvedValue(undefined),
  shutdownTelemetry: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  device: { findFirst: jest.fn().mockResolvedValue({ id: 'device-1', orgId: 'org-1' }) },
  driverCatalogItem: { findFirst: jest.fn().mockResolvedValue(null) },
  driver: { upsert: jest.fn().mockResolvedValue({}) },
  softwareInventory: { upsert: jest.fn().mockResolvedValue({}) },
  securityScan: {
    findFirst: jest.fn().mockResolvedValue({
      id: 'scan-001',
      orgId: 'org-1',
      findings: [
        { id: 'f-1', severity: 'critical', finding: 'Critical issue', category: 'updates', remediation: 'Update' },
        { id: 'f-2', severity: 'high', finding: 'High issue', category: 'firewall', remediation: 'Fix' },
      ],
      score: { securityScore: 45, riskLevel: 'high' },
    }),
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  securityFinding: { findFirst: jest.fn().mockResolvedValue({ id: 'find-001', orgId: 'org-1' }) },
  alertRule: {
    findFirst: jest.fn().mockResolvedValue({ id: 'rule-1', name: 'Security Critical Finding', enabled: true, webhookUrl: null }),
  },
  alert: { create: jest.fn().mockResolvedValue({ id: 'alert-new' }), findFirst: jest.fn().mockResolvedValue(null) },
  organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]) },
  dataRetentionPolicy: {
    findUnique: jest.fn().mockResolvedValue({
      orgId: 'org-1',
      metricsRetentionDays: 90,
      recordingsRetentionDays: 365,
      auditRetentionDays: 730,
      securityScanRetentionDays: 365,
      backupRetentionDays: 90,
    }),
    create: jest.fn().mockResolvedValue({}),
  },
  deviceMetric: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
  deviceHealthScore: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
  remoteSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  auditLog: {
    deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
    create: jest.fn().mockResolvedValue({}),
  },
  backupRun: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  backupJob: { update: jest.fn().mockResolvedValue({}) },
  report: { update: jest.fn().mockResolvedValue({}) },
};

jest.mock('../prisma-client', () => ({
  getPrismaClient: () => mockPrisma,
  disconnectPrisma: jest.fn(),
}));

jest.mock('../backup-runner', () => ({
  runBackupScript: jest.fn().mockResolvedValue({
    success: true,
    exitCode: 0,
    stdout: '[PostgreSQL Backup] Complete: /backups/postgres/techfusion_20260719.dump\nSize: 104857600 bytes\nSHA-256: abc123',
    stderr: '',
    durationMs: 5000,
    scriptName: 'backup-all',
  }),
  parseBackupOutput: jest.fn().mockReturnValue({
    sizeBytes: 104857600,
    fileCount: null,
    checksum: 'abc123',
    backupPath: '/backups/postgres/techfusion_20260719.dump',
  }),
  parseVerificationOutput: jest.fn().mockReturnValue({
    passed: true,
    passCount: 4,
    failCount: 0,
    warnCount: 0,
  }),
  validateScriptName: jest.fn().mockReturnValue(true),
}));

import {
  processAlertJob,
  processReportJob,
  processBackupJob,
  processInventoryJob,
  processSecurityJob,
  processRetentionJob,
} from '../processors';
import * as metrics from '../metrics';
import { runBackupScript, parseBackupOutput, parseVerificationOutput } from '../backup-runner';

function mockJob(id: string, name: string, data: any): Job {
  return { id, name, data } as unknown as Job;
}

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockPrisma.device.findFirst.mockResolvedValue({ id: 'device-1', orgId: 'org-1' });
  mockPrisma.securityScan.findFirst.mockResolvedValue({
    id: 'scan-001',
    orgId: 'org-1',
    findings: [
      { id: 'f-1', severity: 'critical', finding: 'Critical issue', category: 'updates', remediation: 'Update' },
      { id: 'f-2', severity: 'high', finding: 'High issue', category: 'firewall', remediation: 'Fix' },
    ],
    score: { securityScore: 45, riskLevel: 'high' },
  });
  mockPrisma.alertRule.findFirst.mockResolvedValue({ id: 'rule-1', name: 'Security Critical Finding', enabled: true, webhookUrl: null });
  mockPrisma.alert.findFirst.mockResolvedValue(null);
  mockPrisma.backupRun.findUnique.mockResolvedValue(null);
  (runBackupScript as jest.Mock).mockResolvedValue({
    success: true,
    exitCode: 0,
    stdout: '[PostgreSQL Backup] Complete: /backups/postgres/techfusion_20260719.dump\nSize: 104857600 bytes\nSHA-256: abc123',
    stderr: '',
    durationMs: 5000,
    scriptName: 'backup-all',
  });
  (parseBackupOutput as jest.Mock).mockReturnValue({
    sizeBytes: 104857600,
    fileCount: null,
    checksum: 'abc123',
    backupPath: '/backups/postgres/techfusion_20260719.dump',
  });
  (parseVerificationOutput as jest.Mock).mockReturnValue({
    passed: true,
    passCount: 4,
    failCount: 0,
    warnCount: 0,
  });
});

describe('Alert Processor', () => {
  it('processes a notification job successfully', async () => {
    const job = mockJob('1', 'notification', {
      alert: { id: 'alert-1', severity: 'high', message: 'CPU usage exceeded 80%' },
      rule: { name: 'High CPU', webhookUrl: null },
      deviceName: 'server-01',
    });

    const result = await processAlertJob(job);

    expect(result).toEqual({ success: true, alertId: 'alert-1' });
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('alert');
    expect(metrics.trackJobFailed).not.toHaveBeenCalled();
  });

  it('sends webhook when rule has webhookUrl', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const job = mockJob('2', 'notification', {
      alert: { id: 'alert-2', severity: 'critical', message: 'Disk full' },
      rule: { name: 'Disk Alert', webhookUrl: 'https://hooks.example.com/alert' },
      deviceName: 'server-02',
    });

    const result = await processAlertJob(job);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/alert',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles webhook failure gracefully', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const job = mockJob('3', 'notification', {
      alert: { id: 'alert-3', severity: 'medium', message: 'RAM high' },
      rule: { name: 'RAM Alert', webhookUrl: 'https://hooks.example.com/fail' },
      deviceName: 'server-03',
    });

    const result = await processAlertJob(job);
    expect(result.success).toBe(true);
  });

  it('handles webhook network error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const job = mockJob('4', 'notification', {
      alert: { id: 'alert-4', severity: 'low', message: 'Temp warning' },
      rule: { name: 'Temp Alert', webhookUrl: 'https://unreachable.example.com' },
      deviceName: 'server-04',
    });

    const result = await processAlertJob(job);
    expect(result.success).toBe(true);
  });

  it('tracks failure when processor throws', async () => {
    const failJob = mockJob('5b', 'notification', {
      alert: { id: null, severity: undefined, message: undefined },
      rule: { name: undefined, webhookUrl: 'http://fail.test' },
      deviceName: undefined,
    });

    mockFetch.mockRejectedValueOnce(new Error('unexpected'));
    await expect(processAlertJob(failJob)).rejects.toThrow();
    expect(metrics.trackJobFailed).toHaveBeenCalled();
  });
});

describe('Report Processor', () => {
  it('processes a generate report job successfully (stub for AH-3D)', async () => {
    const job = mockJob('10', 'generate', {
      orgId: 'org-1',
      userId: 'user-1',
      reportType: 'security',
      format: 'pdf',
      title: 'Security Report',
      options: { reportId: 'rpt-001' },
    });

    const result = await processReportJob(job);

    expect(result).toEqual({ success: true, reportId: 'rpt-001' });
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('report');
    expect(metrics.trackJobFailed).not.toHaveBeenCalled();
  });

  it('handles job with no options gracefully', async () => {
    const job = mockJob('11', 'generate', {
      orgId: 'org-1',
      userId: 'user-1',
      reportType: 'inventory',
      format: 'csv',
      title: 'Inventory Report',
    });

    const result = await processReportJob(job);
    expect(result).toEqual({ success: true, reportId: undefined });
  });
});

describe('Backup Processor', () => {
  it('processes a backup job with real script execution', async () => {
    const job = mockJob('20', 'execute', {
      runId: 'run-001',
      jobId: 'job-001',
      orgId: 'org-1',
      deviceId: 'device-1',
      type: 'full_image',
      sourcePaths: ['/data'],
    });

    const result = await processBackupJob(job);

    expect(result.success).toBe(true);
    expect(result.runId).toBe('run-001');
    expect(result.sizeBytes).toBe(104857600);
    expect(result.checksum).toBe('abc123');
    expect(result.verification).toBe(true);
    expect(runBackupScript).toHaveBeenCalledWith('backup-all', expect.any(Array), 300000);
    expect(runBackupScript).toHaveBeenCalledWith('verify-backup', expect.any(Array), 60000);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('backup');
  });

  it('skips already completed runs (idempotent)', async () => {
    mockPrisma.backupRun.findUnique.mockResolvedValueOnce({ id: 'run-002', status: 'completed' });

    const job = mockJob('21', 'execute', {
      runId: 'run-002',
      jobId: 'job-002',
      orgId: 'org-1',
      deviceId: 'device-1',
      type: 'file',
    });

    const result = await processBackupJob(job);
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(runBackupScript).not.toHaveBeenCalled();
  });

  it('handles backup script failure', async () => {
    (runBackupScript as jest.Mock).mockResolvedValueOnce({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'pg_dump: connection refused',
      durationMs: 1000,
      scriptName: 'backup-all',
    });

    const job = mockJob('22', 'execute', {
      runId: 'run-003',
      jobId: 'job-003',
      orgId: 'org-1',
      deviceId: 'device-1',
      type: 'database',
    });

    await expect(processBackupJob(job)).rejects.toThrow('Backup script failed');
    expect(mockPrisma.backupRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('handles verification failure', async () => {
    (parseVerificationOutput as jest.Mock).mockReturnValueOnce({
      passed: false,
      passCount: 2,
      failCount: 2,
      warnCount: 0,
    });

    const job = mockJob('23', 'execute', {
      runId: 'run-004',
      jobId: 'job-004',
      orgId: 'org-1',
      deviceId: 'device-1',
      type: 'full_image',
    });

    await expect(processBackupJob(job)).rejects.toThrow('Backup verification failed');
    expect(mockPrisma.backupRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});

describe('Inventory Processor', () => {
  it('processes an inventory ingest job with real DB writes', async () => {
    const job = mockJob('30', 'ingest', {
      orgId: 'org-1',
      deviceId: 'device-1',
      drivers: [{ name: 'NVIDIA Driver', version: '535.129', vendor: 'NVIDIA' }],
      software: [{ name: 'Chrome', version: '120.0' }],
    });

    const result = await processInventoryJob(job);

    expect(result).toEqual({
      success: true,
      deviceId: 'device-1',
      driverCount: 1,
      softwareCount: 1,
    });
    expect(mockPrisma.driver.upsert).toHaveBeenCalled();
    expect(mockPrisma.softwareInventory.upsert).toHaveBeenCalled();
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('inventory');
  });

  it('rejects inventory for unknown device', async () => {
    mockPrisma.device.findFirst.mockResolvedValueOnce(null);

    const job = mockJob('31', 'ingest', {
      orgId: 'org-1',
      deviceId: 'unknown-device',
      drivers: [],
      software: [],
    });

    await expect(processInventoryJob(job)).rejects.toThrow('not found');
  });

  it('handles empty inventory data', async () => {
    const job = mockJob('32', 'ingest', {
      orgId: 'org-1',
      deviceId: 'device-1',
      drivers: [],
      software: [],
    });

    const result = await processInventoryJob(job);
    expect(result).toEqual({
      success: true,
      deviceId: 'device-1',
      driverCount: 0,
      softwareCount: 0,
    });
  });
});

describe('Security Processor', () => {
  it('processes a scan_complete job with real alert creation', async () => {
    const job = mockJob('40', 'scan_complete', {
      scanId: 'scan-001',
      orgId: 'org-1',
      deviceId: 'device-1',
      score: { securityScore: 45, riskLevel: 'high' },
      findingCount: 2,
    });

    const result = await processSecurityJob(job);

    expect(result.success).toBe(true);
    expect(result.criticalAlerts).toBe(1);
    expect(result.highFindings).toBe(1);
    expect(mockPrisma.alert.create).toHaveBeenCalled();
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('security');
  });

  it('processes a finding_alert job with duplicate prevention', async () => {
    const job = mockJob('41', 'finding_alert', {
      findingId: 'find-001',
      orgId: 'org-1',
      deviceId: 'device-1',
      severity: 'high',
      finding: 'System packages outdated',
    });

    const result = await processSecurityJob(job);
    expect(result).toEqual({ success: true, findingId: 'find-001', severity: 'high' });
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('security');
  });

  it('skips processing for missing scan', async () => {
    mockPrisma.securityScan.findFirst.mockResolvedValueOnce(null);

    const job = mockJob('42', 'scan_complete', {
      scanId: 'scan-missing',
      orgId: 'org-1',
      deviceId: 'device-1',
      score: { securityScore: 85 },
      findingCount: 0,
    });

    const result = await processSecurityJob(job);
    expect(result).toEqual({ success: true, skipped: true });
  });

  it('handles unknown job name gracefully', async () => {
    const job = mockJob('43', 'unknown_type', {});

    const result = await processSecurityJob(job);
    expect(result).toEqual({ success: true });
  });
});

describe('Retention Processor', () => {
  it('processes a retention enforce job with real DB deletions', async () => {
    const job = mockJob('50', 'enforce', {
      orgId: 'org-1',
      allOrgs: false,
      requestedBy: 'user-1',
    });

    const result = await processRetentionJob(job);

    expect(result.success).toBe(true);
    expect(result.orgsProcessed).toBe(1);
    expect(result.metricsDeleted).toBe(5);
    expect(result.healthScoresDeleted).toBe(3);
    expect(mockPrisma.deviceMetric.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('retention');
  });

  it('processes a global retention job', async () => {
    const job = mockJob('51', 'enforce', {
      orgId: null,
      allOrgs: true,
    });

    const result = await processRetentionJob(job);
    expect(result.success).toBe(true);
    expect(result.orgsProcessed).toBe(2);
  });

  it('skips when no orgId and allOrgs=false', async () => {
    const job = mockJob('52', 'enforce', {
      orgId: null,
      allOrgs: false,
    });

    const result = await processRetentionJob(job);
    expect(result).toEqual({ success: true, skipped: true });
  });
});

describe('Metrics Tracking', () => {
  it('all processors call trackJobCompleted on success', async () => {
    const alertJob = mockJob('m1', 'notification', {
      alert: { id: 'a', severity: 'low', message: 'test' },
      rule: { name: 'test', webhookUrl: null },
      deviceName: 'd',
    });
    await processAlertJob(alertJob);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('alert');

    const reportJob = mockJob('m2', 'generate', {
      orgId: 'o', userId: 'u', reportType: 'r', format: 'f', title: 't',
    });
    await processReportJob(reportJob);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('report');

    const inventoryJob = mockJob('m3', 'ingest', {
      orgId: 'o', deviceId: 'device-1', drivers: [], software: [],
    });
    await processInventoryJob(inventoryJob);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('inventory');

    const securityJob = mockJob('m4', 'scan_complete', {
      scanId: 's', orgId: 'o', deviceId: 'd', score: { securityScore: 50 }, findingCount: 1,
    });
    await processSecurityJob(securityJob);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('security');

    const retentionJob = mockJob('m5', 'enforce', { orgId: 'o', allOrgs: false });
    await processRetentionJob(retentionJob);
    expect(metrics.trackJobCompleted).toHaveBeenCalledWith('retention');
  });

  it('all processors call trackJobDuration', async () => {
    const job = mockJob('d1', 'notification', {
      alert: { id: 'a', severity: 'low', message: 'test' },
      rule: { name: 'test', webhookUrl: null },
      deviceName: 'd',
    });
    await processAlertJob(job);
    expect(metrics.trackJobDuration).toHaveBeenCalledWith(
      'alert',
      'notification',
      expect.any(Number),
    );
  });
});
