import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AccountingDocumentType } from '../enums/document-type.enum';
import { JournalEntry, JournalLine } from '../domain';
import { GenerateEntryDto } from '../dtos/generate-entry.dto';
import { ACCOUNT_KEYS, AccountKey } from '../constants/account-keys';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Motor de asientos contables automáticos.
 * Genera partida doble según tipo de documento (venta, POS, NC, ND, compra).
 * Cuentas resueltas por mapeo por empresa (PUC flexible).
 */
@Injectable()
export class AccountingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el asiento contable (dominio) a partir del DTO.
   * Valida que débitos = créditos antes de devolver.
   */
  async generateJournalEntry(companyId: string, dto: GenerateEntryDto): Promise<JournalEntry> {
    const requiredKeys = this.getRequiredAccountKeys(dto);
    const mapping = await this.getAccountMapping(companyId, requiredKeys);
    const date = new Date(dto.date);
    const lines: JournalLine[] = [];

    if (dto.isCreditNote) {
      return this.buildCreditNoteEntry(companyId, dto, mapping, date, lines);
    }

    switch (dto.documentType) {
      case AccountingDocumentType.FACTURA_VENTA:
        this.buildFacturaVentaLines(dto, mapping, lines);
        break;
      case AccountingDocumentType.FACTURA_POS:
        this.buildFacturaPosLines(dto, mapping, lines);
        break;
      case AccountingDocumentType.NOTA_DEBITO:
        this.buildNotaDebitoLines(dto, mapping, lines);
        break;
      case AccountingDocumentType.COMPRA:
        this.buildCompraLines(dto, mapping, lines);
        break;
      case AccountingDocumentType.NOTA_CREDITO:
        return this.buildCreditNoteEntry(companyId, dto, mapping, date, lines);
      default:
        throw new BadRequestException(`Tipo de documento no soportado: ${dto.documentType}`);
    }

    return this.toJournalEntry(companyId, dto, date, lines);
  }

  private getRequiredAccountKeys(dto: GenerateEntryDto): AccountKey[] {
    const hasRetentions =
      (dto.retentionSource ?? 0) > 0 ||
      (dto.retentionIca ?? 0) > 0 ||
      (dto.retentionIva ?? 0) > 0;
    const baseKeys: AccountKey[] = [];
    if (dto.isCreditNote) {
      baseKeys.push(
        ACCOUNT_KEYS.CLIENTES_NACIONALES,
        ACCOUNT_KEYS.INGRESOS_VENTAS,
        ACCOUNT_KEYS.IVA_GENERADO,
      );
    } else {
      switch (dto.documentType) {
        case AccountingDocumentType.FACTURA_VENTA:
        case AccountingDocumentType.NOTA_DEBITO:
        case AccountingDocumentType.NOTA_CREDITO:
          baseKeys.push(
            ACCOUNT_KEYS.CLIENTES_NACIONALES,
            ACCOUNT_KEYS.INGRESOS_VENTAS,
            ACCOUNT_KEYS.IVA_GENERADO,
          );
          break;
      case AccountingDocumentType.FACTURA_POS: {
        baseKeys.push(ACCOUNT_KEYS.CAJA, ACCOUNT_KEYS.INGRESOS_VENTAS, ACCOUNT_KEYS.IVA_GENERADO);
        if ((dto.costOfGoodsSold ?? 0) > 0) {
          baseKeys.push(ACCOUNT_KEYS.COSTOS_MERCANCIAS, ACCOUNT_KEYS.INVENTARIO);
        }
        break;
      }
        case AccountingDocumentType.COMPRA:
          baseKeys.push(
            ACCOUNT_KEYS.COSTOS_MERCANCIAS,
            ACCOUNT_KEYS.IVA_DESCONTABLE,
            ACCOUNT_KEYS.PROVEEDORES,
          );
          break;
        default:
          break;
      }
    }
    if (hasRetentions) {
      if ((dto.retentionSource ?? 0) > 0) baseKeys.push(ACCOUNT_KEYS.RETENCION_FUENTE);
      if ((dto.retentionIca ?? 0) > 0) baseKeys.push(ACCOUNT_KEYS.RETENCION_ICA);
      if ((dto.retentionIva ?? 0) > 0) baseKeys.push(ACCOUNT_KEYS.RETENCION_IVA);
    }
    return baseKeys;
  }

  private async getAccountMapping(
    companyId: string,
    requiredKeys: AccountKey[],
  ): Promise<Record<string, { id: string; code: string; name: string }>> {
    const mappings = await this.prisma.companyAccountMapping.findMany({
      where: { companyId, accountKey: { in: requiredKeys } },
      include: { account: true },
    });
    const record: Record<string, { id: string; code: string; name: string }> = {};
    for (const key of requiredKeys) {
      const m = mappings.find((x) => x.accountKey === key);
      if (!m) {
        throw new BadRequestException(
          `Falta mapeo de cuenta para "${key}". Configure el plan de cuentas de la empresa.`,
        );
      }
      record[key] = { id: m.accountId, code: m.account.code, name: m.account.name };
    }
    return record;
  }

  /** Factura de venta con IVA: Débito Clientes (total), Crédito Ingresos (base neta de retenciones), Crédito IVA generado, Crédito Retenciones si aplican. Partida doble: total = ingresos + iva + retenciones. */
  private buildFacturaVentaLines(
    dto: GenerateEntryDto,
    mapping: Record<string, { id: string; code: string; name: string }>,
    lines: JournalLine[],
  ): void {
    const clientes = mapping[ACCOUNT_KEYS.CLIENTES_NACIONALES];
    const ingresos = mapping[ACCOUNT_KEYS.INGRESOS_VENTAS];
    const ivaGen = mapping[ACCOUNT_KEYS.IVA_GENERADO];
    const retFuente = dto.retentionSource ?? 0;
    const retIca = dto.retentionIca ?? 0;
    const retIva = dto.retentionIva ?? 0;
    const totalRet = retFuente + retIca + retIva;
    const creditIngresos = dto.subtotal - totalRet;

    lines.push({
      accountId: clientes.id,
      accountCode: clientes.code,
      accountName: clientes.name,
      debit: dto.total,
      credit: 0,
      description: `Factura venta ${dto.documentNumber}`,
    });
    lines.push({
      accountId: ingresos.id,
      accountCode: ingresos.code,
      accountName: ingresos.name,
      debit: 0,
      credit: Math.max(0, creditIngresos),
      description: `Ingresos ${dto.documentNumber}`,
    });
    if (dto.taxAmount > 0) {
      lines.push({
        accountId: ivaGen.id,
        accountCode: ivaGen.code,
        accountName: ivaGen.name,
        debit: 0,
        credit: dto.taxAmount,
        description: `IVA generado ${dto.documentNumber}`,
      });
    }
    if (retFuente > 0 && mapping[ACCOUNT_KEYS.RETENCION_FUENTE]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].name,
        debit: 0,
        credit: retFuente,
        description: `Retención en la fuente ${dto.documentNumber}`,
      });
    }
    if (retIca > 0 && mapping[ACCOUNT_KEYS.RETENCION_ICA]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_ICA].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_ICA].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_ICA].name,
        debit: 0,
        credit: retIca,
        description: `Retención ICA ${dto.documentNumber}`,
      });
    }
    if (retIva > 0 && mapping[ACCOUNT_KEYS.RETENCION_IVA]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_IVA].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_IVA].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_IVA].name,
        debit: 0,
        credit: retIva,
        description: `Retención IVA ${dto.documentNumber}`,
      });
    }
  }

  /** Factura POS: Débito Caja, Crédito Ingresos (base neta de retenciones), Crédito IVA generado, Crédito Retenciones si aplican. */
  private buildFacturaPosLines(
    dto: GenerateEntryDto,
    mapping: Record<string, { id: string; code: string; name: string }>,
    lines: JournalLine[],
  ): void {
    const caja = mapping[ACCOUNT_KEYS.CAJA];
    const ingresos = mapping[ACCOUNT_KEYS.INGRESOS_VENTAS];
    const ivaGen = mapping[ACCOUNT_KEYS.IVA_GENERADO];
    const retFuente = dto.retentionSource ?? 0;
    const retIca = dto.retentionIca ?? 0;
    const retIva = dto.retentionIva ?? 0;
    const totalRet = retFuente + retIca + retIva;
    const creditIngresos = dto.subtotal - totalRet;

    lines.push({
      accountId: caja.id,
      accountCode: caja.code,
      accountName: caja.name,
      debit: dto.total,
      credit: 0,
      description: `POS ${dto.documentNumber}`,
    });
    lines.push({
      accountId: ingresos.id,
      accountCode: ingresos.code,
      accountName: ingresos.name,
      debit: 0,
      credit: Math.max(0, creditIngresos),
      description: `Ingresos POS ${dto.documentNumber}`,
    });
    if (dto.taxAmount > 0) {
      lines.push({
        accountId: ivaGen.id,
        accountCode: ivaGen.code,
        accountName: ivaGen.name,
        debit: 0,
        credit: dto.taxAmount,
        description: `IVA generado POS ${dto.documentNumber}`,
      });
    }
    if (retFuente > 0 && mapping[ACCOUNT_KEYS.RETENCION_FUENTE]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_FUENTE].name,
        debit: 0,
        credit: retFuente,
        description: `Retención en la fuente POS ${dto.documentNumber}`,
      });
    }
    if (retIca > 0 && mapping[ACCOUNT_KEYS.RETENCION_ICA]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_ICA].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_ICA].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_ICA].name,
        debit: 0,
        credit: retIca,
        description: `Retención ICA POS ${dto.documentNumber}`,
      });
    }
    if (retIva > 0 && mapping[ACCOUNT_KEYS.RETENCION_IVA]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.RETENCION_IVA].id,
        accountCode: mapping[ACCOUNT_KEYS.RETENCION_IVA].code,
        accountName: mapping[ACCOUNT_KEYS.RETENCION_IVA].name,
        debit: 0,
        credit: retIva,
        description: `Retención IVA POS ${dto.documentNumber}`,
      });
    }
    const cogs = dto.costOfGoodsSold ?? 0;
    if (cogs > 0 && mapping[ACCOUNT_KEYS.COSTOS_MERCANCIAS] && mapping[ACCOUNT_KEYS.INVENTARIO]) {
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.COSTOS_MERCANCIAS].id,
        accountCode: mapping[ACCOUNT_KEYS.COSTOS_MERCANCIAS].code,
        accountName: mapping[ACCOUNT_KEYS.COSTOS_MERCANCIAS].name,
        debit: cogs,
        credit: 0,
        description: `Costo de venta POS ${dto.documentNumber}`,
      });
      lines.push({
        accountId: mapping[ACCOUNT_KEYS.INVENTARIO].id,
        accountCode: mapping[ACCOUNT_KEYS.INVENTARIO].code,
        accountName: mapping[ACCOUNT_KEYS.INVENTARIO].name,
        debit: 0,
        credit: cogs,
        description: `Salida inventario POS ${dto.documentNumber}`,
      });
    }
  }

  /** Nota débito: aumenta deuda del cliente. Débito Clientes, Crédito Ingresos/IVA según detalle (simplificado: Débito Clientes, Crédito Ingresos + IVA) */
  private buildNotaDebitoLines(
    dto: GenerateEntryDto,
    mapping: Record<string, { id: string; code: string; name: string }>,
    lines: JournalLine[],
  ): void {
    const clientes = mapping[ACCOUNT_KEYS.CLIENTES_NACIONALES];
    const ingresos = mapping[ACCOUNT_KEYS.INGRESOS_VENTAS];
    const ivaGen = mapping[ACCOUNT_KEYS.IVA_GENERADO];

    lines.push({
      accountId: clientes.id,
      accountCode: clientes.code,
      accountName: clientes.name,
      debit: dto.total,
      credit: 0,
      description: `Nota débito ${dto.documentNumber}`,
    });
    lines.push({
      accountId: ingresos.id,
      accountCode: ingresos.code,
      accountName: ingresos.name,
      debit: 0,
      credit: dto.subtotal,
      description: `Ajuste ingreso ND ${dto.documentNumber}`,
    });
    if (dto.taxAmount > 0) {
      lines.push({
        accountId: ivaGen.id,
        accountCode: ivaGen.code,
        accountName: ivaGen.name,
        debit: 0,
        credit: dto.taxAmount,
        description: `IVA ND ${dto.documentNumber}`,
      });
    }
  }

  /** Compras: Débito Costos/Gastos, Débito IVA descontable, Crédito Proveedores */
  private buildCompraLines(
    dto: GenerateEntryDto,
    mapping: Record<string, { id: string; code: string; name: string }>,
    lines: JournalLine[],
  ): void {
    const costos = mapping[ACCOUNT_KEYS.COSTOS_MERCANCIAS];
    const ivaDesc = mapping[ACCOUNT_KEYS.IVA_DESCONTABLE];
    const proveedores = mapping[ACCOUNT_KEYS.PROVEEDORES];

    lines.push({
      accountId: costos.id,
      accountCode: costos.code,
      accountName: costos.name,
      debit: dto.subtotal,
      credit: 0,
      description: `Compra ${dto.documentNumber}`,
    });
    if (dto.taxAmount > 0) {
      lines.push({
        accountId: ivaDesc.id,
        accountCode: ivaDesc.code,
        accountName: ivaDesc.name,
        debit: dto.taxAmount,
        credit: 0,
        description: `IVA descontable ${dto.documentNumber}`,
      });
    }
    lines.push({
      accountId: proveedores.id,
      accountCode: proveedores.code,
      accountName: proveedores.name,
      debit: 0,
      credit: dto.total,
      description: `Proveedor ${dto.documentNumber}`,
    });
  }

  /** Nota crédito: inversión exacta del asiento original (D↔C) */
  private buildCreditNoteEntry(
    companyId: string,
    dto: GenerateEntryDto,
    mapping: Record<string, { id: string; code: string; name: string }>,
    date: Date,
    lines: JournalLine[],
  ): Promise<JournalEntry> {
    this.buildFacturaVentaLines(
      { ...dto, subtotal: dto.subtotal, taxAmount: dto.taxAmount, total: dto.total },
      mapping,
      lines,
    );
    for (const line of lines) {
      const d = line.debit;
      const c = line.credit;
      line.debit = c;
      line.credit = d;
      line.description = `NC ${dto.documentNumber} - ${line.description}`;
    }
    return Promise.resolve(this.toJournalEntry(companyId, dto, date, lines));
  }

  private toJournalEntry(
    companyId: string,
    dto: GenerateEntryDto,
    date: Date,
    lines: JournalLine[],
  ): JournalEntry {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.02) {
      throw new BadRequestException(
        `Asiento desbalanceado: Débitos=${totalDebit.toFixed(2)} Créditos=${totalCredit.toFixed(2)}. La partida doble exige que sean iguales. Verifique base, impuestos y retenciones.`,
      );
    }

    return {
      companyId,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      documentId: dto.documentId,
      date,
      totalDebit,
      totalCredit,
      description: `${dto.documentType} ${dto.documentNumber}`,
      lines,
    };
  }

  /**
   * Persiste el asiento en BD (AccountingJournalEntry + AccountingEntry por línea).
   * Si se pasa tx (cliente de transacción Prisma), las escrituras forman parte de esa transacción.
   */
  async persistJournalEntry(
    entry: JournalEntry,
    tx?: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
  ): Promise<{ journalEntryId: string }> {
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.02) {
      throw new BadRequestException('No se puede persistir un asiento desbalanceado.');
    }

    const prisma = tx ?? this.prisma;

    const journal = await prisma.accountingJournalEntry.create({
      data: {
        companyId: entry.companyId,
        documentType: entry.documentType,
        documentNumber: entry.documentNumber,
        documentId: entry.documentId,
        date: entry.date,
        totalDebit: new Decimal(totalDebit),
        totalCredit: new Decimal(totalCredit),
        description: entry.description ?? null,
      },
    });

    await prisma.accountingEntry.createMany({
      data: entry.lines.map((line) => ({
        companyId: entry.companyId,
        journalEntryId: journal.id,
        accountId: line.accountId,
        invoiceId: entry.documentId ?? null,
        date: entry.date,
        description: line.description,
        debit: new Decimal(line.debit),
        credit: new Decimal(line.credit),
        reference: entry.documentNumber,
      })),
    });

    return { journalEntryId: journal.id };
  }
}
