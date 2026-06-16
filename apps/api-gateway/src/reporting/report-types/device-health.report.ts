import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface DeviceHealthInput {
  deviceName: string;
  deviceId: string;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  lastBoot: Date;
  temperature: number;
  alerts: { severity: string; message: string; timestamp: Date }[];
  metrics: { label: string; value: number; unit: string }[];
  score: { overall: number; cpu: number; memory: number; disk: number; network: number };
}

export function buildDeviceHealthReport(input: DeviceHealthInput, companyName: string): ReportData {
  const sections: ReportSection[] = [
    {
      title: 'System Overview',
      content: `Device ${input.deviceName} has been running for ${Math.floor(input.uptime / 3600)} hours with overall health score of ${input.score.overall}.`,
      subSections: [
        { title: 'CPU', content: `${input.cpuUsage}% utilization` },
        { title: 'Memory', content: `${input.memoryUsage}% used` },
        { title: 'Disk', content: `${input.diskUsage}% used` },
        { title: 'Temperature', content: `${input.temperature}°C` },
      ],
    },
    {
      title: 'Performance Metrics',
      content: input.metrics.map((m) => `${m.label}: ${m.value} ${m.unit}`).join('; '),
    },
    {
      title: 'Active Alerts',
      content: input.alerts.length
        ? input.alerts.map((a) => `[${a.severity}] ${a.message} (${a.timestamp.toLocaleDateString()})`).join('\n')
        : 'No active alerts.',
    },
  ];

  return {
    title: 'Device Health Report',
    date: new Date(),
    orgName: companyName,
    deviceName: input.deviceName,
    sections,
    branding: { accentColor: '#3b82f6' },
    scoreData: [
      { label: 'Overall', value: input.score.overall, max: 100 },
      { label: 'CPU', value: input.score.cpu, max: 100 },
      { label: 'Memory', value: input.score.memory, max: 100 },
      { label: 'Disk', value: input.score.disk, max: 100 },
      { label: 'Network', value: input.score.network, max: 100 },
    ],
    metadata: {
      'Device ID': input.deviceId,
      'Last Boot': new Date(input.lastBoot).toLocaleDateString(),
      'Total Alerts': input.alerts.length.toString(),
    },
  };
}
