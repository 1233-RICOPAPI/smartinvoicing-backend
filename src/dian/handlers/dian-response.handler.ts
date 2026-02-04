import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DianHistory, DianHistoryDocument } from '../schemas/dian-history.schema';
import type { DianSendResult } from '../api/dian-api.service';

export interface HandleResult {
  invoiceStatus: 'ACEPTADA' | 'RECHAZADA' | 'ENVIADA';
  statusDian: string;
}

/**
 * Procesa la respuesta DIAN: actualiza PostgreSQL (Invoice, DianDocument, DianEvent)
 * y persiste en MongoDB para historial y auditoría.
 */
@Injectable()
export class DianResponseHandler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(DianHistory.name) private readonly historyModel: Model<DianHistoryDocument>,
  ) {}

  async handle(
    companyId: string,
    invoiceId: string,
    dianDocumentId: string,
    result: DianSendResult,
    xmlSent: string,
  ): Promise<HandleResult> {
    const statusDian = result.statusDian ?? (result.success && result.isValid ? 'ACEPTADO' : 'PENDIENTE');
    const invoiceStatus =
      statusDian === 'ACEPTADO' ? 'ACEPTADA' : statusDian === 'RECHAZADO' ? 'RECHAZADA' : 'ENVIADA';

    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: invoiceStatus },
      }),
      this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: {
          sentAt: new Date(),
          dianResponse: result.responsePayload ?? null,
          xmlResponse: result.xmlResponse ?? null,
          isValid: result.isValid ?? null,
          statusDian,
        },
      }),
      this.prisma.dianEvent.create({
        data: {
          companyId,
          invoiceId,
          eventType: statusDian === 'ACEPTADO' ? 'ACEPTACION' : statusDian === 'RECHAZADO' ? 'RECHAZO' : 'NOTIFICACION',
          payload: result.responsePayload ?? JSON.stringify({ success: result.success, message: result.message }),
        },
      }),
    ]);

    await this.historyModel.create({
      companyId,
      invoiceId,
      dianDocumentId,
      xmlSent: xmlSent.slice(0, 50000),
      responsePayload: result.responsePayload?.slice(0, 50000),
      statusDian,
      isValid: result.isValid ?? undefined,
      sentAt: new Date(),
    });

    return { invoiceStatus, statusDian };
  }
}
