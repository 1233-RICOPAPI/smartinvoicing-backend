import { Injectable } from '@nestjs/common';
import { COPILOT_INTENTS, CopilotIntent } from '../constants/intents';

/**
 * Convierte resultado del motor de consultas + intención en respuesta en lenguaje natural.
 */
@Injectable()
export class ReasoningService {
  formatAnswer(intent: CopilotIntent, data: Record<string, unknown>): string {
    switch (intent) {
      case COPILOT_INTENTS.BALANCE:
        return this.formatBalance(data);
      case COPILOT_INTENTS.INCOME_STATEMENT:
        return this.formatIncomeStatement(data);
      case COPILOT_INTENTS.INVOICES_SUMMARY:
        return this.formatInvoicesSummary(data);
      case COPILOT_INTENTS.TAX_SUMMARY:
        return this.formatTaxSummary(data);
      case COPILOT_INTENTS.TAX_IVA_DUE:
        return this.formatTaxIvaDue(data);
      case COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE:
        return this.formatRetentionsByInvoice(data);
      case COPILOT_INTENTS.TAX_INSISTENCIES_SANCTIONS:
        return this.formatTaxInconsistencies(data);
      case COPILOT_INTENTS.COMPARISON:
        return this.formatComparison(data);
      case COPILOT_INTENTS.ANOMALIES:
        return this.formatAnomalies(data);
      case COPILOT_INTENTS.EXPLAIN:
      case COPILOT_INTENTS.UNKNOWN:
      default: {
        const msg = (data.message as string)?.trim();
        if (msg) return msg;
        return 'No encontré contenido relacionado con tu pregunta en la base de datos. Puedes preguntar por: balance general, estado de resultados, facturación, IVA, retenciones, comparación o anomalías.';
      }
    }
  }

  private formatBalance(data: Record<string, unknown>): string {
    const valid = data.valid as boolean;
    const activos = data.activos as { saldo: number } | undefined;
    const pasivos = data.pasivos as { saldo: number } | undefined;
    const patrimonio = data.patrimonio as { saldo: number } | undefined;
    const a = activos?.saldo ?? 0;
    const p = (pasivos?.saldo ?? 0) + (patrimonio?.saldo ?? 0);
    let text = `Balance General (${data.from} a ${data.to}): Activos $${a.toLocaleString('es-CO', { minimumFractionDigits: 2 })}; Pasivos + Patrimonio $${p.toLocaleString('es-CO', { minimumFractionDigits: 2 })}. `;
    if (valid) text += 'El balance cuadra.';
    else text += (data.error as string) ?? 'Hay un descuadre. Revise los asientos.';
    return text;
  }

  private formatIncomeStatement(data: Record<string, unknown>): string {
    const utilidad = (data.utilidadNeta as number) ?? 0;
    const ingresos = (data.totalIngresos as number) ?? 0;
    const costos = (data.totalCostos as number) ?? 0;
    const gastos = (data.totalGastos as number) ?? 0;
    return `Estado de Resultados (${data.from} a ${data.to}): Ingresos $${ingresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}; Costos $${costos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}; Gastos $${gastos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}. Utilidad Neta: $${utilidad.toLocaleString('es-CO', { minimumFractionDigits: 2 })}.`;
  }

  private formatInvoicesSummary(data: Record<string, unknown>): string {
    const total = (data.totalInvoiced as number) ?? 0;
    const count = (data.invoiceCount as number) ?? 0;
    const tax = (data.totalTax as number) ?? 0;
    return `Facturación (${data.from} a ${data.to}): ${count} factura(s), total vendido $${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}, IVA $${tax.toLocaleString('es-CO', { minimumFractionDigits: 2 })}.`;
  }

  private formatTaxSummary(data: Record<string, unknown>): string {
    const iva = (data.totalIva as number) ?? 0;
    const ventas = (data.totalVentas as number) ?? 0;
    const count = (data.invoiceCount as number) ?? 0;
    return `Resumen tributario (${data.from} a ${data.to}): ${count} factura(s) aceptadas. Ventas totales $${ventas.toLocaleString('es-CO', { minimumFractionDigits: 2 })}, IVA generado $${iva.toLocaleString('es-CO', { minimumFractionDigits: 2 })}.`;
  }

