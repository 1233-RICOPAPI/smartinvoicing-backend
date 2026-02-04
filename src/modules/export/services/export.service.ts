import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExcelExportService } from './excel-export.service';
import { PdfReportExportService } from './pdf-report-export.service';
import { InvoicePdfExportService } from './invoice-pdf-export.service';
import { ExportReportType } from '../dtos/export-query.dto';

export interface ExportStreamResult {
  stream: Readable;
  filename: string;
  mimeType: string;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly excel: ExcelExportService,
    private readonly pdfReport: PdfReportExportService,
    private readonly invoicePdf: InvoicePdfExportService,
  ) {}

  async getExcelStream(
    companyId: string,
    type: ExportReportType,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<ExportStreamResult> {
    const buffer = await this.excel.getExcelBuffer(companyId, type, from, to, accountCode, accountId);
    const filename = `mottatech_${type}_${from}_${to}.xlsx`;
    return {
      stream: Readable.from(buffer),
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async getPdfStream(
    companyId: string,
    type: ExportReportType,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<ExportStreamResult> {
    const buffer = await this.pdfReport.getPdfBuffer(companyId, type, from, to, accountCode, accountId);
    const filename = `mottatech_${type}_${from}_${to}.pdf`;
    return {
      stream: Readable.from(buffer),
      filename,
      mimeType: 'application/pdf',
    };
  }

  async getInvoicePdfStream(companyId: string, invoiceId: string): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const { stream, filename } = await this.invoicePdf.getInvoicePdfStream(companyId, invoiceId);
    return { stream, filename, mimeType: 'application/pdf' };
  }
}
