import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { getAccountBalance } from '../enums/account-nature.enum';
import { Decimal } from '@prisma/client/runtime/library';

export interface IncomeStatementLine {
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  saldo: number;
}

export interface IncomeStatementResult {
  from: string;
  to: string;
  ingresos: IncomeStatementLine[];
  totalIngresos: number;
  costos: IncomeStatementLine[];
  totalCostos: number;
  gastos: IncomeStatementLine[];
  totalGastos: number;
  utilidadBruta: number;
  utilidadOperacional: number;
  utilidadNeta: number;
}

/**
 * Estado de Resultados (Pérdidas y Ganancias).
 * Utilidad = Ingresos - Costos - Gastos.
 * Solo cuentas tipo Ingreso, Costo y Gasto en el período.
 */
@Injectable()
export class IncomeStatementService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    companyId: string,
    from: string,
    to: string,
  ): Promise<IncomeStatementResult> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (fromDate > toDate) {
      throw new BadRequestException('La fecha desde no puede ser mayor que la fecha hasta.');
    }

    const entries = await this.prisma.accountingEntry.findMany({
      where: {
        companyId,
        date: { gte: fromDate, lte: toDate },
        account: {
          type: { in: ['Ingreso', 'Costo', 'Gasto'] },
        },
      },
      include: { account: true },
      orderBy: [{ account: { code: 'asc' } }, { date: 'asc' }],
    });

    const byAccount = this.aggregateByAccount(entries);
    const ingresos = this.buildSection('Ingreso', byAccount['Ingreso'] ?? []);
    const costos = this.buildSection('Costo', byAccount['Costo'] ?? []);
    const gastos = this.buildSection('Gasto', byAccount['Gasto'] ?? []);

    const totalIngresos = ingresos.reduce((s, l) => s + l.saldo, 0);
    const totalCostos = costos.reduce((s, l) => s + l.saldo, 0);
    const totalGastos = gastos.reduce((s, l) => s + l.saldo, 0);

    const utilidadBruta = totalIngresos - totalCostos;
    const utilidadOperacional = utilidadBruta - totalGastos;
    const utilidadNeta = utilidadOperacional;

    return {
      from,
      to,
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

  private aggregateByAccount(
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

  private buildSection(
    nature: string,
    accounts: Array<{ code: string; name: string; debit: number; credit: number }>,
  ): IncomeStatementLine[] {
    return accounts.map((a) => ({
      code: a.code,
      name: a.name,
      totalDebit: a.debit,
      totalCredit: a.credit,
      saldo: getAccountBalance(a.debit, a.credit, nature),
    }));
  }
}
