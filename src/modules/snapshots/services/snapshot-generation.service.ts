import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  AccountingSnapshot,
  AccountingSnapshotDocument,
  AccountSummaryItem,
  BalanceSheetSection,
  BalanceSheetSnapshot,
  IncomeStatementLine,
  IncomeStatementSnapshot,
} from '../schemas/accounting-snapshot.schema';
import { getAccountBalance } from '../../reports/enums/account-nature.enum';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Genera snapshots contables mensuales desde PostgreSQL y los persiste en MongoDB.
 * PostgreSQL = fuente de verdad. MongoDB = solo agregados/snapshots.
 * No se recalculan snapshots ya cerrados (status CLOSED).
 */
@Injectable()
export class SnapshotGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(AccountingSnapshot.name)
    private readonly snapshotModel: Model<AccountingSnapshotDocument>,
  ) {}

  /**
   * Genera o actualiza el snapshot del mes. Solo permite si status !== CLOSED.
   * Lee todos los asientos hasta el último día del mes (estado final acumulado).
   */
  async generateMonthlySnapshot(
    companyId: string,
    year: number,
    month: number,
  ): Promise<AccountingSnapshotDocument> {
    const existing = await this.snapshotModel.findOne({ companyId, year, month }).lean();
    if (existing?.status === 'CLOSED') {
      throw new BadRequestException(
        `El mes ${year}-${String(month).padStart(2, '0')} está cerrado. No se puede reprocesar.`,
      );
    }

    const periodEnd = new Date(year, month, 0); // último día del mes
    const periodStart = new Date(year, month - 1, 1);

    const entries = await this.prisma.accountingEntry.findMany({
      where: {
        companyId,
        date: { lte: periodEnd },
      },
      include: { account: true },
      orderBy: [{ account: { code: 'asc' } }, { date: 'asc' }],
    });

    const accountsSummary = this.buildAccountsSummary(entries);
    const balanceSheet = this.buildBalanceSheet(accountsSummary);
    const incomeStatement = this.buildIncomeStatement(accountsSummary);

    const payload = {
      companyId,
      year,
      month,
      status: 'OPEN' as const,
      generatedAt: new Date(),
      balanceSheet,
      incomeStatement,
      accountsSummary,
      periodStart,
      periodEnd,
    };

    const doc = await this.snapshotModel.findOneAndUpdate(
      { companyId, year, month },
      { $set: payload },
      { new: true, upsert: true },
    );
    return doc;
  }

  private buildAccountsSummary(
    entries: Array<{
      accountId: string;
      debit: Decimal;
      credit: Decimal;
      account: { id: string; code: string; name: string; type: string };
    }>,
  ): AccountSummaryItem[] {
    const byAccount: Record<
      string,
      { id: string; code: string; name: string; type: string; debit: number; credit: number }
    > = {};
    for (const e of entries) {
      const key = e.account.id;
      if (!byAccount[key]) {
        byAccount[key] = {
          id: e.account.id,
          code: e.account.code,
          name: e.account.name,
          type: e.account.type,
          debit: 0,
          credit: 0,
        };
      }
      byAccount[key].debit += Number(e.debit);
      byAccount[key].credit += Number(e.credit);
    }
    return Object.values(byAccount).map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      totalDebit: a.debit,
      totalCredit: a.credit,
      saldo: getAccountBalance(a.debit, a.credit, a.type),
    }));
  }

  private buildBalanceSheet(summary: AccountSummaryItem[]): BalanceSheetSnapshot {
    const byType: Record<string, AccountSummaryItem[]> = {};
    for (const a of summary) {
      if (['Activo', 'Pasivo', 'Patrimonio'].includes(a.type)) {
        if (!byType[a.type]) byType[a.type] = [];
        byType[a.type].push(a);
      }
    }
    const buildSection = (type: string): BalanceSheetSection => {
      const accounts = byType[type] ?? [];
      let totalDebit = 0;
      let totalCredit = 0;
      for (const a of accounts) {
        totalDebit += a.totalDebit;
        totalCredit += a.totalCredit;
      }
      const saldo = getAccountBalance(totalDebit, totalCredit, type);
      return { type, accounts, totalDebit, totalCredit, saldo };
    };
    const activos = buildSection('Activo');
    const pasivos = buildSection('Pasivo');
    const patrimonio = buildSection('Patrimonio');
    const valid =
      Math.abs(activos.saldo - (pasivos.saldo + patrimonio.saldo)) < 0.02;
    const error = valid
      ? undefined
      : `Descuadre: Activos ≠ Pasivos + Patrimonio`;
    return { activos, pasivos, patrimonio, valid, error };
  }

  private buildIncomeStatement(summary: AccountSummaryItem[]): IncomeStatementSnapshot {
    const ingresos = (summary.filter((a) => a.type === 'Ingreso') as AccountSummaryItem[]).map(
      (a) => ({ code: a.code, name: a.name, saldo: a.saldo }),
    );
    const costos = (summary.filter((a) => a.type === 'Costo') as AccountSummaryItem[]).map(
      (a) => ({ code: a.code, name: a.name, saldo: a.saldo }),
    );
    const gastos = (summary.filter((a) => a.type === 'Gasto') as AccountSummaryItem[]).map(
      (a) => ({ code: a.code, name: a.name, saldo: a.saldo }),
    );
    const totalIngresos = ingresos.reduce((s, l) => s + l.saldo, 0);
    const totalCostos = costos.reduce((s, l) => s + l.saldo, 0);
    const totalGastos = gastos.reduce((s, l) => s + l.saldo, 0);
    const utilidadBruta = totalIngresos - totalCostos;
    const utilidadOperacional = utilidadBruta - totalGastos;
    const utilidadNeta = utilidadOperacional;
    return {
      ingresos,
      totalIngresos,
      costos,
      totalCostos,
      gastos,
      totalGastos,
      utilidadBruta,
      utilidadOperacional,
      utilidadNeta,
    };
  }

  async getSnapshot(
    companyId: string,
    year: number,
    month: number,
  ): Promise<AccountingSnapshotDocument | null> {
    return this.snapshotModel.findOne({ companyId, year, month }).exec();
  }
}
