/**
 * Línea contable (partida doble): una cuenta con débito o crédito.
 */
export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}
