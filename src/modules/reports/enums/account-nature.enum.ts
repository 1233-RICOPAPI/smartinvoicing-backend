/**
 * Naturaleza contable PUC Colombia.
 * Define si el saldo se calcula como débitos - créditos o créditos - débitos.
 */
export enum AccountNature {
  ACTIVO = 'Activo',
  PASIVO = 'Pasivo',
  PATRIMONIO = 'Patrimonio',
  INGRESO = 'Ingreso',
  GASTO = 'Gasto',
  COSTO = 'Costo',
}

/** Naturalezas de débito: saldo = débitos - créditos */
export const DEBIT_NATURE: AccountNature[] = [
  AccountNature.ACTIVO,
  AccountNature.GASTO,
  AccountNature.COSTO,
];

/** Naturalezas de crédito: saldo = créditos - débitos */
export const CREDIT_NATURE: AccountNature[] = [
  AccountNature.PASIVO,
  AccountNature.PATRIMONIO,
  AccountNature.INGRESO,
];

export function isDebitNature(type: string): boolean {
  return DEBIT_NATURE.includes(type as AccountNature);
}

export function getAccountBalance(
  totalDebit: number,
  totalCredit: number,
  nature: string,
): number {
  return isDebitNature(nature) ? totalDebit - totalCredit : totalCredit - totalDebit;
}
