import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BalanceReportService, BalanceGeneralResult } from '../../reports/services/balance-report.service';
import { IncomeStatementService, IncomeStatementResult } from '../../reports/services/income-statement.service';
import { AuxiliaryLedgerService, AuxiliaryLedgerResult } from '../../reports/services/auxiliary-ledger.service';
import ExcelJS from 'exceljs';
import { ExportReportType } from '../dtos/export-query.dto';
import { Readable } from 'stream';

@Injectable()
export class ExcelExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceReport: BalanceReportService,
    private readonly incomeStatement: IncomeStatementService,
    private readonly auxiliaryLedger: AuxiliaryLedgerService,
  ) {}

  async createBalanceSheetExcel(companyId: string, from: string, to: string): Promise<Buffer> {
    const data = await this.balanceReport.generate(companyId, from, to);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MottaTech';
    const ws = wb.addWorksheet('Balance General', { views: [{ state: 'frozen', ySplit: 2 }] });
    ws.columns = [
      { width: 14 },
      { width: 40 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `Balance General - Del ${data.from} al ${data.to}`;
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.addRow([]);
    const header = ['Código', 'Cuenta', 'Débitos', 'Créditos', 'Saldo'];
    ws.addRow(header);
    ws.getRow(3).font = { bold: true };

    const pushGroup = (g: BalanceGeneralResult['activos']) => {
      ws.addRow([g.type, '', '', '', '']);
      ws.lastRow!.font = { bold: true };
      for (const a of g.accounts) {
        ws.addRow([a.code, a.name, a.totalDebit, a.totalCredit, a.saldo]);
      }
      ws.addRow(['', 'Total ' + g.type, g.totalDebit, g.totalCredit, g.saldo]);
      ws.lastRow!.font = { bold: true };
      ws.addRow([]);
    };
    pushGroup(data.activos);
    pushGroup(data.pasivos);
    pushGroup(data.patrimonio);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async createIncomeStatementExcel(companyId: string, from: string, to: string): Promise<Buffer> {
    const data = await this.incomeStatement.generate(companyId, from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Estado de Resultados');
    ws.columns = [{ width: 14 }, { width: 40 }, { width: 16 }, { width: 16 }, { width: 16 }];
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `Estado de Resultados (P&G) - Del ${data.from} al ${data.to}`;
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.addRow([]);
    ws.addRow(['Código', 'Cuenta', 'Débitos', 'Créditos', 'Saldo']);
    ws.lastRow!.font = { bold: true };

    const pushSection = (title: string, lines: IncomeStatementResult['ingresos'], total: number) => {
      ws.addRow([title, '', '', '', '']);
      ws.lastRow!.font = { bold: true };
      for (const l of lines) {
        ws.addRow([l.code, l.name, l.totalDebit, l.totalCredit, l.saldo]);
      }
      ws.addRow(['', 'Total ' + title, '', '', total]);
      ws.lastRow!.font = { bold: true };
      ws.addRow([]);
    };
    pushSection('Ingresos', data.ingresos, data.totalIngresos);
    pushSection('Costos', data.costos, data.totalCostos);
    pushSection('Gastos', data.gastos, data.totalGastos);
    ws.addRow(['Utilidad Bruta', '', '', '', data.utilidadBruta]);
    ws.addRow(['Utilidad Operacional', '', '', '', data.utilidadOperacional]);
    ws.addRow(['Utilidad Neta', '', '', '', data.utilidadNeta]);
    ws.lastRow!.font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async createAuxiliaryLedgerExcel(
    companyId: string,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<Buffer> {
    const data = await this.auxiliaryLedger.generate(companyId, {
      from,
      to,
      accountCode,
      accountId,
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Libro Auxiliar');
    ws.columns = [
      { width: 12 },
      { width: 18 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ];
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `Libro Auxiliar - ${data.accountCode} ${data.accountName} - Del ${data.from} al ${data.to}`;
    ws.getCell('A1').font = { bold: true };
    ws.addRow(['Saldo inicial', '', '', '', '', data.saldoInicial]);
    ws.addRow([]);
    ws.addRow(['Fecha', 'Documento', 'Tercero', 'Débito', 'Crédito', 'Saldo acumulado']);
    ws.lastRow!.font = { bold: true };
    for (const l of data.lines) {
      ws.addRow([l.date, l.document, l.thirdParty ?? '', l.debit, l.credit, l.saldoAcumulado]);
    }
    ws.addRow(['', '', 'Saldo final', '', '', data.saldoFinal]);
    ws.lastRow!.font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async createJournalEntriesExcel(companyId: string, from: string, to: string): Promise<Buffer> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const entries = await this.prisma.accountingJournalEntry.findMany({
      where: {
        companyId,
        date: { gte: fromDate, lte: toDate },
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asientos');
    ws.columns = [
      { width: 12 },
      { width: 18 },
      { width: 12 },
      { width: 36 },
      { width: 14 },
      { width: 14 },
    ];
    ws.getCell('A1').value = `Asientos contables - Del ${from} al ${to}`;
    ws.getCell('A1').font = { bold: true };
    ws.addRow([]);
    ws.addRow(['Fecha', 'Nº Documento', 'Cuenta', 'Descripción', 'Débito', 'Crédito']);
    ws.lastRow!.font = { bold: true };
    for (const je of entries) {
      let first = true;
      for (const line of je.lines) {
        ws.addRow([
          first ? je.date.toISOString().slice(0, 10) : '',
          first ? je.documentNumber : '',
          line.account.code,
          line.description,
          Number(line.debit),
          Number(line.credit),
        ]);
        first = false;
      }
      ws.addRow([]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async createInvoicesExcel(companyId: string, from: string, to: string): Promise<Buffer> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: fromDate, lte: toDate },
      },
      include: { client: true, items: true, taxes: true },
      orderBy: { issueDate: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Facturas');
    ws.columns = [
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 28 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];
    ws.getCell('A1').value = `Facturas (POS y electrónicas) - Del ${from} al ${to}`;
    ws.getCell('A1').font = { bold: true };
    ws.addRow([]);
    ws.addRow(['Número', 'Fecha', 'Tipo', 'Cliente', 'Subtotal', 'IVA', 'Total', 'Estado']);
    ws.lastRow!.font = { bold: true };
    for (const inv of invoices) {
      ws.addRow([
        inv.fullNumber,
        inv.issueDate.toISOString().slice(0, 10),
        inv.type,
        inv.client.name,
        Number(inv.subtotal),
        Number(inv.taxAmount),
        Number(inv.total),
        inv.status,
      ]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async getExcelBuffer(
    companyId: string,
    type: ExportReportType,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<Buffer> {
    switch (type) {
      case ExportReportType.BALANCE:
        return this.createBalanceSheetExcel(companyId, from, to);
      case ExportReportType.INCOME_STATEMENT:
        return this.createIncomeStatementExcel(companyId, from, to);
      case ExportReportType.AUXILIARY_LEDGER:
        if (!accountCode && !accountId) throw new Error('accountCode o accountId requerido para libro auxiliar');
        return this.createAuxiliaryLedgerExcel(companyId, from, to, accountCode, accountId);
      case ExportReportType.JOURNAL_ENTRIES:
        return this.createJournalEntriesExcel(companyId, from, to);
      case ExportReportType.INVOICES:
        return this.createInvoicesExcel(companyId, from, to);
      default:
        throw new Error(`Tipo de exportación no soportado: ${type}`);
    }
  }

  getExcelStream(buffer: Buffer): Readable {
    return Readable.from(buffer);
  }
}
