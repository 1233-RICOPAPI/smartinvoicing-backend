import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountingSnapshotDocument = AccountingSnapshot & Document;

/** Saldo por cuenta para accountsSummary */
export interface AccountSummaryItem {
  accountId: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  saldo: number;
}

/** Sección del Balance General (Activo, Pasivo, Patrimonio) */
export interface BalanceSheetSection {
  type: string;
  accounts: AccountSummaryItem[];
  totalDebit: number;
  totalCredit: number;
  saldo: number;
}

/** Balance General completo al cierre del mes */
export interface BalanceSheetSnapshot {
  activos: BalanceSheetSection;
  pasivos: BalanceSheetSection;
  patrimonio: BalanceSheetSection;
  valid: boolean;
  error?: string;
}

/** Línea del Estado de Resultados */
export interface IncomeStatementLine {
  code: string;
  name: string;
  saldo: number;
}

/** Estado de Resultados (P&G) al cierre del mes */
export interface IncomeStatementSnapshot {
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

@Schema({ collection: 'accounting_snapshots', timestamps: true })
export class AccountingSnapshot {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  year: number;

  @Prop({ required: true, index: true })
  month: number;

  @Prop({ required: true, enum: ['OPEN', 'CLOSED'], default: 'OPEN' })
  status: 'OPEN' | 'CLOSED';

  @Prop({ required: true, default: () => new Date() })
  generatedAt: Date;

  @Prop()
  closedAt?: Date;

  @Prop({ type: Object, required: true })
  balanceSheet: BalanceSheetSnapshot;

  @Prop({ type: Object, required: true })
  incomeStatement: IncomeStatementSnapshot;

  @Prop({ type: [Object], required: true })
  accountsSummary: AccountSummaryItem[];

  @Prop()
  periodStart: Date;

  @Prop()
  periodEnd: Date;
}

export const AccountingSnapshotSchema = SchemaFactory.createForClass(AccountingSnapshot);

AccountingSnapshotSchema.index({ companyId: 1, year: 1, month: 1 }, { unique: true });
