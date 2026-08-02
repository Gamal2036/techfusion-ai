import { ReportData, ReportSection } from '../services/report-generator.interface';

export interface RemoteSupportReportInput {
  totalSessions: number;
  activeSessions: number;
  endedSessions: number;
  failedSessions: number;
  pendingSessions: number;
  totalRecordings: number;
  totalRecordingDuration: number;
  recentSessions: { id: string; deviceId: string; status: string; startedAt: Date | null; endedAt: Date | null; duration: number | null }[];
}

export function buildRemoteSupportReport(input: RemoteSupportReportInput, companyName: string): ReportData {
  const durationStr = input.totalRecordingDuration >= 3600
    ? `${Math.floor(input.totalRecordingDuration / 3600)}h ${Math.floor((input.totalRecordingDuration % 3600) / 60)}m`
    : input.totalRecordingDuration >= 60
      ? `${Math.floor(input.totalRecordingDuration / 60)}m ${input.totalRecordingDuration % 60}s`
      : `${input.totalRecordingDuration}s`;

  const sections: ReportSection[] = [
    {
      title: 'Remote Support Overview',
      content: `${input.totalSessions} total sessions (${input.activeSessions} active, ${input.endedSessions} completed, ${input.pendingSessions} pending, ${input.failedSessions} failed). ${input.totalRecordings} recordings (${durationStr} total).`,
    },
    {
      title: 'Recent Sessions',
      content: input.recentSessions.length
        ? input.recentSessions.map((s) => {
            const dur = s.duration !== null
              ? s.duration >= 60 ? `${Math.floor(s.duration / 60)}m ${s.duration % 60}s` : `${s.duration}s`
              : 'N/A';
            return `Session ${s.id.slice(0, 8)} — Device ${s.deviceId.slice(0, 8)} — ${s.status} — ${dur}`;
          }).join('\n')
        : 'No recent sessions.',
    },
  ];

  return {
    title: 'Remote Support Report',
    date: new Date(),
    orgName: companyName,
    sections,
    branding: { accentColor: '#059669' },
    scoreData: [
      { label: 'Total Sessions', value: input.totalSessions, max: 1000 },
      { label: 'Active', value: input.activeSessions, max: input.totalSessions || 1 },
      { label: 'Recordings', value: input.totalRecordings, max: 1000 },
    ],
    findingsSummary: [
      { label: 'Active Sessions', count: input.activeSessions, severity: 'low' },
      { label: 'Failed Sessions', count: input.failedSessions, severity: input.failedSessions > 0 ? 'high' : 'low' },
    ],
    metadata: {
      'Total Sessions': input.totalSessions.toString(),
      'Active': input.activeSessions.toString(),
      'Completed': input.endedSessions.toString(),
      'Failed': input.failedSessions.toString(),
      'Recordings': input.totalRecordings.toString(),
    },
  };
}
