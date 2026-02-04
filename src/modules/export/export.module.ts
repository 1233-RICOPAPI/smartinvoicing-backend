import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { DianModule } from '../../dian/dian.module';
import { ExcelExportService } from './services/excel-export.service';
import { PdfReportExportService } from './services/pdf-report-export.service';
import { InvoicePdfExportService } from './services/invoice-pdf-export.service';
import { ExportService } from './services/export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [ReportsModule, DianModule],
  providers: [ExcelExportService, PdfReportExportService, InvoicePdfExportService, ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
