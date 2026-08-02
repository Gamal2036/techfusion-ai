import { execFile, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts', 'backup');

const ALLOWED_SCRIPTS: Record<string, string> = {
  'backup-all': 'backup-all.sh',
  'backup-postgres': 'backup-postgres.sh',
  'backup-redis': 'backup-redis.sh',
  'backup-files': 'backup-files.sh',
  'backup-config': 'backup-config.sh',
  'verify-backup': 'verify-backup.sh',
  'apply-retention': 'apply-retention.sh',
  'restore-files': 'restore-files.sh',
};

export interface BackupScriptResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  scriptName: string;
}

export function validateScriptName(name: string): boolean {
  return name in ALLOWED_SCRIPTS;
}

export function runBackupScript(
  scriptName: string,
  args: string[] = [],
  timeoutMs: number = 300000,
): Promise<BackupScriptResult> {
  return new Promise((resolve) => {
    const start = Date.now();

    if (!validateScriptName(scriptName)) {
      resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Script "${scriptName}" is not in the allowlist`,
        durationMs: 0,
        scriptName,
      });
      return;
    }

    const scriptFile = ALLOWED_SCRIPTS[scriptName];
    const scriptPath = path.join(SCRIPTS_DIR, scriptFile);

    if (!fs.existsSync(scriptPath)) {
      resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Script not found: ${scriptPath}`,
        durationMs: 0,
        scriptName,
      });
      return;
    }

    const childProcess = execFile(
      'bash',
      [scriptPath, ...args],
      {
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
        cwd: PROJECT_ROOT,
        env: {
          ...globalThis.process.env,
          BACKUP_DIR: path.join(PROJECT_ROOT, 'backups'),
        },
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        resolve({
          success: !error,
          exitCode: error ? (error as any).code || 1 : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          durationMs,
          scriptName,
        });
      },
    );
  });
}

export function parseBackupOutput(stdout: string): {
  sizeBytes: number | null;
  fileCount: number | null;
  checksum: string | null;
  backupPath: string | null;
} {
  let sizeBytes: number | null = null;
  let fileCount: number | null = null;
  let checksum: string | null = null;
  let backupPath: string | null = null;

  const sizeMatch = stdout.match(/Size:\s*(\d+)\s*bytes/i);
  if (sizeMatch) {
    sizeBytes = parseInt(sizeMatch[1], 10);
  }

  if (!sizeBytes) {
    const totalSizeMatch = stdout.match(/Total backup size:\s*(\d+)\s*bytes/i);
    if (totalSizeMatch) {
      sizeBytes = parseInt(totalSizeMatch[1], 10);
    }
  }

  const checksumMatch = stdout.match(/SHA-256:\s*([a-f0-9]{64})/i);
  if (checksumMatch) {
    checksum = checksumMatch[1];
  }

  const archiveLineMatch = stdout.match(/Archive:\s*(.+\.tar\.gz)/);
  if (archiveLineMatch) {
    backupPath = archiveLineMatch[1].trim();
  }

  if (!backupPath) {
    const lastArchiveLine = stdout.split('\n').filter((l) => l.includes('.tar.gz')).pop();
    if (lastArchiveLine) {
      const archiveNameMatch = lastArchiveLine.match(/([^\s]+\.tar\.gz)/);
      if (archiveNameMatch) {
        backupPath = archiveNameMatch[1];
      }
    }
  }

  if (!backupPath) {
    const baseDirMatch = stdout.match(/Backup directory:\s*(.+)/i);
    if (baseDirMatch) {
      const baseDir = baseDirMatch[1].trim();
      const nameMatch = stdout.match(/_\d{8}T\d{6}Z\.tar\.gz/);
      if (nameMatch) {
        try {
          const fs = require('fs');
          const files = fs.readdirSync(baseDir).filter((f: string) => f.endsWith('.tar.gz'));
          if (files.length > 0) {
            backupPath = require('path').join(baseDir, files[files.length - 1]);
          }
        } catch {
          // baseDir may not exist at this point
        }
      }
    }
  }

  const countMatch = stdout.match(/TOC entries:\s*(\d+)/);
  if (countMatch) {
    fileCount = parseInt(countMatch[1], 10);
  }

  return { sizeBytes, fileCount, checksum, backupPath };
}

export function parseVerificationOutput(stdout: string): {
  passed: boolean;
  passCount: number;
  failCount: number;
  warnCount: number;
} {
  const passMatch = stdout.match(/Results:\s*(\d+)\s*passed/);
  const failMatch = stdout.match(/(\d+)\s*failed/);
  const warnMatch = stdout.match(/(\d+)\s*warning/);

  return {
    passed: failMatch ? parseInt(failMatch[1], 10) === 0 : true,
    passCount: passMatch ? parseInt(passMatch[1], 10) : 0,
    failCount: failMatch ? parseInt(failMatch[1], 10) : 0,
    warnCount: warnMatch ? parseInt(warnMatch[1], 10) : 0,
  };
}
