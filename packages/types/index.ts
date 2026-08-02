export interface HealthCheckResponse {
  status: string;
  timestamp?: string;
  version?: string;
}

export type WorkspaceName = 'web' | 'api-gateway' | 'agent' | 'worker';

export type TeamRole = 'Owner' | 'Admin' | 'Technician' | 'Viewer';

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: TeamRole;
  isMfaEnabled: boolean;
  ssoId: string | null;
  ssoProvider: string | null;
  createdAt: string;
  updatedAt: string;
}

export const REPORT_TYPES = {
  DEVICE_HEALTH: 'device_health',
  SECURITY_EXECUTIVE: 'security_executive',
  FLEET_SUMMARY: 'fleet_summary',
  NETWORK: 'network',
  INVENTORY: 'inventory',
  REMOTE_SUPPORT: 'remote_support',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

export const REPORT_FORMATS = {
  PDF: 'pdf',
  DOCX: 'docx',
  HTML: 'html',
  CSV: 'csv',
  JSON: 'json',
} as const;

export type ReportFormat = typeof REPORT_FORMATS[keyof typeof REPORT_FORMATS];

export interface GenerateReportRequest {
  type: ReportType;
  format: ReportFormat;
  title?: string;
  description?: string;
  deviceIds?: string[];
  scanId?: string;
  generateAiSummary?: boolean;
}

export type ReportScheduleType = ReportType;
export type ReportScheduleFormat = ReportFormat;
export type ReportScheduleStatus =
  | 'disabled'
  | 'scheduled'
  | 'never_run'
  | 'overdue'
  | 'unscheduled'
  | 'invalid';

export interface ReportSchedule {
  id: string;
  type: ReportScheduleType;
  formats: ReportScheduleFormat[];
  cron: string;
  deviceIds: string[];
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  type: ReportScheduleType;
  formats: ReportScheduleFormat[];
  cron: string;
  deviceIds?: string[];
  isEnabled?: boolean;
}

export interface ReportRecord {
  id: string;
  orgId: string;
  type: string;
  format: string;
  title: string;
  description: string | null;
  status: string;
  storagePath: string;
  fileSize: number;
  signedUrl: string | null;
  urlExpiresAt: string | null;
  aiGenerated: boolean;
  aiSummary: string | null;
  sourceIds: string | null;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}
