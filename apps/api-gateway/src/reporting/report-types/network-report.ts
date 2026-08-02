import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface NetworkReportInput {
  scanDate: Date;
  scanCount: number;
  totalDevices: number;
  reachableDevices: number;
  unreachableDevices: number;
  subnet: string | null;
  gatewayIp: string | null;
  avgLatencyMs: number | null;
  devices: { ip: string; hostname: string | null; vendor: string | null; reachable: boolean; latencyMs: number | null }[];
}

export function buildNetworkReport(input: NetworkReportInput, companyName: string): ReportData {
  const sections: ReportSection[] = [
    {
      title: 'Network Overview',
      content: `Network scan completed on ${new Date(input.scanDate).toLocaleDateString()}. Discovered ${input.totalDevices} devices (${input.reachableDevices} reachable, ${input.unreachableDevices} unreachable).${input.subnet ? ` Subnet: ${input.subnet}.` : ''}${input.gatewayIp ? ` Gateway: ${input.gatewayIp}.` : ''}${input.avgLatencyMs !== null ? ` Average latency: ${Math.round(input.avgLatencyMs)}ms.` : ''}`,
    },
    {
      title: 'Device Discovery',
      content: input.devices.length
        ? input.devices.map((d) => `${d.ip}${d.hostname ? ` (${d.hostname})` : ''}${d.vendor ? ` [${d.vendor}]` : ''} — ${d.reachable ? 'Reachable' : 'Unreachable'}${d.latencyMs !== null ? ` ${d.latencyMs}ms` : ''}`).join('\n')
        : 'No network devices discovered.',
    },
  ];

  const reachableCount = input.devices.filter((d) => d.reachable).length;
  const unreachableCount = input.devices.filter((d) => !d.reachable).length;

  return {
    title: 'Network Report',
    date: new Date(),
    orgName: companyName,
    sections,
    branding: { accentColor: '#0891b2' },
    scoreData: [
      { label: 'Total Devices', value: input.totalDevices, max: 1000 },
      { label: 'Reachable', value: reachableCount, max: input.totalDevices || 1 },
      { label: 'Scans', value: input.scanCount, max: 100 },
    ],
    findingsSummary: [
      { label: 'Reachable Devices', count: reachableCount, severity: 'low' },
      { label: 'Unreachable Devices', count: unreachableCount, severity: reachableCount > 0 ? 'medium' : 'critical' },
    ],
    metadata: {
      'Scan Date': new Date(input.scanDate).toLocaleDateString(),
      'Subnet': input.subnet || 'Unknown',
      'Gateway IP': input.gatewayIp || 'Unknown',
      'Avg Latency': input.avgLatencyMs !== null ? `${Math.round(input.avgLatencyMs)}ms` : 'N/A',
    },
  };
}
