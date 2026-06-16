import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface FleetSummaryInput {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  avgHealthScore: number;
  avgSecurityScore: number;
  totalAlerts: number;
  criticalAlerts: number;
  deviceSummaries: { name: string; health: number; security: number; status: string }[];
}

export function buildFleetSummaryReport(input: FleetSummaryInput, companyName: string): ReportData {
  const sections: ReportSection[] = [
    {
      title: 'Fleet Overview',
      content: `Managing ${input.totalDevices} devices (${input.onlineDevices} online, ${input.offlineDevices} offline). Average health: ${Math.round(input.avgHealthScore)}%, average security: ${Math.round(input.avgSecurityScore)}%.`,
    },
    {
      title: 'Alert Summary',
      content: `${input.totalAlerts} total active alerts (${input.criticalAlerts} critical).`,
    },
    {
      title: 'Device Breakdown',
      content: input.deviceSummaries.length
        ? input.deviceSummaries.map((d) => `${d.name}: Health ${d.health}%, Security ${d.security}% [${d.status}]`).join('\n')
        : 'No devices in fleet.',
    },
  ];

  return {
    title: 'Fleet Summary Report',
    date: new Date(),
    orgName: companyName,
    sections,
    branding: { accentColor: '#2563eb' },
    scoreData: [
      { label: 'Avg Health', value: input.avgHealthScore, max: 100 },
      { label: 'Avg Security', value: input.avgSecurityScore, max: 100 },
    ],
    findingsSummary: [
      { label: 'Online Devices', count: input.onlineDevices },
      { label: 'Offline Devices', count: input.offlineDevices },
      { label: 'Total Alerts', count: input.totalAlerts },
      { label: 'Critical Alerts', count: input.criticalAlerts },
    ],
    metadata: {
      'Total Devices': input.totalDevices.toString(),
      'Online': `${input.onlineDevices}`,
      'Offline': `${input.offlineDevices}`,
      'Critical Alerts': input.criticalAlerts.toString(),
    },
  };
}
