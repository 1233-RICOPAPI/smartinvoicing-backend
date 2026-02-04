import { JournalLine } from './journal-line.entity';
import { AccountingDocumentType } from '../enums/document-type.enum';

/**
 * Asiento contable (cabecera + líneas).
 * Representa un evento de facturación/compra con partida doble balanceada.
 */
export interface JournalEntry {
  id?: string;
  companyId: string;
  documentType: AccountingDocumentType;
  documentNumber: string;
  documentId?: string;
  date: Date;
  totalDebit: number;
  totalCredit: number;
  description?: string;
  lines: JournalLine[];
}
