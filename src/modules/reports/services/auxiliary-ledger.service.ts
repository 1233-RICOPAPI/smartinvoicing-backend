import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { getAccountBalance } from '../enums/account-nature.enum';
import { Decimal } from '@prisma/client/runtime/library';

export interface AuxiliaryLedgerLine {
  date: string;
  document: string;
  thirdParty: string | null;
  debit: number;
  credit: number;
  saldoAcumulado: number;
}

export interface AuxiliaryLedgerResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  from: string;
  to: string;
  lines: AuxiliaryLedgerLine[];
  saldoInicial: number;
  saldoFinal: number;
}

/**
 * Libro auxiliar por cuenta.
 * Movimientos en orden cronológico con saldo acumulado.
 */
@Injectable()
export class AuxiliaryLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    companyId: string,
    dto: { accountId?: string; accountCode?: string; from: string; to: string },
  ): Promise<AuxiliaryLedgerResult> {
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);
    if (fromDate > toDate) {
      throw new BadRequestException('La fecha desde no puede ser mayor que la fecha hasta.');
    }

    let account: { id: string; code: string; name: string; type: string };
    if (dto.accountId) {
      const a = await this.prisma.accountingAccount.findFirst({
        where: { id: dto.accountId, companyId },
      });
      if (!a) throw new BadRequestException('Cuenta no encontrada.');
      account = { id: a.id, code: a.code, name: a.name, type: a.type };
    } else if (dto.accountCode) {
      const a = await this.prisma.accountingAccount.findFirst({
        where: { code: dto.accountCode, companyId },
      });
      if (!a) throw new BadRequestException('Cuenta no encontrada.');
      account = { id: a.id, code: a.code, name: a.name, type: a.type };
    } else {
      throw new BadRequestException('Indique accountId o accountCode.');
    }

    const entries = await this.prisma.accountingEntry.findMany({
      where: {
        companyId,
        accountId: account.id,
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        journalEntry: true,
        invoice: { include: { client: true } },
      },
      orderBy: { date: 'asc' },
    });

    const saldoInicial = await this.saldoAnteriorHasta(companyId, account.id, account.type, fromDate);

    const lines: AuxiliaryLedgerLine[] = [];
    let saldoAcumulado = saldoInicial;
    for (const e of entries) {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      const movimiento = getAccountBalance(debit, credit, account.type);
      saldoAcumulado += movimiento;
      const doc = e.journalEntry?.documentNumber ?? e.reference ?? e.description ?? '';
      const thirdParty = e.invoice?.client?.name ?? null;
      lines.push({
        date: e.date.toISOString().slice(0, 10),
        document: doc,
        thirdParty,
        debit,
        credit,
        saldoAcumulado,
      });
    }

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      from: dto.from,
      to: dto.to,
      lines,
      saldoInicial,
      saldoFinal: saldoAcumulado,
    };
  }

  private async saldoAnteriorHasta(
    companyId: string,
    accountId: string,
    accountType: string,
    before: Date,
  ): Promise<number> {
    const entries = await this.prisma.accountingEntry.findMany({
      where: {
        companyId,
        accountId,
        date: { lt: before },
      },
    });
    let totalDebit = 0;
    let totalCredit = 0;
    for (const e of entries) {
      totalDebit += Number(e.debit);
      totalCredit += Number(e.credit);
    }
    return getAccountBalance(totalDebit, totalCredit, accountType);
  }
}
