import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AnomalySeverity } from '../schemas/anomaly-event.schema';

export interface RuleResult {
  triggered: boolean;
  type: string;
  severity: AnomalySeverity;
  score: number;
  explanation: string;
  recommendation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Motor de reglas determinísticas (nivel 1): validaciones contables y DIAN.
 * No bloquea operaciones; solo detecta y reporta.
 */
@Injectable()
export class FraudRulesEngine {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evalúa reglas de facturación para una factura dada.
   */
  async evaluateInvoiceRules(companyId: string, invoiceId: string): Promise<RuleResult[]> {
    const results: RuleResult[] = [];
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { items: true, taxes: true, client: true },
    });
    if (!invoice) return results;

    const total = Number(invoice.total);
    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);

    const ivaCalculated = invoice.taxes
      .filter((t) => t.taxType === 'IVA')
      .reduce((s, t) => s + Number(t.amount), 0);
    const diff = Math.abs(ivaCalculated - taxAmount);
    if (diff > 1) {
      results.push({
        triggered: true,
        type: 'IVA_INCONSISTENT',
        severity: 'HIGH',
        score: 75,
        explanation: `IVA facturado (${taxAmount}) no coincide con la suma de impuestos IVA (${ivaCalculated}).`,
        recommendation: 'Verificar tasas y bases en ítems y en totales.',
        metadata: { taxAmount, ivaCalculated, diff },
      });
    }

    const expectedIva = subtotal * 0.19;
    if (Math.abs(taxAmount - expectedIva) > 1 && invoice.taxes.some((t) => Number(t.rate) === 19)) {
      const pct = subtotal ? (taxAmount / subtotal) * 100 : 0;
      if (pct > 0 && Math.abs(pct - 19) > 0.5) {
        results.push({
          triggered: true,
          type: 'IVA_RATE_MISMATCH',
          severity: 'MEDIUM',
          score: 55,
          explanation: `Proporción IVA/subtotal (${pct.toFixed(2)}%) no coincide con 19% esperado.`,
          recommendation: 'Revisar tasas por ítem (19%, 5%, exento).',
          metadata: { subtotal, taxAmount, percent: pct },
        });
      }
    }

    return results;
  }

  /**
   * Busca facturas duplicadas (mismo cliente, monto, fecha cercana).
   */
  async checkDuplicateInvoices(
    companyId: string,
    clientId: string,
    total: number,
    issueDate: Date,
    excludeInvoiceId?: string,
  ): Promise<RuleResult[]> {
    const dayStart = new Date(issueDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(issueDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await this.prisma.invoice.findMany({
      where: {
        companyId,
        clientId,
        issueDate: { gte: dayStart, lte: dayEnd },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      select: { id: true, fullNumber: true, total: true },
    });

    const sameAmount = existing.filter((inv) => Math.abs(Number(inv.total) - total) < 0.01);
    if (sameAmount.length > 0) {
      return [
        {
          triggered: true,
          type: 'DUPLICATE_INVOICE_SUSPECT',
          severity: 'MEDIUM',
          score: 60,
          explanation: `Se encontró ${sameAmount.length} factura(s) el mismo día para el mismo cliente con monto similar (${total}).`,
          recommendation: 'Confirmar que no sea duplicado: revisar número y concepto.',
          metadata: { sameAmount: sameAmount.map((i) => ({ id: i.id, fullNumber: i.fullNumber })) },
        },
      ];
    }
    return [];
  }

  /**
   * Reglas sobre asientos contables: debe = haber.
   */
  async evaluateJournalEntryRules(companyId: string, journalEntryId: string): Promise<RuleResult[]> {
    const entry = await this.prisma.accountingJournalEntry.findFirst({
      where: { id: journalEntryId, companyId },
      include: { lines: true },
    });
    if (!entry) return [];

    const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      return [
        {
          triggered: true,
          type: 'UNBALANCED_ENTRY',
          severity: 'CRITICAL',
          score: 95,
          explanation: `Asiento descuadrado: Debe ${totalDebit.toFixed(2)} ≠ Haber ${totalCredit.toFixed(2)}.`,
          recommendation: 'Ajustar líneas para que la partida doble cuadre.',
          metadata: { totalDebit, totalCredit, diff },
        },
      ];
    }
    return [];
  }
}
