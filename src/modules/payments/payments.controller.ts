import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { MercadoPagoService } from './services/mercado-pago.service';

/**
 * Pasarela de pagos (Mercado Pago).
 * Todas las rutas de pago requieren JWT + X-Company-Id.
 * Webhook es público pero debe validarse con MERCADOPAGO_WEBHOOK_SECRET (firma).
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private config: ConfigService,
    private mercadoPago: MercadoPagoService,
  ) {}

  @Get('config')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  getConfig() {
    return {
      gateway: 'mercadopago',
      configured: this.mercadoPago.isConfigured(),
      publicKey: this.config.get('MERCADOPAGO_PUBLIC_KEY') || null,
    };
  }

  /** Preferencia para suscripción (plan mensual/anual). */
  @Post('subscription-preference')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async createSubscriptionPreference(
    @CurrentCompanyId() companyId: string,
    @Body()
    body: {
      planCode: 'EMPRENDER' | 'PROFESIONAL' | 'EMPRESARIAL';
      annual: boolean;
      payerEmail?: string;
      successUrl: string;
      pendingUrl: string;
      failureUrl: string;
    },
  ) {
    const baseUrl = this.config.get('APP_URL', 'http://localhost:3000');
    const result = await this.mercadoPago.createPreference({
      companyId,
      planCode: body.planCode,
      annual: !!body.annual,
      payerEmail: body.payerEmail,
      successUrl: body.successUrl || `${baseUrl}/dashboard?payment=success`,
      pendingUrl: body.pendingUrl || `${baseUrl}/dashboard?payment=pending`,
      failureUrl: body.failureUrl || `${baseUrl}/dashboard?payment=failure`,
      notificationUrl: `${this.config.get('API_URL', baseUrl)}/payments/webhook/mercadopago`,
    });
    if (!result) {
      return { error: 'Pasarela no configurada. Revisa MERCADOPAGO_ACCESS_TOKEN en .env.' };
    }
    return result;
  }

  @Post('preference')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async createPreference(
    @CurrentCompanyId() companyId: string,
    @Body()
    body: {
      invoiceId?: string;
      title: string;
      quantity: number;
      unitPrice: number;
      payerEmail?: string;
      backUrlSuccess?: string;
      backUrlPending?: string;
    },
  ) {
    const result = await this.mercadoPago.createPreferenceGeneric({
      companyId,
      invoiceId: body.invoiceId,
      title: body.title,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      payerEmail: body.payerEmail,
      backUrlSuccess: body.backUrlSuccess,
      backUrlPending: body.backUrlPending,
    });
    if (!result) {
      return { error: 'Pasarela no configurada. Agrega MERCADOPAGO_ACCESS_TOKEN en .env.' };
    }
    return result;
  }

  /**
   * Webhook Mercado Pago (HTTPS obligatorio en producción; validar x-signature).
   */
  @Post('webhook/mercadopago')
  async webhookMercadoPago(@Req() req: Request, @Body() body: unknown) {
    const signature = req.headers['x-signature'] as string | undefined;
    await this.mercadoPago.handleWebhook(body, signature);
    return { received: true };
  }
}
