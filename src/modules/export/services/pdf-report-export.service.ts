import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BalanceReportService, BalanceGeneralResult } from '../../reports/services/balance-report.service';
import { IncomeStatementService, IncomeStatementResult } from '../../reports/services/income-statement.service';
import { AuxiliaryLedgerService } from '../../reports/services/auxiliary-ledger.service';
import { ExportReportType } from '../dtos/export-query.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export interface CompanyHeader {
  name: string;
  nit: string;
}

@Injectable()
export class PdfReportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceReport: BalanceReportService,
    private readonly incomeStatement: IncomeStatementService,
    private readonly auxiliaryLedger: AuxiliaryLedgerService,
  ) {}

  async getCompanyHeader(companyId: string): Promise<CompanyHeader> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, nit: true, dv: true },
    });
    const nit = company.dv != null ? `${company.nit}-${company.dv}` : company.nit;
    return { name: company.name, nit };
  }

  async createBalancePdf(
    companyId: string,
    from: string,
    to: string,
  ): Promise<Buffer> {
    const header = await this.getCompanyHeader(companyId);
    const data = await this.balanceReport.generate(companyId, from, to);
    return this.buildReportPdf(header, `Balance General - Del ${from} al ${to}`, from, to, (doc) => {
      this.writeBalanceSections(doc, data);
    });
  }

  async createIncomeStatementPdf(
    companyId: string,
    from: string,
    to: string,
  ): Promise<Buffer> {
    const header = await this.getCompanyHeader(companyId);
    const data = await this.incomeStatement.generate(companyId, from, to);
    return this.buildReportPdf(header, `Estado de Resultados - Del ${from} al ${to}`, from, to, (doc) => {
      this.writeIncomeSections(doc, data);
    });
  }

  async createAuxiliaryLedgerPdf(
    companyId: string,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<Buffer> {
    const header = await this.getCompanyHeader(companyId);
    const data = await this.auxiliaryLedger.generate(companyId, { from, to, accountCode, accountId });
    return this.buildReportPdf(
      header,
      `Libro Auxiliar ${data.accountCode} - ${data.accountName}`,
      from,
      to,
      (doc) => {
        doc.fontSize(10);
        doc.text(`Saldo inicial: ${data.saldoInicial.toFixed(2)}`, { continued: false });
        doc.moveDown(0.5);
        doc.fontSize(9);
        doc.text('Fecha\tDocumento\tTercero\tDébito\tCrédito\tSaldo', { continued: false });
        doc.moveDown(0.3);
        doc.fontSize(8);
        for (const l of data.lines) {
          doc.text(
            `${l.date}\t${l.document}\t${l.thirdParty ?? ''}\t${l.debit}\t${l.credit}\t${l.saldoAcumulado}`,
            { continued: false },
          );
        }
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(`Saldo final: ${data.saldoFinal.toFixed(2)}`, { continued: false });
      },
    );
  }

  private buildReportPdf(
    header: CompanyHeader,
    title: string,
    from: string,
    to: string,
    writeBody: (doc: { fontSize: (n: number) => void; text: (s: string, o?: object) => void; moveDown: (n?: number) => void; page: { height: number; width: number } }) => void,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pageHeight = doc.page.height;
    const footerY = pageHeight - 40;

    doc.fontSize(10);
    doc.text(header.name, { align: 'center' });
    doc.text(`NIT: ${header.nit}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(title, { align: 'center' });
    doc.moveDown(1);

    writeBody(doc);

    doc.on('page', () => {
      doc.fontSize(8).text(
        `NIT ${header.nit} | Período: ${from} a ${to} | Generado: ${new Date().toISOString().slice(0, 10)}`,
        50,
        footerY,
        { align: 'center', width: doc.page.width - 100 },
      );
    });
    doc.fontSize(8).text(
      `NIT ${header.nit} | Período: ${from} a ${to} | Generado: ${new Date().toISOString().slice(0, 10)}`,
      50,
      footerY,
      { align: 'center', width: doc.page.width - 100 },
    );

    doc.end();
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  private writeBalanceSections(doc: { fontSize: (n: number) => void; text: (s: string, o?: object) => void; moveDown: (n?: number) => void }, data: BalanceGeneralResult): void {
    const writeGroup = (g: BalanceGeneralResult['activos']) => {
      doc.fontSize(10);
      doc.text(g.type, { continued: false });
      doc.fontSize(9);
      for (const a of g.accounts) {
        doc.text(`${a.code} ${a.name}  D: ${a.totalDebit.toFixed(2)}  C: ${a.totalCredit.toFixed(2)}  Saldo: ${a.saldo.toFixed(2)}`, { continued: false });
      }
      doc.text(`Total ${g.type}: ${g.saldo.toFixed(2)}`, { continued: false });
      doc.moveDown(0.5);
    };
    writeGroup(data.activos);
    writeGroup(data.pasivos);
    writeGroup(data.patrimonio);
  }

  private writeIncomeSections(doc: { fontSize: (n: number) => void; text: (s: string, o?: object) => void; moveDown: (n?: number) => void }, data: IncomeStatementResult): void {
    const writeSection = (title: string, lines: IncomeStatementResult['ingresos'], total: number) => {
      doc.fontSize(10);
      doc.text(title, { continued: false });
      doc.fontSize(9);
      for (const l of lines) {
        doc.text(`${l.code} ${l.name}  Saldo: ${l.saldo.toFixed(2)}`, { continued: false });
      }
      doc.text(`Total ${title}: ${total.toFixed(2)}`, { continued: false });
      doc.moveDown(0.5);
    };
    writeSection('Ingresos', data.ingresos, data.totalIngresos);
    writeSection('Costos', data.costos, data.totalCostos);
    writeSection('Gastos', data.gastos, data.totalGastos);
    doc.text(`Utilidad Neta: ${data.utilidadNeta.toFixed(2)}`, { continued: false });
  }

  async getPdfBuffer(
    companyId: string,
    type: ExportReportType,
    from: string,
    to: string,
    accountCode?: string,
    accountId?: string,
  ): Promise<Buffer> {
    switch (type) {
      case ExportReportType.BALANCE:
        return this.createBalancePdf(companyId, from, to);
      case ExportReportType.INCOME_STATEMENT:
        return this.createIncomeStatementPdf(companyId, from, to);
      case ExportReportType.AUXILIARY_LEDGER:
        if (!accountCode && !accountId) throw new Error('accountCode o accountId requerido');
        return this.createAuxiliaryLedgerPdf(companyId, from, to, accountCode, accountId);
      default:
        throw new Error(`Export PDF no implementado para tipo: ${type}. Use Balance, Income Statement o Auxiliary Ledger.`);
    }
  }
}
