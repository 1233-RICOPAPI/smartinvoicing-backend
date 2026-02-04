import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface MonthlyTotals {
  year: number;
  month: number;
  totalInvoiced: number;
  totalTax: number;
  invoiceCount: number;
}

/**
 * Métricas analíticas desde PostgreSQL para comparación histórica y detección estadística (nivel 2).
 * Z-score, percentiles y comparación mensual se pueden calcular a partir de estos datos.
 */
@Injectable()
export class AccountingAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Totales de facturación por mes (empresa).
   */
  async getMonthlyInvoiceTotals(
    companyId: string,
    yearStart: number,
    yearEnd: number,
  ): Promise<MonthlyTotals[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: 'ACEPTADA',
        issueDate: {
          gte: new Date(yearStart, 0, 1),
          lte: new Date(yearEnd, 11, 31, 23, 59, 59),
        },
      },
      select: {
        issueDate: true,
        total: true,
        taxAmount: true,
      },
    });

    const byMonth = new Map<string, { total: number; tax: number; count: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = byMonth.get(key) ?? { total: 0, tax: 0, count: 0 };
      cur.total += Number(inv.total);
      cur.tax += Number(inv.taxAmount);
      cur.count += 1;
      byMonth.set(key, cur);
    }

    const result: MonthlyTotals[] = [];
    for (const [key, v] of byMonth) {
      const [y, m] = key.split('-').map(Number);
      result.push({
        year: y,
        month: m,
        totalInvoiced: v.total,
        totalTax: v.tax,
        invoiceCount: v.count,
      });
    }
    result.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    return result;
  }

  /**
   * Conteo de facturas por día en un rango (para picos atípicos).
   */
  async getDailyInvoiceCounts(
    companyId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; count: number; total: number }>> {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, status: 'ACEPTADA', issueDate: { gte: from, lte: to } },
      select: { issueDate: true, total: true },
    });
    const byDay = new Map<string, { count: number; total: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.issueDate);
      const key = d.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(inv.total);
      byDay.set(key, cur);
    }
    return Array.from(byDay.entries()).map(([date, v]) => ({ date, count: v.count, total: v.total }));
  }
}
