import { Injectable } from '@nestjs/common';
import { COPILOT_INTENTS, CopilotIntent } from '../constants/intents';

export interface ParsedIntent {
  intent: CopilotIntent;
  from: string;
  to: string;
  comparison?: 'vs_previous_month' | 'vs_previous_quarter';
  /** Número de factura (ej. SETP80000001) o id para consultas por factura */
  invoiceRef?: string;
}

@Injectable()
export class IntentParserService {
  /** Normaliza la pregunta: mayúsculas/minúsculas y espacios para consistencia. */
  parse(query: string): ParsedIntent {
    const q = (query ?? '').toString().trim().toLowerCase();
    const { from, to } = this.resolveDateRange(q);
    const invoiceRef = this.extractInvoiceRef(query);
    const intent = this.detectIntent(q, invoiceRef);
    let comparison: 'vs_previous_month' | 'vs_previous_quarter' | undefined;
    const isComp = intent === COPILOT_INTENTS.COMPARISON;
    const hasCompare = q.includes('vs') || q.includes('versus') || q.includes('compar');
    if (isComp && hasCompare) {
      comparison = (q.includes('trimestre') || q.includes('quarter')) ? 'vs_previous_quarter' : 'vs_previous_month';
    }
    return { intent, from, to, comparison, invoiceRef };
  }

  /** Extrae número de factura (ej. SETP80000001) o referencia del texto */
  private extractInvoiceRef(query: string): string | undefined {
    const upper = query.trim();
    const match = upper.match(/\b([A-Z]{2,5}\s*\d{6,10})\b/i) ?? upper.match(/\bfactura\s+([A-Z0-9\-]+)\b/i);
    if (match) return match[1].replace(/\s/g, '');
    const uuidMatch = query.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    if (uuidMatch) return uuidMatch[0];
    return undefined;
  }

  private detectIntent(q: string, invoiceRef?: string): CopilotIntent {
    if (!q) return COPILOT_INTENTS.UNKNOWN;
    if (/balance|activo|pasivo|patrimonio|cuadre|balance general/.test(q)) return COPILOT_INTENTS.BALANCE;
    if (/resultado|pérdida|pérdidas|ganancia|utilidad|ingreso|gastos?|costos?|estado de resultado|p&g|pyg/.test(q)) return COPILOT_INTENTS.INCOME_STATEMENT;
    if (invoiceRef && /retencion|rete|retention|explic.*factura|factura.*retencion/.test(q)) return COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE;
    if (/factur|ventas?|facturacion|facturación|facturado|venta/.test(q) && !invoiceRef) return COPILOT_INTENTS.INVOICES_SUMMARY;
    if (/cuánto debo pagar de iva|cuanto debo pagar de iva|iva a pagar|iva a declarar|debo pagar.*iva|cuanto iva debo/.test(q)) return COPILOT_INTENTS.TAX_IVA_DUE;
    if (/inconsistencia.*fiscal|fiscal.*inconsistencia|sanción fiscal|sancion fiscal|posible sanción|posible sancion|detecta.*inconsistencias fiscales|sanciones fiscales/.test(q)) return COPILOT_INTENTS.TAX_INSISTENCIES_SANCTIONS;
    if (/iva|impuesto|retencion|rete|tribut|declaración|declaracion/.test(q)) return COPILOT_INTENTS.TAX_SUMMARY;
    if (/compar|vs|versus|anterior|pasado|este mes vs|último vs|comparar/.test(q)) return COPILOT_INTENTS.COMPARISON;
    if (/anomalía|anomalia|inconsistencia|alerta|riesgo|fraude|error contable/.test(q)) return COPILOT_INTENTS.ANOMALIES;
    if (/qué es|que es|explic|significa|como funciona|cómo funciona/.test(q)) return COPILOT_INTENTS.EXPLAIN;
    if (/cómo va|como va|resumen|empresa|este mes|último mes|trimestre|como van/.test(q)) {
      if (/iva|impuesto/.test(q)) return COPILOT_INTENTS.TAX_SUMMARY;
      if (/factur|venta/.test(q)) return COPILOT_INTENTS.INVOICES_SUMMARY;
      return COPILOT_INTENTS.INVOICES_SUMMARY;
    }
    return COPILOT_INTENTS.UNKNOWN;
  }

  private resolveDateRange(q: string): { from: string; to: string } {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (/este mes|mes actual|current month/.test(q)) {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      return { from, to };
    }
    if (/último mes|mes pasado|last month|anterior mes/.test(q)) {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const to = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
      return { from, to };
    }
    if (/último trimestre|trimestre pasado|last quarter|trimestre/.test(q)) {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      const startMonth = (quarter - 2 <= 0 ? quarter + 2 : quarter - 2) * 3 - 2;
      const startYear = startMonth <= 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = startMonth <= 0 ? startMonth + 12 : startMonth;
      const from = `${startYear}-${pad(m)}-01`;
      const endMonth = m + 2;
      const endYear = endMonth > 12 ? startYear + 1 : startYear;
      const endM = endMonth > 12 ? endMonth - 12 : endMonth;
      const lastDay = new Date(endYear, endM, 0);
      const to = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
      return { from, to };
    }
    if (/año|year|anual/.test(q)) {
      const from = `${now.getFullYear()}-01-01`;
      const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      return { from, to };
    }
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return { from, to };
  }
}
