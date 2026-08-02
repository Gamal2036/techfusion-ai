import { Injectable } from '@nestjs/common';
import { IReportGenerator, ReportData } from './report-generator.interface';

@Injectable()
export class JsonGeneratorService implements IReportGenerator {
  format = 'json';

  generate(data: ReportData): Promise<Buffer> {
    const output = {
      title: data.title,
      organization: data.orgName,
      date: data.date.toISOString(),
      deviceName: data.deviceName,
      aiSummary: data.aiSummary,
      scores: data.scoreData,
      findings: data.findingsSummary,
      metadata: data.metadata,
      sections: data.sections.map((s) => ({
        title: s.title,
        content: s.content,
        subSections: s.subSections,
      })),
    };

    return Promise.resolve(Buffer.from(JSON.stringify(output, null, 2), 'utf-8'));
  }
}
