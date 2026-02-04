import { Injectable } from '@nestjs/common';
import { BalanceReportService } from '../../reports/services/balance-report.service';
import { IncomeStatementService } from '../../reports/services/income-statement.service';
import { AccountingAnalyticsService } from '../../analytics/services/accounting-analytics.service';
import { AnomalyDetectionService } from '../../analytics/services/anomaly-detection.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { COPILOT_INTENTS } from '../constants/intents';
import type { ParsedIntent } from './intent-parser.service';

/**
 * Motor de consultas: solo invoca servicios existentes con companyId y parámetros parseados.
 * No ejecuta SQL libre; evita inyección.
 */
@Injectable()
export class QueryEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceReport: BalanceReportService,
    private readonly incomeStatement: IncomeStatementService,
    private readonly accountingAnalytics: AccountingAnalyticsService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  async execute(
    companyId: string,
    parsed: ParsedIntent,
  ): Promise<Record<string, unknown>> {
    const { intent, from, to } = parsed;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    switch (intent) {
      case COPILOT_INTENTS.BALANCE: {
        const data = await this.balanceReport.generate(companyId, from, to);
        return {
          from: data.from,
          to: data.to,
          activos: data.activos,
          pasivos: data.pasivos,
          patrimonio: data.patrimonio,
          valid: data.valid,
          error: data.error,
        };
      }
      case COPILOT_INTENTS.INCOME_STATEMENT: {
        const data = await this.incomeStatement.generate(companyId, from, to);
        return {
          from: data.from,
          to: data.to,
          totalIngresos: data.totalIngresos,
          totalCostos: data.totalCostos,
          totalGastos: data.totalGastos,
          utilidadBruta: data.utilidadBruta,
          utilidadOperacional: data.utilidadOperacional,
          utilidadNeta: data.utilidadNeta,
        };
      }
      case COPILOT_INTENTS.INVOICES_SUMMARY: {
        const monthly = await this.accountingAnalytics.getMonthlyInvoiceTotals(
          companyId,
          fromDate.getFullYear(),
          toDate.getFullYear(),
        );
        const period = monthly.filter((m) => {
          const monthStart = new Date(m.year, m.month - 1, 1);
          const monthEnd = new Date(m.year, m.month, 0);
          return monthEnd >= fromDate && monthStart <= toDate;
        });
        const totalInvoiced = period.reduce((s, p) => s + p.totalInvoiced, 0);
        const invoiceCount = period.reduce((s, p) => s + p.invoiceCount, 0);
        return {
          from,
          to,
          totalInvoiced,
          totalTax: period.reduce((s, p) => s + p.totalTax, 0),
          invoiceCount,
          byMonth: period,
        };
      }
      case COPILOT_INTENTS.TAX_SUMMARY: {
        const invoices = await this.prisma.invoice.findMany({
          where: {
            companyId,
            status: 'ACEPTADA',
            issueDate: { gte: fromDate, lte: toDate },
          },
          select: { taxAmount: true, subtotal: true, total: true },
        });
        const totalIva = invoices.reduce((s, i) => s + Number(i.taxAmount), 0);
        const totalBase = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
        const totalVentas = invoices.reduce((s, i) => s + Number(i.total), 0);
        return {
          from,
          to,
          totalIva,
          totalBaseGravable: totalBase,
          totalVentas,
          invoiceCount: invoices.length,
        };
      }
      case COPILOT_INTENTS.TAX_IVA_DUE: {
        const invoices = await this.prisma.invoice.findMany({
          where: {
            companyId,
            status: 'ACEPTADA',
            issueDate: { gte: fromDate, lte: toDate },
          },
          select: { taxAmount: true, subtotal: true, total: true },
        });
        const ivaGenerado = invoices.reduce((s, i) => s + Number(i.taxAmount), 0);
        const mapping = await this.prisma.companyAccountMapping.findFirst({
          where: { companyId, accountKey: 'IVA_DESCONTABLE' },
          select: { accountId: true },
        });
        let ivaDescontable = 0;
        if (mapping) {
          const entries = await this.prisma.accountingEntry.findMany({
            where: {
              companyId,
              accountId: mapping.accountId,
              date: { gte: fromDate, lte: toDate },
            },
            select: { debit: true, credit: true },
          });
          ivaDescontable = entries.reduce((s, e) => s + Number(e.debit) - Number(e.credit), 0);
        }
        const ivaAPagar = Math.max(0, ivaGenerado - ivaDescontable);
        return {
          from,
          to,
          ivaGenerado,
          ivaDescontable,
          ivaAPagar,
          invoiceCount: invoices.length,
        };
      }
      case COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE: {
        const invoiceRef = parsed.invoiceRef?.trim();
        if (!invoiceRef) {
          return { from, to, message: 'Indica el número de factura (ej. SETP80000001) para consultar retenciones.' };
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceRef);
        const invoice = await this.prisma.invoice.findFirst({
          where: isUuid
            ? { id: invoiceRef, companyId }
            : { fullNumber: invoiceRef, companyId },
          include: { taxes: true },
        });
        if (!invoice) {
          return { from, to, invoiceRef, message: `No se encontró la factura "${invoiceRef}".` };
        }
        const retenciones = invoice.taxes.filter(
          (t) => ['ReteFuente', 'ReteICA', 'ReteIVA', 'Retención Fuente', 'Retención ICA', 'Retención IVA'].includes(t.taxType) || /rete|retencion/i.test(t.taxType),
        );
        return {
          from,
          to,
          invoiceId: invoice.id,
          fullNumber: invoice.fullNumber,
          issueDate: invoice.issueDate.toISOString().slice(0, 10),
          retenciones: retenciones.map((r) => ({
            taxType: r.taxType,
            rate: Number(r.rate),
            base: Number(r.base),
            amount: Number(r.amount),
          })),
          totalRetenciones: retenciones.reduce((s, r) => s + Number(r.amount), 0),
        };
      }
      case COPILOT_INTENTS.TAX_INSISTENCIES_SANCTIONS: {
        const anomalies = await this.anomalyDetection.listByCompany(
          companyId,
          fromDate,
          toDate,
          { limit: 30 },
        );
        const rejected = await this.prisma.invoice.findMany({
          where: {
            companyId,
            status: 'RECHAZADA',
            issueDate: { gte: fromDate, lte: toDate },
          },
          select: { id: true, fullNumber: true, issueDate: true },
        });
        const taxRelated = (anomalies as any[]).filter(
          (a) => /iva|impuesto|retencion|fiscal|tribut|cuadre|descuadre/i.test(String(a.type || '') + String(a.explanation || '')),
        );
        return {
          from,
          to,
          anomaliesCount: anomalies.length,
          taxRelatedCount: taxRelated.length,
          rejectedInvoicesCount: rejected.length,
          rejectedInvoices: rejected.slice(0, 10),
          taxRelatedAnomalies: taxRelated.slice(0, 5),
        };
      }
      case COPILOT_INTENTS.COMPARISON: {
        const current = await this.incomeStatement.generate(companyId, from, to);
        const prevFrom = new Date(fromDate);
        prevFrom.setMonth(prevFrom.getMonth() - 1);
        const prevTo = new Date(toDate);
        prevTo.setMonth(prevTo.getMonth() - 1);
        const prevFromStr = prevFrom.toISOString().slice(0, 10);
        const prevToStr = prevTo.toISOString().slice(0, 10);
        const previous = await this.incomeStatement.generate(companyId, prevFromStr, prevToStr);
        return {
          currentPeriod: { from, to, utilidadNeta: current.utilidadNeta, totalIngresos: current.totalIngresos },
          previousPeriod: {
            from: prevFromStr,
            to: prevToStr,
            utilidadNeta: previous.utilidadNeta,
            totalIngresos: previous.totalIngresos,
          },
          diffUtilidad: current.utilidadNeta - previous.utilidadNeta,
          diffIngresos: current.totalIngresos - previous.totalIngresos,
        };
      }
      case COPILOT_INTENTS.ANOMALIES: {
        const anomalies = await this.anomalyDetection.listByCompany(
          companyId,
          fromDate,
          toDate,
          { limit: 20 },
        );
        return {
          from,
          to,
          count: anomalies.length,
          anomalies: anomalies.slice(0, 10),
        };
      }
      case COPILOT_INTENTS.EXPLAIN:
      case COPILOT_INTENTS.UNKNOWN:
      default:
        return { from, to, message: 'No se encontraron datos para esta consulta. Pruebe con: balance, resultados, facturación, IVA, comparación o anomalías.' };
    }
  }
}
