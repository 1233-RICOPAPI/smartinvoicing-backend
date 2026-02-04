import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AnomalyEvent, AnomalyEventDocument } from '../schemas/anomaly-event.schema';
import { FraudRulesEngine } from './fraud-rules-engine.service';
import type { AnomalySeverity } from '../schemas/anomaly-event.schema';

export interface RunDetectionOptions {
  companyId: string;
  invoiceId?: string;
  journalEntryId?: string;
  userId?: string;
}

/**
 * Orquesta la detección: reglas determinísticas (nivel 1) y persiste anomalías en MongoDB.
 * Niveles 2 (estadístico) y 3 (ML) se pueden integrar después.
 */
@Injectable()
export class AnomalyDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: FraudRulesEngine,
    @InjectModel(AnomalyEvent.name) private anomalyModel: Model<AnomalyEventDocument>,
  ) {}

  /**
   * Ejecuta detección sobre una factura y persiste anomalías.
   */
  async runOnInvoice(options: RunDetectionOptions & { invoiceId: string }): Promise<string[]> {
    const ids: string[] = [];
    const rules = await this.rulesEngine.evaluateInvoiceRules(options.companyId, options.invoiceId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: options.invoiceId, companyId: options.companyId },
      select: { clientId: true, total: true, issueDate: true },
    });
    if (invoice) {
      const dupRules = await this.rulesEngine.checkDuplicateInvoices(
        options.companyId,
        invoice.clientId,
        Number(invoice.total),
        invoice.issueDate,
        options.invoiceId,
      );
      rules.push(...dupRules);
    }
    for (const r of rules) {
      if (!r.triggered) continue;
      const doc = await this.anomalyModel.create({
        companyId: options.companyId,
        type: r.type,
        severity: r.severity,
        score: r.score,
        userId: options.userId,
        documentId: options.invoiceId,
        documentType: 'Invoice',
        explanation: r.explanation,
        recommendation: r.recommendation,
        metadata: r.metadata,
      });
      ids.push((doc as any)._id.toString());
    }
    return ids;
  }

  /**
   * Ejecuta detección sobre un asiento contable.
   */
  async runOnJournalEntry(options: RunDetectionOptions & { journalEntryId: string }): Promise<string[]> {
    const ids: string[] = [];
    const rules = await this.rulesEngine.evaluateJournalEntryRules(
      options.companyId,
      options.journalEntryId,
    );
    for (const r of rules) {
      if (!r.triggered) continue;
      const doc = await this.anomalyModel.create({
        companyId: options.companyId,
        type: r.type,
        severity: r.severity as AnomalySeverity,
        score: r.score,
        userId: options.userId,
        documentId: options.journalEntryId,
        documentType: 'JournalEntry',
        explanation: r.explanation,
        recommendation: r.recommendation,
        metadata: r.metadata,
      });
      ids.push((doc as any)._id.toString());
    }
    return ids;
  }

  /**
   * Lista anomalías por empresa y rango de fechas.
   */
  async listByCompany(
    companyId: string,
    from: Date,
    to: Date,
    options?: { type?: string; severity?: AnomalySeverity; limit?: number },
  ) {
    const filter: Record<string, unknown> = {
      companyId,
      detectedAt: { $gte: from, $lte: to },
    };
    if (options?.type) filter['type'] = options.type;
    if (options?.severity) filter['severity'] = options.severity;
    const limit = options?.limit ?? 100;
    return this.anomalyModel.find(filter).sort({ detectedAt: -1 }).limit(limit).lean().exec();
  }
}
