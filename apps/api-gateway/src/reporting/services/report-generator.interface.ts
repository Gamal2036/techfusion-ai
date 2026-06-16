export interface BrandingConfig {
  companyName?: string;
  logoPath?: string;
  accentColor: string;
}

export interface ReportSection {
  title: string;
  content: string;
  subSections?: { title: string; content: string }[];
}

export interface ReportData {
  title: string;
  date: Date;
  orgName: string;
  deviceName?: string;
  sections: ReportSection[];
  branding: BrandingConfig;
  aiSummary?: string;
  scoreData?: { label: string; value: number; max?: number }[];
  findingsSummary?: { label: string; count: number; severity?: string }[];
  metadata?: Record<string, string>;
}

export interface IReportGenerator {
  generate(data: ReportData): Promise<Buffer>;
  format: string;
}
