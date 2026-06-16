import { Injectable } from '@nestjs/common';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType,
} from 'docx';
import { IReportGenerator, ReportData } from './report-generator.interface';

@Injectable()
export class DocxGeneratorService implements IReportGenerator {
  readonly format = 'docx';

  async generate(data: ReportData): Promise<Buffer> {
    const accent = data.branding.accentColor || '#3b82f6';
    const company = data.branding.companyName || data.orgName;

    const children: (Paragraph | Table)[] = [];

    // Title
    children.push(
      new Paragraph({
        text: data.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        spacing: { after: 100 },
      }),
    );

    // Meta
    const metaStr = `${company} | ${new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${data.deviceName ? ' | ' + data.deviceName : ''}`;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: metaStr, size: 18, color: '6b7280' })],
        spacing: { after: 200 },
        border: { bottom: { color: accent, size: 6, style: BorderStyle.SINGLE } },
      }),
    );

    // Metadata
    if (data.metadata) {
      for (const [key, val] of Object.entries(data.metadata)) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${key}: `, bold: true, size: 18 }),
              new TextRun({ text: val, size: 18 }),
            ],
            spacing: { after: 60 },
          }),
        );
      }
      children.push(new Paragraph({ spacing: { after: 100 } }));
    }

    // Scores
    if (data.scoreData?.length) {
      children.push(
        new Paragraph({ text: 'Key Scores', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
      );

      const scoreRows: TableRow[] = [];
      for (const s of data.scoreData) {
        scoreRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.label, bold: true, size: 18 })] })] }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: `${Math.round(s.value)}${s.max ? '/' + s.max : ''}`, bold: true, size: 22 })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
            ],
          }),
        );
      }

      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Metric', bold: true, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true, size: 16 })], alignment: AlignmentType.CENTER })] }),
              ],
            }),
            ...scoreRows,
          ],
        }),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // Findings
    if (data.findingsSummary?.length) {
      children.push(
        new Paragraph({ text: 'Findings Summary', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
      );

      const findingRows: TableRow[] = data.findingsSummary.map((f) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.label, size: 18 })] })] }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: f.count.toString(), size: 18 })], alignment: AlignmentType.CENTER })],
            }),
          ],
        }),
      );

      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Count', bold: true, size: 16 })], alignment: AlignmentType.CENTER })] }),
              ],
            }),
            ...findingRows,
          ],
        }),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // AI Summary
    if (data.aiSummary) {
      children.push(
        new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
        new Paragraph({
          children: [new TextRun({ text: data.aiSummary, size: 20, italics: true })],
          spacing: { after: 200 },
          indent: { left: 400 },
        }),
      );
    }

    // Sections
    for (const section of data.sections) {
      children.push(
        new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
        new Paragraph({
          children: [new TextRun({ text: section.content, size: 20 })],
          spacing: { after: 200 },
        }),
      );

      if (section.subSections) {
        for (const ss of section.subSections) {
          children.push(
            new Paragraph({ text: ss.title, heading: HeadingLevel.HEADING_3, spacing: { after: 100 }, indent: { left: 400 } }),
            new Paragraph({
              children: [new TextRun({ text: ss.content, size: 18 })],
              spacing: { after: 100 },
              indent: { left: 400 },
            }),
          );
        }
      }
    }

    // Footer
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Generated by TechFusion AI | Confidential', size: 14, color: '9ca3af' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        border: { top: { color: 'e5e7eb', size: 1, style: BorderStyle.SINGLE } },
      }),
    );

    const doc = new Document({
      title: data.title,
      description: `Generated by TechFusion AI`,
      styles: { default: { document: { run: { font: 'Calibri' } } } },
      sections: [{ children }],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }
}
