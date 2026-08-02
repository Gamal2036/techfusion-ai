import { Injectable } from '@nestjs/common';
import { IReportGenerator, ReportData } from './report-generator.interface';

@Injectable()
export class CsvGeneratorService implements IReportGenerator {
  format = 'csv';

  generate(data: ReportData): Promise<Buffer> {
    const rows: string[][] = [];

    rows.push(['Report', data.title]);
    rows.push(['Organization', data.orgName]);
    rows.push(['Date', data.date.toISOString()]);
    if (data.deviceName) rows.push(['Device', data.deviceName]);
    rows.push([]);
    rows.push(['Section', 'Content']);

    for (const section of data.sections) {
      rows.push([section.title, section.content.replace(/,/g, ' ')]);
      if (section.subSections) {
        for (const sub of section.subSections) {
          rows.push([`  ${sub.title}`, sub.content.replace(/,/g, ' ')]);
        }
      }
    }

    if (data.scoreData && data.scoreData.length > 0) {
      rows.push([]);
      rows.push(['Score Label', 'Score Value']);
      for (const s of data.scoreData) {
        rows.push([s.label, String(s.value)]);
      }
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    return Promise.resolve(Buffer.from(csv, 'utf-8'));
  }
}
