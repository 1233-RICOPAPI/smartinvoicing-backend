import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { ExportService } from './services/export.service';
import { ExportReportType } from './dtos/export-query.dto';

@Controller('export')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * GET /export/excel?type=balance|income-statement|auxiliary-ledger|journal-entries|invoices&from=YYYY-MM-DD&to=YYYY-MM-DD&accountCode=...
   * Devuelve el archivo como stream (sin guardar en disco). Cloud Run: respuesta en memoria.
   */
  @Get('excel')
  async excel(
    @CurrentCompanyId() companyId: string,
    @Query('type') type: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res({ passthrough: false }) res: Response,
    @Query('accountCode') accountCode?: string,
    @Query('accountId') accountId?: string,
  ) {
    const reportType = this.parseReportType(type);
    this.validateRange(from, to);
    if (reportType === ExportReportType.AUXILIARY_LEDGER && !accountCode && !accountId) {
      throw new BadRequestException('Para libro auxiliar indique accountCode o accountId');
    }
    const { stream, filename, mimeType } = await this.exportService.getExcelStream(
      companyId,
      reportType,
      from,
      to,
      accountCode,
      accountId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    stream.pipe(res);
  }

  /**
   * GET /export/pdf?type=balance|income-statement|auxiliary-ledger&from=...&to=...&accountCode=...
   */
  @Get('pdf')
  async pdf(
    @CurrentCompanyId() companyId: string,
    @Query('type') type: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res({ passthrough: false }) res: Response,
    @Query('accountCode') accountCode?: string,
    @Query('accountId') accountId?: string,
  ) {
    const reportType = this.parseReportType(type);
    this.validateRange(from, to);
    if (reportType === ExportReportType.AUXILIARY_LEDGER && !accountCode && !accountId) {
      throw new BadRequestException('Para libro auxiliar indique accountCode o accountId');
    }
    const { stream, filename, mimeType } = await this.exportService.getPdfStream(
      companyId,
      reportType,
      from,
      to,
      accountCode,
      accountId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    stream.pipe(res);
  }

  /**
   * GET /export/invoice/:invoiceId/pdf - Factura en PDF (representación gráfica DIAN).
   */
  @Get('invoice/:invoiceId/pdf')
  async invoicePdf(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, filename, mimeType } = await this.exportService.getInvoicePdfStream(companyId, invoiceId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    stream.pipe(res);
  }

  private parseReportType(type: string): ExportReportType {
    const t = type?.toLowerCase();
    if (Object.values(ExportReportType).includes(t as ExportReportType)) return t as ExportReportType;
    throw new BadRequestException(
      `type debe ser uno de: balance, income-statement, auxiliary-ledger, journal-entries, invoices`,
    );
  }

  private validateRange(from: string, to: string): void {
    if (!from || !to) throw new BadRequestException('from y to son obligatorios');
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from y to deben ser fechas válidas (YYYY-MM-DD)');
    }
    if (fromDate > toDate) throw new BadRequestException('from no puede ser mayor que to');
  }
}
