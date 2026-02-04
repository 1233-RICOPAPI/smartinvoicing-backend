import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DianService } from './dian.service';
import { DianConfigService } from './dian-config.service';
import { PosInvoiceService } from './pos-invoice/pos-invoice.service';
import { FacturaStatusTracker } from './tracker/factura-status.tracker';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { CurrentCompanyId } from '../common/decorators/company.decorator';
import { DianConfigUpdateDto } from './dto/dian-config.dto';

@Controller('dian')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class DianController {
  constructor(
    private dian: DianService,
    private dianConfig: DianConfigService,
    private posInvoice: PosInvoiceService,
    private statusTracker: FacturaStatusTracker,
  ) {}

  @Get('config')
  getConfig(@CurrentCompanyId() companyId: string) {
    return this.dianConfig.get(companyId);
  }

  @Put('config')
  updateConfig(
    @CurrentCompanyId() companyId: string,
    @Body() body: DianConfigUpdateDto,
  ) {
    return this.dianConfig.update(companyId, body);
  }

  @Post('invoices/:invoiceId/sign')
  async signInvoice(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const result = await this.dian.buildAndSignInvoice(companyId, invoiceId);
    await this.dian.persistDianDocument(companyId, invoiceId, result);
    return { cufe: result.cufe, qrData: result.qrData };
  }

  @Post('invoices/:invoiceId/send')
  async sendInvoice(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const auditContext = user?.id ?? user?.userId
      ? { userId: user?.id ?? user?.userId, ip: req.ip ?? req.socket?.remoteAddress, userAgent: req.get('user-agent') }
      : undefined;
    return this.dian.sendToDian(companyId, invoiceId, auditContext);
  }

  /**
   * Flujo completo Factura POS Electrónica: construir, firmar, enviar DIAN, generar PDF con QR.
   */
  @Post('invoices/:invoiceId/emit-pos-electronic')
  async emitPosElectronic(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.posInvoice.emitElectronicInvoice(companyId, invoiceId);
  }

  @Get('invoices/:invoiceId/status')
  async getInvoiceStatus(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.statusTracker.getStatus(companyId, invoiceId);
  }

  @Post('invoices/:invoiceId/retry')
  async retrySend(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const auditContext = user?.id ?? user?.userId
      ? { userId: user?.id ?? user?.userId, ip: req.ip ?? req.socket?.remoteAddress, userAgent: req.get('user-agent') }
      : undefined;
    return this.statusTracker.retrySend(companyId, invoiceId, auditContext);
  }
}
