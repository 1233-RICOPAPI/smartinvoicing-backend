import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { CompanyUserRole } from '@prisma/client';
import { DianAuditService, DianHistoryResult } from './services/dian-audit.service';
import { AuditExportService } from './services/audit-export.service';

/**
 * Auditoría: historial DIAN por factura y exportación.
 * Solo roles AUDITOR y CONTADOR.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, CompanyAccessGuard, RolesGuard)
@Roles(CompanyUserRole.AUDITOR, CompanyUserRole.CONTADOR)
export class AuditController {
  constructor(
    private readonly dianAudit: DianAuditService,
    private readonly auditExport: AuditExportService,
  ) {}

  /**
   * GET /audit/dian/:invoiceId/history
   * Historial completo de cambios y eventos DIAN para la factura.
   */
  @Get('dian/:invoiceId/history')
  async getDianHistory(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<DianHistoryResult> {
    return this.dianAudit.getDianHistory(companyId, invoiceId);
  }

  /**
   * GET /audit/dian/:invoiceId/export?format=pdf|excel
   * Exporta el historial de auditoría en PDF o Excel.
   */
  @Get('dian/:invoiceId/export')
  async exportDianHistory(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Query('format') format: 'pdf' | 'excel',
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.dianAudit.getDianHistory(companyId, invoiceId);
    const { buffer, filename, mimeType } = await this.auditExport.exportHistory(result, format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }
}
