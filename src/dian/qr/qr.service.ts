import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/**
 * Código QR para factura electrónica DIAN.
 * Contiene: NIT emisor, NIT receptor, CUFE, fecha, valor total (y opcional URL verificación).
 */
@Injectable()
export class QrService {
  /**
   * URL de validación DIAN para el QR (Anexo Técnico).
   * Ambiente habilitación: https://catalogo-vpfe.dian.gov.co/document/search
   * Producción: mismo host según documentación vigente.
   */
  buildValidationUrl(params: {
    nitEmisor: string;
    documentTypeCode: string; // 01 Factura venta, 04 POS
    number: string;           // Número factura (prefijo + número)
    cufe: string;
    environment?: 'habilitacion' | 'produccion';
  }): string {
    const base =
      params.environment === 'produccion'
        ? 'https://catalogo-vpfe.dian.gov.co/document/search'
        : 'https://catalogo-vpfe.dian.gov.co/document/search';
    const q = new URLSearchParams({
      re: params.nitEmisor.replace(/\D/g, ''),
      td: params.documentTypeCode,
      fe: params.number,
      fq: params.cufe,
    });
    return `${base}?${q.toString()}`;
  }

  /**
   * Genera la cadena de datos para el QR según DIAN (separador pipe).
   * Si se pasa validationUrl, se puede usar como contenido del QR para que el escaneo abra la validación.
   */
  buildQrData(params: {
    nitEmisor: string;
    nitReceptor: string;
    cufe: string;
    issueDate: Date;
    totalAmount: string;
    totalTax?: string;
    totalIva?: string;
    validationUrl?: string;
  }): string {
    if (params.validationUrl) return params.validationUrl;
    const dateStr = this.formatDate(params.issueDate);
    const parts = [
      params.nitEmisor,
      params.nitReceptor,
      params.cufe,
      dateStr,
      params.totalAmount,
      params.totalTax ?? params.totalAmount,
      params.totalIva ?? '0',
    ];
    return parts.join('|');
  }

  /**
   * Genera imagen PNG del QR en base64.
   */
  async toBase64(data: string): Promise<string> {
    return QRCode.toDataURL(data, { type: 'image/png', margin: 2 });
  }

  /**
   * Genera buffer PNG del QR (para incrustar en PDF).
   */
  async toBuffer(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, { type: 'png', margin: 2 });
  }

  private formatDate(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
