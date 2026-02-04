import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DianHistory, DianHistoryDocument } from '../../../dian/schemas/dian-history.schema';

/** Acciones fiscales/DIAN que se registran en audit_logs */
export const DIAN_AUDIT_ACTIONS = {
  DIAN_ENVIO: 'DIAN_ENVIO',
  DIAN_CAMBIO_ESTADO: 'DIAN_CAMBIO_ESTADO',
  DIAN_REINTENTO: 'DIAN_REINTENTO',
  AJUSTE_CONTABLE: 'AJUSTE_CONTABLE',
} as const;

export interface DianHistoryEntry {
  at: string;
  type: string;
  description: string;
  payload?: Record<string, unknown>;
  source: 'dian_event' | 'dian_history' | 'audit_log' | 'invoice';
}

export interface DianHistoryResult {
  invoiceId: string;
  fullNumber: string;
  cufe: string | null;
  status: string;
  statusDian: string | null;
  entries: DianHistoryEntry[];
}

/**
 * Auditoría DIAN: registra acciones críticas en audit_logs y expone historial
 * unificado (DianEvent, dian_history, audit_logs, Invoice) por factura.
 */
@Injectable()
export class DianAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectModel(DianHistory.name) private readonly dianHistoryModel: Model<DianHistoryDocument>,
  ) {}

  /**
   * Registra una acción fiscal/DIAN en audit_logs (MongoDB).
   */
  async logDianAction(params: {
    companyId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    payload?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.auditService.log({
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      payload: params.payload,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Historial completo de una factura: eventos DIAN (PG), dian_history (Mongo),
   * audit_logs (Mongo) y estado actual de la factura.
   */
  async getDianHistory(companyId: string, invoiceId: string): Promise<DianHistoryResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { dianDoc: true },
    });
    if (!invoice) throw new Error('Factura no encontrada');

    const events = await this.prisma.dianEvent.findMany({
      where: { companyId, invoiceId },
      orderBy: { createdAt: 'asc' },
    });

    const historyDocs = await this.dianHistoryModel
      .find({ companyId, invoiceId })
      .sort({ sentAt: 1 })
      .lean()
      .exec();

    const auditLogs = await this.auditService.findByEntity(companyId, 'Invoice', invoiceId);

    const entries: DianHistoryEntry[] = [];

    entries.push({
      at: invoice.createdAt.toISOString(),
      type: 'CREACION',
      description: `Factura ${invoice.fullNumber} creada`,
      payload: { status: invoice.status },
      source: 'invoice',
    });

    for (const e of events) {
      const desc =
        e.eventType === 'ENVIO'
          ? 'Envío a DIAN'
          : e.eventType === 'ACEPTACION'
            ? 'Respuesta DIAN: Aceptada'
            : e.eventType === 'RECHAZO'
              ? 'Respuesta DIAN: Rechazada'
              : `Evento: ${e.eventType}`;
      entries.push({
        at: e.createdAt.toISOString(),
        type: e.eventType,
        description: desc,
        payload: e.payload ? (typeof e.payload === 'string' ? { raw: e.payload } : (e.payload as Record<string, unknown>)) : undefined,
        source: 'dian_event',
      });
    }

    for (const h of historyDocs) {
      entries.push({
        at: (h.sentAt ?? (h as any).createdAt)?.toISOString?.() ?? new Date().toISOString(),
        type: 'ENVIO_HISTORIAL',
        description: `Intento envío DIAN - ${h.statusDian ?? 'PENDIENTE'}`,
        payload: { statusDian: h.statusDian, isValid: h.isValid },
        source: 'dian_history',
      });
    }

    for (const a of auditLogs) {
      entries.push({
        at: a.createdAt.toISOString(),
        type: a.action,
        description: a.action,
        payload: a.payload,
        source: 'audit_log',
      });
    }

    entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      invoiceId,
      fullNumber: invoice.fullNumber,
      cufe: invoice.dianDoc?.cufe ?? null,
      status: invoice.status,
      statusDian: invoice.dianDoc?.statusDian ?? null,
      entries,
    };
  }
}
