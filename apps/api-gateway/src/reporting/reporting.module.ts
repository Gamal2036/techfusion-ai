import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportScheduleExecutorService } from './report-schedule-executor.service';
import { BrandingService } from './services/branding.service';
import { ReportStorageService } from './services/report-storage.service';
import { HtmlGeneratorService } from './services/html-generator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { DocxGeneratorService } from './services/docx-generator.service';
import { CsvGeneratorService } from './services/csv-generator.service';
import { JsonGeneratorService } from './services/json-generator.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, AiModule, QueueModule],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    ReportScheduleExecutorService,
    BrandingService,
    ReportStorageService,
    HtmlGeneratorService,
    PdfGeneratorService,
    DocxGeneratorService,
    CsvGeneratorService,
    JsonGeneratorService,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
