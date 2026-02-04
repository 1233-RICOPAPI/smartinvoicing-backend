import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { PlanApiGuard } from '../../common/guards/plan-api.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { DeveloperApiKeysService } from './developer-api-keys.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { SubscriptionService } from '../plans/subscription.service';
import { CreateInvoiceDto } from '../../invoices/dto';

/**
 * Modo Developer: API keys para que sitios web o apps móviles facturen ELC.
 * Solo disponible en planes Profesional y Empresarial.
 */
@Controller('developer')
export class DeveloperController {
  constructor(
    private apiKeys: DeveloperApiKeysService,
    private invoices: InvoicesService,
    private subscription: SubscriptionService,
  ) {}

  @Post('api-keys')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard, PlanApiGuard)
  async createApiKey(
    @CurrentCompanyId() companyId: string,
    @Body() body: { name: string },
  ) {
    return this.apiKeys.create(companyId, body.name || 'Sin nombre');
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async listApiKeys(@CurrentCompanyId() companyId: string) {
    return this.apiKeys.list(companyId);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard, PlanApiGuard)
  async revokeApiKey(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
  ) {
    await this.apiKeys.revoke(companyId, id);
    return { ok: true };
  }

  /**
   * Crear factura desde sitio/app externo usando X-API-Key.
   * No usa JWT; la key identifica la empresa.
   * Seguridad: solo exponer por HTTPS (TLS 1.3); key en header, no en query.
   */
  @Post('invoice-request')
  async createInvoiceByApiKey(
    @Headers('x-api-key') apiKey: string,
    @Body() body: CreateInvoiceDto,
  ) {
    if (!apiKey?.trim()) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }
    const companyId = await this.apiKeys.validateAndGetCompanyId(apiKey.trim());
    if (!companyId) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    const canUseApi = await this.subscription.canUseApi(companyId);
    if (!canUseApi) {
      throw new UnauthorizedException('El plan de esta empresa no incluye acceso a la API. Actualiza a Profesional o Empresarial.');
    }
    const invoice = await this.invoices.create(companyId, body);
    return { invoiceId: invoice.id, number: String(invoice.number), fullNumber: invoice.fullNumber };
  }
}
