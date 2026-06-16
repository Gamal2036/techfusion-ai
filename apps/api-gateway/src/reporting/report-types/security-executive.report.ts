import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface SecurityExecutiveInput {
  scanName: string;
  scanDate: Date;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scores: { critical: number; high: number; medium: number; low: number; overall: number };
  findings: { title: string; severity: string; description: string; recommendation: string }[];
  deviceName: string;
}

export function buildSecurityExecutiveReport(input: SecurityExecutiveInput, companyName: string): ReportData {
  const sections: ReportSection[] = [
    {
      title: 'Scan Overview',
      content: `Security scan "${input.scanName}" completed on ${new Date(input.scanDate).toLocaleDateString()} for ${input.deviceName}. Found ${input.totalFindings} findings.`,
      subSections: [
        { title: 'Critical', content: `${input.criticalCount} findings` },
        { title: 'High', content: `${input.highCount} findings` },
        { title: 'Medium', content: `${input.mediumCount} findings` },
        { title: 'Low', content: `${input.lowCount} findings` },
      ],
    },
    {
      title: 'Detailed Findings',
      content: input.findings.length
        ? input.findings.map((f) => `${f.title} [${f.severity}] - ${f.description}`).join('\n')
        : 'No findings to report.',
    },
    {
      title: 'Recommendations',
      content: input.findings
        .filter((f) => f.severity === 'critical' || f.severity === 'high')
        .map((f) => f.recommendation)
        .join('\n'),
    },
  ];

  return {
    title: 'Security Executive Report',
    date: new Date(),
    orgName: companyName,
    deviceName: input.deviceName,
    sections,
    branding: { accentColor: '#dc2626' },
    scoreData: [
      { label: 'Overall', value: input.scores.overall, max: 100 },
      { label: 'Critical', value: input.scores.critical, max: 100 },
      { label: 'High', value: input.scores.high, max: 100 },
      { label: 'Medium', value: input.scores.medium, max: 100 },
    ],
    findingsSummary: [
      { label: 'Critical', count: input.criticalCount, severity: 'critical' },
      { label: 'High', count: input.highCount, severity: 'high' },
      { label: 'Medium', count: input.mediumCount, severity: 'medium' },
      { label: 'Low', count: input.lowCount, severity: 'low' },
    ],
    metadata: {
      'Scan Name': input.scanName,
      'Scan Date': new Date(input.scanDate).toLocaleDateString(),
      'Total Findings': input.totalFindings.toString(),
      Device: input.deviceName,
    },
  };
}
