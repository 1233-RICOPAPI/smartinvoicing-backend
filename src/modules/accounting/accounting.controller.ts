import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AccountingEngineService } from './services/accounting-engine.service';
import { PucInitService } from './services/puc-init.service';
import { GenerateEntryDto } from './dtos/generate-entry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { AccountingDocumentType } from './enums/document-type.enum';
import { DianAuditService, DIAN_AUDIT_ACTIONS } from '../audit/services/dian-audit.service';

@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly accountingEngine: AccountingEngineService,
    private readonly pucInit: PucInitService,
    private readonly dianAudit: DianAuditService,
  ) {}

  @Get('puc/status')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async pucStatus(@CurrentCompanyId() companyId: string) {
    const hasPuc = await this.pucInit.hasPuc(companyId);
    return { hasPuc };
  }

  @Post('puc/init')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async initPuc(@CurrentCompanyId() companyId: string) {
    return this.pucInit.initPuc(companyId);
  }

  /**
   * Genera asiento contable (solo dominio, sin persistir).
   * POST /accounting/entry
   */
  @Post('entry')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async generateEntry(
    @CurrentCompanyId() companyId: string,
    @Body() dto: GenerateEntryDto,
  ) {
    const entry = await this.accountingEngine.generateJournalEntry(companyId, dto);
    return entry;
  }

  /**
   * Genera y persiste el asiento.
   * Si el asiento está ligado a una factura (documentId), se registra en auditoría DIAN.
   * POST /accounting/entry/persist
   */
  @Post('entry/persist')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async generateAndPersist(
    @CurrentCompanyId() companyId: string,
    @Body() dto: GenerateEntryDto,
    @Req() req: Request,
  ) {
    const entry = await this.accountingEngine.generateJournalEntry(companyId, dto);
    const result = await this.accountingEngine.persistJournalEntry(entry);
    if (dto.documentId) {
      const user = (req as any).user;
      await this.dianAudit.logDianAction({
        companyId,
        userId: user?.id ?? user?.userId,
        action: DIAN_AUDIT_ACTIONS.AJUSTE_CONTABLE,
        entity: 'Invoice',
        entityId: dto.documentId,
        payload: { journalEntryId: result.journalEntryId, documentNumber: dto.documentNumber },
        ip: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.get('user-agent'),
      });
    }
    return { ...result, entry };
  }

  /**
   * Ejemplo: Factura venta $1.000.000 + IVA 19%.
   * Devuelve el asiento calculado (requiere empresa con cuentas mapeadas).
   */
  @Get('entry/example')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async example(@CurrentCompanyId() companyId: string) {
    const subtotal = 1_000_000;
    const taxAmount = 190_000;
    const total = 1_190_000;
    const dto: GenerateEntryDto = {
      documentType: AccountingDocumentType.FACTURA_VENTA,
      documentNumber: 'SETP80000001',
      date: new Date().toISOString().slice(0, 10),
      subtotal,
      taxAmount,
      total,
    };
    const entry = await this.accountingEngine.generateJournalEntry(companyId, dto);
    return {
      description: 'Factura venta $1.000.000 + IVA 19%',
      dto: { ...dto, total: 1_190_000 },
      entry,
    };
  }
}
