import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DianApiService } from '../api/dian-api.service';
import { DianResponseHandler } from '../handlers/dian-response.handler';
import { DianAuditService, DIAN_AUDIT_ACTIONS } from '../../modules/audit/services/dian-audit.service';

const MAX_RETRIES = 3;

export interface DianAuditContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface FacturaStatus {
  invoiceId: string;
  status: string;
  statusDian: string | null;
  sentAt: Date | null;
  isValid: boolean | null;
  attemptCount: number;
}

/**
 * Consulta y actualiza el estado de facturas electrónicas.
 * Reintentos automáticos con límite configurable.
 */
@Injectable()
export class FacturaStatusTracker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dianApi: DianApiService,
    private readonly responseHandler: DianResponseHandler,
    private readonly dianAudit: DianAuditService,
  ) {}

  async getStatus(companyId: string, invoiceId: string): Promise<FacturaStatus | null> {
    const doc = await this.prisma.dianDocument.findFirst({
      where: { invoiceId, companyId },
    });
    if (!doc) return null;
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    const events = await this.prisma.dianEvent.count({
      where: { invoiceId, companyId, eventType: 'ENVIO' },
    });
    return {
      invoiceId,
      status: invoice?.status ?? 'CREADA',
      statusDian: doc.statusDian,
      sentAt: doc.sentAt,
      isValid: doc.isValid,
      attemptCount: events,
    };
  }

  /**
   * Reenvía a DIAN si está en estado FIRMADA/ENVIADA y no supera MAX_RETRIES.
   * Registra la acción DIAN_REINTENTO en auditoría.
   */
  async retrySend(
    companyId: string,
    invoiceId: string,
    auditContext?: DianAuditContext,
  ): Promise<{ success: boolean; message?: string; statusDian?: string }> {
    const doc = await this.prisma.dianDocument.findFirst({
      where: { invoiceId, companyId },
    });
    if (!doc?.xmlSent) return { success: false, message: 'No hay XML firmado' };

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (invoice?.status === 'ACEPTADA') return { success: true, statusDian: 'ACEPTADO', message: 'Ya aceptada' };
    if (invoice?.status === 'RECHAZADA') return { success: false, statusDian: 'RECHAZADO', message: 'Factura rechazada' };

    const sendCount = await this.prisma.dianEvent.count({
      where: { invoiceId, companyId, eventType: 'ENVIO' },
    });
    if (sendCount >= MAX_RETRIES) return { success: false, message: `Máximo ${MAX_RETRIES} intentos de envío` };

    await this.prisma.dianEvent.create({
      data: {
        companyId,
        invoiceId,
        eventType: 'ENVIO',
        payload: JSON.stringify({ dianDocumentId: doc.id, attempt: sendCount + 1, sentAt: new Date().toISOString() }),
      },
    });

    const result = await this.dianApi.sendDocument(companyId, doc.xmlSent);
    const { statusDian } = await this.responseHandler.handle(
      companyId,
      invoiceId,
      doc.id,
      result,
      doc.xmlSent,
    );

    await this.dianAudit.logDianAction({
      companyId,
      userId: auditContext?.userId,
      action: DIAN_AUDIT_ACTIONS.DIAN_REINTENTO,
      entity: 'Invoice',
      entityId: invoiceId,
      payload: { attempt: sendCount + 1, success: result.success, statusDian, message: result.message },
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent,
    });

    return {
      success: result.success && statusDian === 'ACEPTADO',
      message: result.message,
      statusDian,
    };
  }
}
