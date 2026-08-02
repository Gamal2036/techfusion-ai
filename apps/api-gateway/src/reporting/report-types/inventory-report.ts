import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface InventoryReportInput {
  totalDrivers: number;
  currentDrivers: number;
  outdatedDrivers: number;
  missingDrivers: number;
  totalSoftware: number;
  driverList: { name: string; vendor: string | null; version: string | null; status: string }[];
  softwareList: { name: string; version: string | null; vendor: string | null }[];
}

export function buildInventoryReport(input: InventoryReportInput, companyName: string): ReportData {
  const sections: ReportSection[] = [
    {
      title: 'Inventory Overview',
      content: `Managing ${input.totalDrivers} drivers (${input.currentDrivers} current, ${input.outdatedDrivers} outdated, ${input.missingDrivers} missing) and ${input.totalSoftware} software packages.`,
    },
    {
      title: 'Driver Summary',
      content: input.driverList.length
        ? input.driverList.map((d) => `${d.name}${d.vendor ? ` (${d.vendor})` : ''} v${d.version || 'N/A'} — ${d.status}`).join('\n')
        : 'No drivers registered.',
    },
    {
      title: 'Software Inventory',
      content: input.softwareList.length
        ? input.softwareList.map((s) => `${s.name}${s.vendor ? ` (${s.vendor})` : ''} v${s.version || 'N/A'}`).join('\n')
        : 'No software registered.',
    },
  ];

  return {
    title: 'Inventory Report',
    date: new Date(),
    orgName: companyName,
    sections,
    branding: { accentColor: '#7c3aed' },
    scoreData: [
      { label: 'Total Drivers', value: input.totalDrivers, max: 500 },
      { label: 'Current Drivers', value: input.currentDrivers, max: input.totalDrivers || 1 },
      { label: 'Software Packages', value: input.totalSoftware, max: 5000 },
    ],
    findingsSummary: [
      { label: 'Current Drivers', count: input.currentDrivers, severity: 'low' },
      { label: 'Outdated Drivers', count: input.outdatedDrivers, severity: 'medium' },
      { label: 'Missing Drivers', count: input.missingDrivers, severity: 'critical' },
    ],
    metadata: {
      'Total Drivers': input.totalDrivers.toString(),
      'Current': input.currentDrivers.toString(),
      'Outdated': input.outdatedDrivers.toString(),
      'Missing': input.missingDrivers.toString(),
      'Software Packages': input.totalSoftware.toString(),
    },
  };
}
