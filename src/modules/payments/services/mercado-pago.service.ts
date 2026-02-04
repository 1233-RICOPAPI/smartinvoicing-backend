import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PLANS, PlanCode } from '../../plans/constants/plans.constants';
import { SubscriptionService } from '../../plans/subscription.service';

/**
 * Servicio Mercado Pago (pasarela de pagos).
 * Credenciales en .env: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY.
 * El checkout de Mercado Pago permite al usuario guardar la tarjeta para futuros pagos.
 */
@Injectable()
export class MercadoPagoService {
  private readonly accessToken: string | undefined;
  private readonly webhookSecret: string | undefined;
  private client: Preference | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {
    this.accessToken = this.config.get('MERCADOPAGO_ACCESS_TOKEN');
    this.webhookSecret = this.config.get('MERCADOPAGO_WEBHOOK_SECRET');
    if (this.accessToken) {
      const mpConfig = new MercadoPagoConfig({ accessToken: this.accessToken });
      this.client = new Preference(mpConfig);
    }
  }

  isConfigured(): boolean {
    return !!this.accessToken && !!this.client;
  }

  /**
   * Crea preferencia de pago para suscripción (plan mensual o anual).
   * backUrls: éxito, pendiente, fallo. notification_url para webhook.
   */
  async createPreference(params: {
    companyId: string;
    planCode: PlanCode;
    annual: boolean;
    payerEmail?: string;
    successUrl: string;
    pendingUrl: string;
    failureUrl: string;
    notificationUrl?: string;
  }): Promise<{ preferenceId: string; initPoint: string } | null> {
    if (!this.client) return null;

    const plan = PLANS[params.planCode as keyof typeof PLANS];
    if (!plan) return null;
    const unitPrice = params.annual ? plan.annualPrice : plan.monthlyPrice;
    const title = `MYR SMARTINVOICING - ${plan.name} (${params.annual ? 'Anual' : 'Mensual'})`;

    const body = {
      items: [
        {
          id: `plan-${params.planCode}-${params.annual ? 'annual' : 'monthly'}`,
          title,
          quantity: 1,
          unit_price: unitPrice,
          currency_id: 'COP',
        },
      ],
      payer: params.payerEmail ? { email: params.payerEmail } : undefined,
      back_urls: {
        success: params.successUrl,
        pending: params.pendingUrl,
        failure: params.failureUrl,
      },
      auto_return: 'approved' as const,
      ...(params.notificationUrl && { notification_url: params.notificationUrl }),
      external_reference: `${params.companyId}|${params.planCode}|${params.annual ? 'ANNUAL' : 'MONTHLY'}`,
    };

    const result = await this.client.create({ body });
    const preferenceId = (result as { id?: string }).id;
    const initPoint = (result as { init_point?: string }).init_point;
    if (!preferenceId || !initPoint) return null;

    await this.prisma.payment.create({
      data: {
        companyId: params.companyId,
        externalId: preferenceId,
        gateway: 'MERCADOPAGO',
        amount: unitPrice,
        currency: 'COP',
        status: 'pending',
        metadata: JSON.stringify({ planCode: params.planCode, annual: params.annual }),
      },
    });

    return { preferenceId, initPoint };
  }

  /**
   * Crea preferencia genérica (ej. pago de factura o monto libre).
   */
  async createPreferenceGeneric(params: {
    companyId: string;
    invoiceId?: string;
    title: string;
    quantity: number;
    unitPrice: number;
    payerEmail?: string;
    backUrlSuccess?: string;
    backUrlPending?: string;
  }): Promise<{ preferenceId: string; initPoint: string } | null> {
    if (!this.client) return null;

    const body = {
      items: [
        {
          id: params.invoiceId || `item-${Date.now()}`,
          title: params.title,
          quantity: params.quantity,
          unit_price: params.unitPrice,
          currency_id: 'COP',
        },
      ],
      payer: params.payerEmail ? { email: params.payerEmail } : undefined,
      back_urls: {
        success: params.backUrlSuccess || '#',
        pending: params.backUrlPending || '#',
        failure: params.backUrlPending || '#',
      },
      auto_return: 'approved' as const,
      external_reference: params.invoiceId || params.companyId,
    };

    const result = await this.client.create({ body });
    const preferenceId = (result as { id?: string }).id;
    const initPoint = (result as { init_point?: string }).init_point;
    if (!preferenceId || !initPoint) return null;

    await this.prisma.payment.create({
      data: {
        companyId: params.companyId,
        invoiceId: params.invoiceId,
        externalId: preferenceId,
        gateway: 'MERCADOPAGO',
        amount: params.unitPrice * params.quantity,
        currency: 'COP',
        status: 'pending',
      },
    });

    return { preferenceId, initPoint };
  }

  /**
   * Procesa notificación webhook de Mercado Pago (payment.created/updated).
   * Si external_reference es companyId|planCode|INTERVAL, extiende la suscripción.
   */
  async handleWebhook(payload: unknown, signature?: string): Promise<void> {
    if (this.webhookSecret && signature) {
      // TODO: validar x-signature con HMAC
    }
    const data = payload as { type?: string; data?: { id?: string } };
    if (data.type !== 'payment' || !data.data?.id) return;

    const paymentId = data.data.id;
    if (!this.accessToken) return;
    const mpConfig = new MercadoPagoConfig({ accessToken: this.accessToken });
    const paymentClient = new Payment(mpConfig);
    const payment = await paymentClient.get({ id: paymentId }).catch(() => null);
    if (!payment || (payment as { status?: string }).status !== 'approved') return;

    const extRef = (payment as { external_reference?: string }).external_reference;
    const stored = await this.prisma.payment.findFirst({
      where: { externalId: String(paymentId), gateway: 'MERCADOPAGO' },
    });
    if (stored) {
      await this.prisma.payment.update({
        where: { id: stored.id },
        data: { status: 'approved' },
      });
    }
    if (extRef && extRef.includes('|')) {
      const [companyId, planCode, interval] = extRef.split('|');
      await this.subscriptionService.extendPeriod(
        companyId,
        planCode as PlanCode,
        interval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
      );
    }
  }
}
