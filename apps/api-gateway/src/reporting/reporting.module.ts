import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { BrandingService } from './services/branding.service';
import { ReportStorageService } from './services/report-storage.service';
import { HtmlGeneratorService } from './services/html-generator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { DocxGeneratorService } from './services/docx-generator.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    BrandingService,
    ReportStorageService,
    HtmlGeneratorService,
    PdfGeneratorService,
    DocxGeneratorService,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
