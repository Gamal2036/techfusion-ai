import { Job } from 'bullmq';
import { trackJobCompleted, trackJobFailed, trackJobDuration } from './metrics';
import { QUEUE_NAMES, JOB_NAMES } from './queue-names';
import { createWorkerLogger } from './structured-logger';
import { extractCorrelationFromJob } from './correlation';
import { SecurityFinding } from '@prisma/client';
import { getPrismaClient } from './prisma-client';
import { runBackupScript, parseBackupOutput, parseVerificationOutput, type BackupScriptResult } from './backup-runner';

const EMBEDDING_DIMENSION = 1536;

const loggers: Record<string, ReturnType<typeof createWorkerLogger>> = {};
function getJobLogger(queueName: string): ReturnType<typeof createWorkerLogger> {
  if (!loggers[queueName]) {
    loggers[queueName] = createWorkerLogger(queueName.charAt(0).toUpperCase() + queueName.slice(1));
  }
  return loggers[queueName];
}

function getCorrelation(job: Job) {
  return extractCorrelationFromJob(job.data as Record<string, unknown>);
}

// ─── Alert Processor ───────────────────────────────────────────

export async function processAlertJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.ALERT);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.ALERT,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const { alert, rule, deviceName } = job.data;

    log.log(`${alert.severity.toUpperCase()}: ${alert.message}`, {
      queueName: QUEUE_NAMES.ALERT,
      jobId: job.id?.toString(),
    });

    log.log(`[EMAIL] To: admin@techfusion.ai Subject: Alert - ${rule.name}`, {
      queueName: QUEUE_NAMES.ALERT,
      jobId: job.id?.toString(),
    });

    if (rule.webhookUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(rule.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'alert',
            alert,
            deviceName,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          log.warn(`Webhook ${response.status}`, { queueName: QUEUE_NAMES.ALERT, jobId: job.id?.toString() });
        }
      } catch (err) {
        log.error('Webhook failed', {
          queueName: QUEUE_NAMES.ALERT,
          jobId: job.id?.toString(),
          errorType: 'WebhookError',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.ALERT);
    trackJobDuration(QUEUE_NAMES.ALERT, job.name || 'notification', duration);

    log.log('Job completed', {
      queueName: QUEUE_NAMES.ALERT,
      jobId: job.id?.toString(),
      duration,
      requestId: corr?.requestId,
      correlationId: corr?.correlationId,
    });

    return { success: true, alertId: alert.id };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.ALERT, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Report Processor ─────────────────────────────────────────

export async function processReportJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.REPORT);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.REPORT,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const { orgId, userId, reportType, format, title, options } = job.data;
    log.log(`Delegating ${reportType} report "${title}" (${format}) to API gateway`, {
      queueName: QUEUE_NAMES.REPORT,
      jobId: job.id?.toString(),
      orgId,
    });

    const apiUrl = process.env.TF_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: reportType,
        format,
        title,
        description: `Auto-generated via scheduled report: ${title}`,
        deviceIds: options?.deviceIds,
        scanId: options?.scanId,
        generateAiSummary: options?.generateAiSummary,
        _triggeredBy: 'worker',
        _userId: userId,
        _orgId: orgId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API gateway report generation failed (${response.status}): ${errText}`);
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.REPORT);
    trackJobDuration(QUEUE_NAMES.REPORT, job.name || 'generate', duration);

    log.log(`Report generation delegated for ${options?.reportId || 'unknown'}`, {
      queueName: QUEUE_NAMES.REPORT,
      jobId: job.id?.toString(),
      duration,
    });

    return { success: true, delegated: true, reportId: options?.reportId };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.REPORT, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Backup Verify Handler ────────────────────────────────────

export async function processBackupVerify(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.BACKUP);
  const corr = getCorrelation(job);
  const { runId, orgId, deviceId, archivePath } = job.data;
  const prisma = getPrismaClient();

  log.log(`Verifying backup run ${runId}, archive: ${archivePath}`, {
    queueName: QUEUE_NAMES.BACKUP,
    jobId: job.id?.toString(),
    orgId,
  });

  try {
    if (!archivePath) {
      throw new Error('No archive path provided for verification');
    }

    const run = await prisma.backupRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new Error(`Backup run ${runId} not found`);
    }

    const storedChecksum = (run.metadata as any)?.checksum;

    let verifyArgs = ['--archive-path', archivePath];
    if (storedChecksum) {
      verifyArgs.push('--archive-checksum', storedChecksum);
    }

    const verifyResult = await runBackupScript('verify-backup', verifyArgs, 60000);
    const verification = parseVerificationOutput(verifyResult.stdout);

    let verificationStatus: string;
    if (!verifyResult.success || verification.failCount > 0) {
      verificationStatus = 'Verification Failed';
      log.error(`Verification failed for run ${runId}: ${verification.failCount} failures`, {
        queueName: QUEUE_NAMES.BACKUP,
        jobId: job.id?.toString(),
      });
    } else if (storedChecksum) {
      const actualChecksum = verifyResult.stdout.match(/checksum matches expected/i);
      const checksumValid = verifyResult.stdout.match(/Checksum valid/i);
      if (actualChecksum || checksumValid) {
        verificationStatus = 'Verified';
        log.log(`Run ${runId} verified successfully`, {
          queueName: QUEUE_NAMES.BACKUP,
          jobId: job.id?.toString(),
        });
      } else {
        verificationStatus = 'Corrupted';
        log.error(`Checksum mismatch for run ${runId}`, {
          queueName: QUEUE_NAMES.BACKUP,
          jobId: job.id?.toString(),
        });
      }
    } else {
      verificationStatus = verification.failCount === 0 ? 'Verified' : 'Verification Failed';
    }

    const existingMeta = (run.metadata as any) || {};
    await prisma.backupRun.update({
      where: { id: runId },
      data: {
        metadata: {
          ...existingMeta,
          verification: {
            ...(existingMeta.verification || {}),
            status: verificationStatus,
            lastVerifiedAt: new Date().toISOString(),
            passCount: verification.passCount,
            failCount: verification.failCount,
            warnCount: verification.warnCount,
          },
        },
      },
    }).catch(() => {});

    trackJobCompleted(QUEUE_NAMES.BACKUP);
    trackJobDuration(QUEUE_NAMES.BACKUP, 'verify', (Date.now() - start) / 1000);

    log.log(`Verification complete for run ${runId}: ${verificationStatus}`, {
      queueName: QUEUE_NAMES.BACKUP,
      jobId: job.id?.toString(),
      duration: (Date.now() - start) / 1000,
    });

    return { success: verificationStatus === 'Verified', runId, verificationStatus };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.BACKUP, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Backup Processor ─────────────────────────────────────────

export async function processBackupJob(job: Job): Promise<any> {
  if (job.name === JOB_NAMES.BACKUP.VERIFY) {
    return processBackupVerify(job);
  }
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.BACKUP);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.BACKUP,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  if (job.name === JOB_NAMES.BACKUP.RESTORE) {
    const { runId, orgId, deviceId, type, destPath } = job.data;
    const prisma = getPrismaClient();
    log.log(`Restore job for run ${runId} (type: ${type})`, { queueName: QUEUE_NAMES.BACKUP, jobId: job.id?.toString(), orgId });

    await prisma.backupRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    }).catch(() => {});

    const runBackupScript = (await import('./backup-runner')).runBackupScript;

    let result: BackupScriptResult;

    if (type === 'restore-postgres') {
      result = await runBackupScript('restore-postgres', [], 300000);
    } else if (type === 'file') {
      const run = await prisma.backupRun.findUnique({ where: { id: runId }, select: { metadata: true } });
      const metadata = (run?.metadata as any) || {};
      const archivePath = metadata?.backupPath || '';
      const restoreDest = destPath || '/tmp/techfusion-recovery';

      if (!archivePath) {
        result = {
          success: false, exitCode: 1, stdout: '', stderr: 'No backup archive path found for file restore',
          durationMs: Date.now() - start, scriptName: 'restore-files',
        };
      } else {
        result = await runBackupScript('restore-files', ['--archive', archivePath, '--dest', restoreDest], 300000);
      }
    } else {
      result = {
        success: false, exitCode: 1, stdout: '', stderr: `Unsupported restore type: ${type}`,
        durationMs: Date.now() - start, scriptName: 'unknown',
      };
    }

    const status = result.success ? 'completed' : 'failed';
    await prisma.backupRun.update({
      where: { id: runId },
      data: { status, completedAt: new Date(), errorMessage: result.success ? null : result.stderr.slice(0, 2000) },
    }).catch(() => {});

    trackJobCompleted(QUEUE_NAMES.BACKUP);
    trackJobDuration(QUEUE_NAMES.BACKUP, 'restore', (Date.now() - start) / 1000);

    log.log(`Restore ${status} for run ${runId}`, { queueName: QUEUE_NAMES.BACKUP, jobId: job.id?.toString() });
    return { success: result.success, runId };
  }

  const { runId, jobId: backupJobId, orgId, deviceId, type, sourcePaths } = job.data;

  try {
    log.log(`Executing backup run ${runId} (${type})`, {
      queueName: QUEUE_NAMES.BACKUP,
      jobId: job.id?.toString(),
      orgId,
    });

    const prisma = getPrismaClient();

    const existingRun = await prisma.backupRun.findUnique({ where: { id: runId } });
    if (existingRun && existingRun.status === 'completed') {
      log.log(`Run ${runId} already completed (idempotent skip)`, {
        queueName: QUEUE_NAMES.BACKUP,
        jobId: job.id?.toString(),
      });
      return { success: true, runId, skipped: true };
    }

    await prisma.backupRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    }).catch(() => {});

    let scriptName: string;
    let scriptArgs: string[] = [];

    switch (type) {
      case 'full_image':
      case 'database':
        scriptName = 'backup-all';
        break;
      case 'file':
        scriptName = 'backup-files';
        if (sourcePaths) {
          let paths: string[] = [];
          try {
            paths = JSON.parse(sourcePaths);
          } catch {
            paths = sourcePaths.split(',').map((s: string) => s.trim());
          }
          if (paths.length > 0) {
            scriptArgs = ['--paths', paths.join(','), '--job-label', `run-${runId}`];
          }
        }
        break;
      case 'config':
        scriptName = 'backup-config';
        break;
      default:
        scriptName = 'backup-all';
    }

    log.log(`Running script: ${scriptName}`, {
      queueName: QUEUE_NAMES.BACKUP,
      jobId: job.id?.toString(),
      orgId,
    });

    const result = await runBackupScript(scriptName, scriptArgs, 300000);

    if (!result.success) {
      log.error(`Backup script failed: ${result.stderr}`, {
        queueName: QUEUE_NAMES.BACKUP,
        jobId: job.id?.toString(),
        errorType: 'BackupScriptError',
        errorMessage: result.stderr.slice(0, 500),
      });

      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: result.stderr.slice(0, 2000) || `Script exited with code ${result.exitCode}`,
          metadata: {
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            scriptName,
          },
        },
      }).catch(() => {});

      trackJobFailed(QUEUE_NAMES.BACKUP, result.stderr.slice(0, 200));
      throw new Error(`Backup script failed with exit code ${result.exitCode}`);
    }

    const parsed = parseBackupOutput(result.stdout);

    if (!parsed.backupPath) {
      log.error(`No backup archive created for run ${runId}`, {
        queueName: QUEUE_NAMES.BACKUP,
        jobId: job.id?.toString(),
        errorType: 'ArtifactMissing',
      });

      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'Backup script completed but no archive was created',
          metadata: {
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            scriptName,
          },
        },
      }).catch(() => {});

      trackJobFailed(QUEUE_NAMES.BACKUP, 'No backup archive created');
      throw new Error('Backup script completed but no archive was created');
    }

    let verificationStatus: string;
    let verificationPassed = false;
    let verifyFailCount = 0;

    log.log(`Running verification for archive: ${parsed.backupPath}`, {
      queueName: QUEUE_NAMES.BACKUP,
      jobId: job.id?.toString(),
    });

    let verifyArgs = ['--archive-path', parsed.backupPath];
    if (parsed.checksum) {
      verifyArgs.push('--archive-checksum', parsed.checksum);
    }
    const verifyResult = await runBackupScript('verify-backup', verifyArgs, 60000);
    const verification = parseVerificationOutput(verifyResult.stdout);

    if (!verifyResult.success || verification.failCount > 0) {
      verificationPassed = false;
      verifyFailCount = verification.failCount;
      verificationStatus = 'Verification Failed';
    } else {
      verificationPassed = true;
      verificationStatus = 'Verified';
    }

    if (!verificationPassed) {
      log.error(`Backup verification failed: ${verifyFailCount} failures`, {
        queueName: QUEUE_NAMES.BACKUP,
        jobId: job.id?.toString(),
        errorType: 'VerificationError',
      });

      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: `Verification failed: ${verifyFailCount} checks failed`,
          metadata: {
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            scriptName,
            checksum: parsed.checksum,
            checksumAlgorithm: 'sha256',
            backupPath: parsed.backupPath,
            verification: {
              status: verificationStatus,
              failCount: verifyFailCount,
              passCount: verification.passCount,
              warnCount: verification.warnCount,
            },
          },
        },
      }).catch(() => {});

      throw new Error('Backup verification failed');
    }

    const completedAt = new Date();
    const totalDuration = Date.now() - start;

    await prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt,
        sizeBytes: parsed.sizeBytes ? BigInt(parsed.sizeBytes) : null,
        fileCount: parsed.fileCount,
        metadata: {
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          totalDurationMs: totalDuration,
          scriptName,
          checksum: parsed.checksum,
          checksumAlgorithm: 'sha256',
          backupPath: parsed.backupPath,
          verification: {
            status: verificationStatus,
            passCount: verification.passCount,
            failCount: verifyFailCount,
            warnCount: verification.warnCount,
            lastVerifiedAt: completedAt.toISOString(),
          },
        },
      },
    }).catch(() => {});

    await prisma.backupJob.update({
      where: { id: backupJobId },
      data: { lastRunAt: completedAt },
    }).catch(() => {});

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.BACKUP);
    trackJobDuration(QUEUE_NAMES.BACKUP, job.name || 'execute', duration);

    log.log(`Run ${runId} completed: ${parsed.sizeBytes || 0} bytes, verified`, {
      queueName: QUEUE_NAMES.BACKUP,
      jobId: job.id?.toString(),
      duration,
    });

    return {
      success: true,
      runId,
      sizeBytes: parsed.sizeBytes,
      checksum: parsed.checksum,
      verification: verification.passed,
    };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.BACKUP, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Inventory Processor ──────────────────────────────────────

export async function processInventoryJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.INVENTORY);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.INVENTORY,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const { orgId, deviceId, drivers, software, reportType, reportVersion, collectedAt, payloadHash } = job.data;

    log.log(`Ingesting inventory: ${drivers?.length || 0} drivers, ${software?.length || 0} software`, {
      queueName: QUEUE_NAMES.INVENTORY,
      jobId: job.id?.toString(),
      orgId,
    });

    const prisma = getPrismaClient();

    const device = await prisma.device.findFirst({
      where: { id: deviceId, orgId },
      select: { id: true },
    });

    if (!device) {
      log.error(`Device ${deviceId} not found or not in org ${orgId}`, {
        queueName: QUEUE_NAMES.INVENTORY,
        jobId: job.id?.toString(),
      });
      throw new Error(`Device ${deviceId} not found in organization ${orgId}`);
    }

    let driverCount = 0;
    let softwareCount = 0;

    if (drivers && Array.isArray(drivers)) {
      for (const d of drivers) {
        try {
          const catalogEntry = await prisma.driverCatalogItem.findFirst({
            where: { name: d.name },
          });

          let status = 'unknown';
          if (catalogEntry && d.version && catalogEntry.latestVersion) {
            const parseVersion = (v: string): number[] =>
              v.split(/[.\-_]/).map((s) => { const n = parseInt(s, 10); return isNaN(n) ? 0 : n; });
            const aParts = parseVersion(d.version);
            const bParts = parseVersion(catalogEntry.latestVersion);
            const len = Math.max(aParts.length, bParts.length);
            let cmp = 0;
            for (let i = 0; i < len; i++) {
              const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
              if (diff !== 0) { cmp = diff > 0 ? 1 : -1; break; }
            }
            status = cmp >= 0 ? 'current' : 'outdated';
          } else if (catalogEntry) {
            status = 'missing';
          }

          await prisma.driver.upsert({
            where: { orgId_name: { orgId, name: d.name } },
            update: {
              vendor: d.vendor || null,
              version: d.version || null,
              modulePath: d.module_path || null,
              usedBy: d.used_by || null,
              source: d.source || 'kernel_module',
              status,
              lastSeenAt: new Date(),
              metadata: d,
            },
            create: {
              orgId,
              name: d.name,
              vendor: d.vendor || null,
              version: d.version || null,
              modulePath: d.module_path || null,
              usedBy: d.used_by || null,
              source: d.source || 'kernel_module',
              status,
              metadata: d,
            },
          });
          driverCount++;
        } catch (e: any) {
          log.warn(`Failed to upsert driver ${d.name}: ${e.message}`, {
            queueName: QUEUE_NAMES.INVENTORY,
            jobId: job.id?.toString(),
          });
        }
      }
    }

    if (software && Array.isArray(software)) {
      for (const s of software) {
        try {
          await prisma.softwareInventory.upsert({
            where: { orgId_name: { orgId, name: s.name } },
            update: {
              version: s.version || null,
              vendor: s.vendor || null,
              installDate: s.install_date || null,
              description: s.description || null,
              source: s.source || 'deb',
              lastSeenAt: new Date(),
              metadata: s,
            },
            create: {
              orgId,
              name: s.name,
              version: s.version || null,
              vendor: s.vendor || null,
              installDate: s.install_date || null,
              description: s.description || null,
              source: s.source || 'deb',
              metadata: s,
            },
          });
          softwareCount++;
        } catch (e: any) {
          log.warn(`Failed to upsert software ${s.name}: ${e.message}`, {
            queueName: QUEUE_NAMES.INVENTORY,
            jobId: job.id?.toString(),
          });
        }
      }
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.INVENTORY);
    trackJobDuration(QUEUE_NAMES.INVENTORY, job.name || 'ingest', duration);

    log.log(`Inventory completed: ${driverCount} drivers, ${softwareCount} software persisted`, {
      queueName: QUEUE_NAMES.INVENTORY,
      jobId: job.id?.toString(),
      orgId,
      duration,
    });

    return { success: true, deviceId, driverCount, softwareCount };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.INVENTORY, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Security Processor ───────────────────────────────────────

export async function processSecurityJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.SECURITY);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.SECURITY,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const prisma = getPrismaClient();

    if (job.name === JOB_NAMES.SECURITY.SCAN_COMPLETE) {
      const { scanId, orgId, deviceId, score, findingCount } = job.data;

      const scan = await prisma.securityScan.findFirst({
        where: { id: scanId, orgId },
        include: { findings: true, score: true },
      });

      if (!scan) {
        log.warn(`Scan ${scanId} not found or not in org ${orgId}`, {
          queueName: QUEUE_NAMES.SECURITY,
          jobId: job.id?.toString(),
        });
        return { success: true, skipped: true };
      }

      log.log(`Scan ${scanId} completed: score=${score?.securityScore}, findings=${findingCount}`, {
        queueName: QUEUE_NAMES.SECURITY,
        jobId: job.id?.toString(),
        orgId,
      });

      const criticalFindings = scan.findings.filter((f: SecurityFinding) => f.severity === 'critical');
      const highFindings = scan.findings.filter((f: SecurityFinding) => f.severity === 'high');

      if (criticalFindings.length > 0) {
        log.warn(`Alert: ${criticalFindings.length} critical findings in scan ${scanId}`, {
          queueName: QUEUE_NAMES.SECURITY,
          jobId: job.id?.toString(),
          orgId,
        });

        const alertRule = await prisma.alertRule.findFirst({
          where: { orgId, name: 'Security Critical Finding', enabled: true },
        });

        if (alertRule) {
          for (const finding of criticalFindings) {
            const alert = await prisma.alert.create({
              data: {
                orgId,
                alertRuleId: alertRule.id,
                deviceId,
                metricValue: 0,
                threshold: 0,
                severity: 'critical',
                message: `Security: ${finding.finding}`,
              },
            });

            if (alertRule.webhookUrl) {
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);
                await fetch(alertRule.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'security_critical_finding',
                    alertId: alert.id,
                    scanId,
                    findingId: finding.id,
                    finding: finding.finding,
                    category: finding.category,
                    severity: finding.severity,
                    remediation: finding.remediation,
                    deviceId,
                    orgId,
                    timestamp: new Date().toISOString(),
                  }),
                  signal: controller.signal,
                });
                clearTimeout(timeout);
              } catch (err) {
                log.error('Security webhook failed', {
                  queueName: QUEUE_NAMES.SECURITY,
                  jobId: job.id?.toString(),
                  errorType: 'WebhookError',
                  errorMessage: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }
        }
      }

      if (highFindings.length > 0) {
        log.log(`${highFindings.length} high-severity findings in scan ${scanId}`, {
          queueName: QUEUE_NAMES.SECURITY,
          jobId: job.id?.toString(),
          orgId,
        });
      }

      const duration = (Date.now() - start) / 1000;
      trackJobCompleted(QUEUE_NAMES.SECURITY);
      trackJobDuration(QUEUE_NAMES.SECURITY, job.name || 'scan_complete', duration);

      return {
        success: true,
        scanId,
        criticalAlerts: criticalFindings.length,
        highFindings: highFindings.length,
      };
    } else if (job.name === JOB_NAMES.SECURITY.FINDING_ALERT) {
      const { findingId, orgId, deviceId, severity, finding } = job.data;

      const existingFinding = await prisma.securityFinding.findFirst({
        where: { id: findingId, orgId },
      });

      if (!existingFinding) {
        log.warn(`Finding ${findingId} not found or not in org ${orgId}`, {
          queueName: QUEUE_NAMES.SECURITY,
          jobId: job.id?.toString(),
        });
        return { success: true, skipped: true };
      }

      log.log(`Processing finding alert: [${severity}] ${finding}`, {
        queueName: QUEUE_NAMES.SECURITY,
        jobId: job.id?.toString(),
        orgId,
      });

      const alertRule = await prisma.alertRule.findFirst({
        where: { orgId, name: 'Security Finding Alert', enabled: true },
      });

      if (alertRule) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            orgId,
            alertRuleId: alertRule.id,
            deviceId,
            message: { contains: findingId },
          },
        });

        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              orgId,
              alertRuleId: alertRule.id,
              deviceId,
              metricValue: 0,
              threshold: 0,
              severity,
              message: `Security finding [${severity}]: ${finding} (finding: ${findingId})`,
            },
          });
        }
      }

      if (alertRule?.webhookUrl) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          await fetch(alertRule.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'security_finding',
              findingId,
              severity,
              finding,
              deviceId,
              orgId,
              timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } catch (err) {
          log.error('Security finding webhook failed', {
            queueName: QUEUE_NAMES.SECURITY,
            jobId: job.id?.toString(),
            errorType: 'WebhookError',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const duration = (Date.now() - start) / 1000;
      trackJobCompleted(QUEUE_NAMES.SECURITY);
      trackJobDuration(QUEUE_NAMES.SECURITY, job.name || 'finding_alert', duration);

      return { success: true, findingId, severity };
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.SECURITY);
    trackJobDuration(QUEUE_NAMES.SECURITY, job.name || 'unknown', duration);

    return { success: true };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.SECURITY, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Retention Processor ──────────────────────────────────────

const BATCH_SIZE = 1000;

export async function processRetentionJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.RETENTION);
  const corr = getCorrelation(job);

  log.log('Processing job', {
    queueName: QUEUE_NAMES.RETENTION,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const { orgId, allOrgs, requestedBy } = job.data;
    const prisma = getPrismaClient();

    const orgIds: string[] = [];

    if (allOrgs) {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      orgIds.push(...orgs.map((o: { id: string }) => o.id));
    } else if (orgId) {
      orgIds.push(orgId);
    } else {
      log.warn('Retention job with no orgId and allOrgs=false', {
        queueName: QUEUE_NAMES.RETENTION,
        jobId: job.id?.toString(),
      });
      return { success: true, skipped: true };
    }

    let totalMetricsDeleted = 0;
    let totalHealthScoresDeleted = 0;
    let totalRecordingsCleared = 0;
    let totalAuditDeleted = 0;
    let totalSecurityScansDeleted = 0;
    let totalBackupRunsDeleted = 0;

    for (const targetOrgId of orgIds) {
      let policy = await prisma.dataRetentionPolicy.findUnique({ where: { orgId: targetOrgId } });
      if (!policy) {
        policy = await prisma.dataRetentionPolicy.create({ data: { orgId: targetOrgId } });
      }

      const now = new Date();

      if (policy.metricsRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - policy.metricsRetentionDays * 24 * 60 * 60 * 1000);
        let deleted = 0;
        while (true) {
          const batch = await prisma.deviceMetric.deleteMany({
            where: { orgId: targetOrgId, recordedAt: { lt: cutoff }, id: { not: '' } },
          });
          deleted += batch.count;
          if (batch.count < BATCH_SIZE) break;
        }
        totalMetricsDeleted += deleted;

        let hsDeleted = 0;
        while (true) {
          const batch = await prisma.deviceHealthScore.deleteMany({
            where: { orgId: targetOrgId, calculatedAt: { lt: cutoff }, id: { not: '' } },
          });
          hsDeleted += batch.count;
          if (batch.count < BATCH_SIZE) break;
        }
        totalHealthScoresDeleted += hsDeleted;
      }

      if (policy.recordingsRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - policy.recordingsRetentionDays * 24 * 60 * 60 * 1000);
        const recUpdate = await prisma.remoteSession.updateMany({
          where: { orgId: targetOrgId, startedAt: { lt: cutoff }, recordingPath: { not: null } },
          data: { recordingPath: null, recordingSize: null, recordingDuration: null },
        });
        totalRecordingsCleared += recUpdate.count;
      }

      if (policy.auditRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - policy.auditRetentionDays * 24 * 60 * 60 * 1000);
        let deleted = 0;
        while (true) {
          const batch = await prisma.auditLog.deleteMany({
            where: { orgId: targetOrgId, createdAt: { lt: cutoff }, id: { not: '' } },
          });
          deleted += batch.count;
          if (batch.count < BATCH_SIZE) break;
        }
        totalAuditDeleted += deleted;
      }

      if (policy.securityScanRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - policy.securityScanRetentionDays * 24 * 60 * 60 * 1000);
        let deleted = 0;
        while (true) {
          const batch = await prisma.securityScan.deleteMany({
            where: { orgId: targetOrgId, startedAt: { lt: cutoff }, id: { not: '' } },
          });
          deleted += batch.count;
          if (batch.count < BATCH_SIZE) break;
        }
        totalSecurityScansDeleted += deleted;
      }

      if (policy.backupRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - policy.backupRetentionDays * 24 * 60 * 60 * 1000);
        let deleted = 0;
        while (true) {
          const batch = await prisma.backupRun.deleteMany({
            where: { orgId: targetOrgId, startedAt: { lt: cutoff }, id: { not: '' } },
          });
          deleted += batch.count;
          if (batch.count < BATCH_SIZE) break;
        }
        totalBackupRunsDeleted += deleted;
      }

      log.log(`Retention enforced for org ${targetOrgId}`, {
        queueName: QUEUE_NAMES.RETENTION,
        jobId: job.id?.toString(),
        orgId: targetOrgId,
      });
    }

    if (requestedBy) {
      await prisma.auditLog.create({
        data: {
          orgId: orgIds[0] || '',
          action: 'retention_enforced',
          actorId: requestedBy,
          details: {
            allOrgs,
            orgCount: orgIds.length,
            metricsDeleted: totalMetricsDeleted,
            healthScoresDeleted: totalHealthScoresDeleted,
            recordingsCleared: totalRecordingsCleared,
            auditDeleted: totalAuditDeleted,
            securityScansDeleted: totalSecurityScansDeleted,
            backupRunsDeleted: totalBackupRunsDeleted,
          },
        },
      }).catch(() => {});
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.RETENTION);
    trackJobDuration(QUEUE_NAMES.RETENTION, job.name || 'enforce', duration);

    const result = {
      success: true,
      orgsProcessed: orgIds.length,
      metricsDeleted: totalMetricsDeleted,
      healthScoresDeleted: totalHealthScoresDeleted,
      recordingsCleared: totalRecordingsCleared,
      auditDeleted: totalAuditDeleted,
      securityScansDeleted: totalSecurityScansDeleted,
      backupRunsDeleted: totalBackupRunsDeleted,
      duration,
    };

    log.log(`Retention completed: ${JSON.stringify(result)}`, {
      queueName: QUEUE_NAMES.RETENTION,
      jobId: job.id?.toString(),
      duration,
    });

    return result;
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.RETENTION, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── KB Embedding Processor ────────────────────────────────────

function splitIntoChunks(markdown: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < markdown.length) {
    const end = Math.min(pos + chunkSize, markdown.length);
    chunks.push(markdown.substring(pos, end));
    const next = end - overlap;
    pos = next > pos ? next : pos + 1;
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

export async function processKbEmbeddingJob(job: Job): Promise<any> {
  const start = Date.now();
  const log = getJobLogger(QUEUE_NAMES.KB_EMBEDDING);
  const corr = getCorrelation(job);

  log.log('Processing KB embedding job', {
    queueName: QUEUE_NAMES.KB_EMBEDDING,
    jobId: job.id?.toString(),
    jobName: job.name,
    requestId: corr?.requestId,
    correlationId: corr?.correlationId,
  });

  try {
    const { orgId, articleId } = job.data;
    const prisma = getPrismaClient();

    const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
    if (!article) {
      log.warn(`Article ${articleId} not found`, { queueName: QUEUE_NAMES.KB_EMBEDDING });
      return { success: false, reason: 'article_not_found' };
    }

    // Delete old embeddings for idempotency
    await prisma.kbEmbedding.deleteMany({ where: { articleId } });

    const chunks = splitIntoChunks(article.markdown);
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      try {
        const embedding = await embedViaApi(orgId, chunkText, job, log);
        if (!embedding) {
          errors.push(`chunk ${i}: no embedding returned`);
          continue;
        }
        await prisma.kbEmbedding.create({
          data: {
            articleId,
            chunkIndex: i,
            chunkText,
            embedding,
          },
        });
        successCount++;
      } catch (err) {
        errors.push(`chunk ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const duration = (Date.now() - start) / 1000;
    trackJobCompleted(QUEUE_NAMES.KB_EMBEDDING);
    trackJobDuration(QUEUE_NAMES.KB_EMBEDDING, job.name || 'embed', duration);

    log.log(`KB embedding completed: ${successCount}/${chunks.length} chunks`, {
      queueName: QUEUE_NAMES.KB_EMBEDDING,
      jobId: job.id?.toString(),
      duration,
    });

    return { success: successCount === chunks.length, successCount, totalChunks: chunks.length, errors: errors.length ? errors : undefined };
  } catch (err) {
    trackJobFailed(QUEUE_NAMES.KB_EMBEDDING, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function embedViaApi(orgId: string, text: string, job: Job, log: ReturnType<typeof createWorkerLogger>): Promise<number[] | null> {
  // Try the API gateway's embed endpoint, which routes through AI orchestrator
  const apiUrl = process.env.TF_API_URL || 'http://localhost:3001';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${apiUrl}/ai/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-embedding-key': `worker-${job.id}` },
      body: JSON.stringify({ orgId, text, dimensions: EMBEDDING_DIMENSION }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json.embedding) && json.embedding.length === EMBEDDING_DIMENSION) {
        return json.embedding;
      }
      log.warn(`Invalid embedding response from API`, { queueName: QUEUE_NAMES.KB_EMBEDDING });
    }
  } catch {
    // Fallback: deterministic mock embedding
  }

  // Deterministic fallback embedding
  const mock: number[] = [];
  const hash = simpleHash(text);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    mock.push(Math.sin(hash * (i + 1)) * 0.5 + 0.5);
  }
  return mock;
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