  private formatTaxIvaDue(data: Record<string, unknown>): string {
    const ivaGenerado = (data.ivaGenerado as number) ?? 0;
    const ivaDescontable = (data.ivaDescontable as number) ?? 0;
    const ivaAPagar = (data.ivaAPagar as number) ?? 0;
    const count = (data.invoiceCount as number) ?? 0;
    let text = `IVA del período (${data.from} a ${data.to}): `;
    text += `IVA generado (ventas) $${ivaGenerado.toLocaleString('es-CO', { minimumFractionDigits: 2 })}; `;
    text += `IVA descontable (compras) $${ivaDescontable.toLocaleString('es-CO', { minimumFractionDigits: 2 })}. `;
    text += `A pagar/declarar: $${ivaAPagar.toLocaleString('es-CO', { minimumFractionDigits: 2 })} (${count} factura(s) aceptadas).`;
    return text;
  }

  private formatRetentionsByInvoice(data: Record<string, unknown>): string {
    const msg = data.message as string | undefined;
    if (msg) return msg;
    const fullNumber = (data.fullNumber as string) ?? '';
    const issueDate = (data.issueDate as string) ?? '';
    const retenciones = (data.retenciones as Array<{ taxType: string; rate: number; base: number; amount: number }>) ?? [];
    const total = (data.totalRetenciones as number) ?? 0;
    if (retenciones.length === 0) {
      return `Factura ${fullNumber} (${issueDate}): no se registraron retenciones (fuente, ICA o IVA) en esta factura.`;
    }
    let text = `Retenciones en factura ${fullNumber} (${issueDate}): `;
    text += retenciones.map((r) => `${r.taxType} ${r.rate}% sobre base $${r.base.toLocaleString('es-CO')} = $${r.amount.toLocaleString('es-CO')}`).join('; ');
    text += `. Total retenciones: $${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}.`;
    return text;
  }

  private formatTaxInconsistencies(data: Record<string, unknown>): string {
    const rejectedCount = (data.rejectedInvoicesCount as number) ?? 0;
    const taxRelatedCount = (data.taxRelatedCount as number) ?? 0;
    const anomaliesCount = (data.anomaliesCount as number) ?? 0;
    let text = `Revisión fiscal (${data.from} a ${data.to}): `;
    if (rejectedCount > 0) {
      text += `${rejectedCount} factura(s) rechazada(s) por la DIAN (riesgo de sanción si no se corrigen). `;
    }
    if (taxRelatedCount > 0) {
      text += `Se detectaron ${taxRelatedCount} anomalía(s) relacionadas con impuestos o cuadre. `;
    }
    if (anomaliesCount > 0 && taxRelatedCount === 0) {
      text += `Hay ${anomaliesCount} anomalía(s) en el período; revise el módulo de alertas. `;
    }
    if (rejectedCount === 0 && anomaliesCount === 0) {
      text += 'No se detectaron inconsistencias fiscales ni facturas rechazadas en el período.';
    }
    return text.trim();
  }

  private formatComparison(data: Record<string, unknown>): string {
    const current = data.currentPeriod as { utilidadNeta: number; totalIngresos: number } | undefined;
    const previous = data.previousPeriod as { utilidadNeta: number; totalIngresos: number } | undefined;
    const diffU = (data.diffUtilidad as number) ?? 0;
    const diffI = (data.diffIngresos as number) ?? 0;
    let text = 'Comparación con el mes anterior: ';
    text += `Utilidad actual $${(current?.utilidadNeta ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} (${diffU >= 0 ? '+' : ''}$${diffU.toLocaleString('es-CO', { minimumFractionDigits: 2 })}); `;
    text += `Ingresos actuales $${(current?.totalIngresos ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} (${diffI >= 0 ? '+' : ''}$${diffI.toLocaleString('es-CO', { minimumFractionDigits: 2 })}).`;
    return text;
  }

  private formatAnomalies(data: Record<string, unknown>): string {
    const count = (data.count as number) ?? 0;
    if (count === 0) return `No se detectaron anomalías en el período (${data.from} a ${data.to}).`;
    return `Se detectaron ${count} anomalía(s) en el período. Revisa el módulo de alertas para detalle.`;
  }
}
