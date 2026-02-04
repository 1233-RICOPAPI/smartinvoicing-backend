import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * CUFE - Código Único de Factura Electrónica (DIAN).
 * Generado según Anexo Técnico: cadena concatenada → SHA-384 → hex (96 caracteres).
 * La cadena incluye: NIT emisor, fecha/hora, número documento, tipo doc, NIT receptor, etc.
 */
@Injectable()
export class CufeService {
  private readonly DOC_TYPE_CODES: Record<string, string> = {
    FACTURA_VENTA: '01',
    FACTURA_POS: '04',
    NOTA_CREDITO: '91',
    NOTA_DEBITO: '92',
  };

  /**
   * Genera el CUFE según especificación DIAN (Anexo Técnico 1.9).
   * Cadena: NIT_Emisor + FechaHora + DocId + CódigoTipoDoc + NIT_Receptor + ValorTotal + ...
   */
  generate(params: {
    nitEmisor: string;
    nitReceptor: string;
    issueDate: Date;
    documentNumber: string;
    documentType: string;
    totalAmount: string;
    currencyCode?: string;
  }): string {
    const docCode = this.DOC_TYPE_CODES[params.documentType] ?? '01';
    const dateStr = this.formatDianDateTime(params.issueDate);
    const nitE = params.nitEmisor.replace(/\D/g, '').padStart(10, '0');
    const nitR = params.nitReceptor.replace(/\D/g, '').padStart(10, '0');
    const total = params.totalAmount.replace(/[^\d]/g, '').padStart(18, '0');
    const currency = (params.currencyCode ?? 'COP').padEnd(3, ' ');

    const cadena = [
      nitE,
      dateStr,
      params.documentNumber,
      docCode,
      nitR,
      total,
      currency,
    ].join('');

    const hash = createHash('sha384').update(cadena, 'utf8').digest('hex');
    return hash.toUpperCase();
  }

  /** Fecha/hora DIAN: yyyy-MM-ddTHH:mm:ss-05:00 */
  private formatDianDateTime(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${year}-${month}-${day}T${h}:${m}:${s}-05:00`;
  }
}
