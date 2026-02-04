export const COPILOT_INTENTS = {
  BALANCE: 'BALANCE',
  INCOME_STATEMENT: 'INCOME_STATEMENT',
  INVOICES_SUMMARY: 'INVOICES_SUMMARY',
  TAX_SUMMARY: 'TAX_SUMMARY',
  /** IVA a pagar/declarar en el período (ej. "¿Cuánto debo pagar de IVA este mes?") */
  TAX_IVA_DUE: 'TAX_IVA_DUE',
  /** Retenciones de fuente e ICA por factura (ej. "Explícame retenciones factura SETP80000001") */
  TAX_RETENTIONS_BY_INVOICE: 'TAX_RETENTIONS_BY_INVOICE',
  /** Inconsistencias o posibles sanciones fiscales */
  TAX_INSISTENCIES_SANCTIONS: 'TAX_INSISTENCIES_SANCTIONS',
  COMPARISON: 'COMPARISON',
  ANOMALIES: 'ANOMALIES',
  EXPLAIN: 'EXPLAIN',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CopilotIntent = (typeof COPILOT_INTENTS)[keyof typeof COPILOT_INTENTS];
