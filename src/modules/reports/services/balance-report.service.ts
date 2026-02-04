import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { getAccountBalance } from '../enums/account-nature.enum';
import { Decimal } from '@prisma/client/runtime/library';

export interface BalanceGroup {
  type: string;
  accounts: { code: string; name: string; totalDebit: number; totalCredit: number; saldo: number }[];
  totalDebit: number;
  totalCredit: number;
  saldo: number;
}

export interface BalanceGeneralResult {
  from: string;
  to: string;
  activos: BalanceGroup;
  pasivos: BalanceGroup;
  patrimonio: BalanceGroup;
  valid: boolean;
  error?: string;
}

/**
 * Reporte Balance General.
 * Activos = Pasivos + Patrimonio.
 * Saldo Activo/Gasto = débitos - créditos; Pasivo/Patrimonio/Ingreso = créditos - débitos.
 */
@Injectable()
export class BalanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    companyId: string,
    from: string,
    to: string,
  ): Promise<BalanceGeneralResult> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (fromDate > toDate) {
      throw new BadRequestException('La fecha desde no puede ser mayor que la fecha hasta.');
    }

    const entries = await this.prisma.accountingEntry.findMany({
      where: {
        companyId,
        date: { gte: fromDate, lte: toDate },
      },
      include: { account: true },
      orderBy: [{ account: { code: 'asc' } }, { date: 'asc' }],
    });

    const byType = this.groupByAccountType(entries);
    const activos = this.buildGroup('Activo', byType['Activo'] ?? []);
    const pasivos = this.buildGroup('Pasivo', byType['Pasivo'] ?? []);
    const patrimonio = this.buildGroup('Patrimonio', byType['Patrimonio'] ?? []);

    const totalActivos = activos.saldo;
    const totalPasivos = pasivos.saldo;
    const totalPatrimonio = patrimonio.saldo;
    const valid = Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.02;
    const error = valid
      ? undefined
      : `Descuadre: Activos (${totalActivos.toFixed(2)}) ≠ Pasivos (${totalPasivos.toFixed(2)}) + Patrimonio (${totalPatrimonio.toFixed(2)})`;

    return {
      from,
      to,
      activos,
      pasivos,
      patrimonio,
      valid,
      error,
    };
  }

  private groupByAccountType(
    entries: Array<{
      accountId: string;
      debit: Decimal;
      credit: Decimal;
      account: { id: string; code: string; name: string; type: string };
    }>,
  ): Record<string, Array<{ code: string; name: string; debit: number; credit: number }>> {
    const byAccount: Record<
      string,
      { code: string; name: string; type: string; debit: number; credit: number }
    > = {};
    for (const e of entries) {
      const key = e.account.id;
      if (!byAccount[key]) {
        byAccount[key] = {
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
    const byType: Record<string, Array<{ code: string; name: string; debit: number; credit: number }>> = {};
    for (const row of Object.values(byAccount)) {
      if (!byType[row.type]) byType[row.type] = [];
      byType[row.type].push({
        code: row.code,
        name: row.name,
        debit: row.debit,
        credit: row.credit,
      });
    }
    return byType;
  }

  private buildGroup(
    type: string,
    accounts: Array<{ code: string; name: string; debit: number; credit: number }>,
  ): BalanceGroup {
    let totalDebit = 0;
    let totalCredit = 0;
    const lines = accounts.map((a) => {
      totalDebit += a.debit;
      totalCredit += a.credit;
      const saldo = getAccountBalance(a.debit, a.credit, type);
      return {
        code: a.code,
        name: a.name,
        totalDebit: a.debit,
        totalCredit: a.credit,
        saldo,
      };
    });
    const saldo = getAccountBalance(totalDebit, totalCredit, type);
    return {
      type,
      accounts: lines,
      totalDebit,
      totalCredit,
      saldo,
    };
  }
}
