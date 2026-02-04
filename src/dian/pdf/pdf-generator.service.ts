import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { QrService } from '../qr/qr.service';

export interface InvoicePdfData {
  documentNumber: string;
  issueDate: string;
  companyName: string;
  companyNit: string;
  clientName: string;
  clientNit: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  lines: Array<{ description: string; quantity: string; unitPrice: string; total: string }>;
  qrDataUrl?: string;
}

/**
 * Generación de PDF de factura electrónica (representación gráfica).
 * Incluye datos obligatorios y código QR para validación DIAN.
 */
@Injectable()
export class PdfGeneratorService {
  constructor(private readonly qr: QrService) {}

  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(16).text('FACTURA ELECTRÓNICA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Nº ${data.documentNumber}`, { align: 'center' });
    doc.text(`Fecha: ${data.issueDate}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text(`Emisor: ${data.companyName}`, { continued: false });
    doc.text(`NIT: ${data.companyNit}`);
    doc.moveDown();
    doc.text(`Cliente: ${data.clientName}`);
    doc.text(`NIT: ${data.clientNit}`);
    doc.moveDown();

    doc.fontSize(9).text('Detalle', { underline: true });
    doc.moveDown(0.5);
    for (const line of data.lines) {
      doc.text(
        `${line.description} | Cant: ${line.quantity} | V.Unit: ${line.unitPrice} | Total: ${line.total}`,
        { lineBreak: false },
      );
      doc.moveDown(0.3);
    }
    doc.moveDown();
    doc.text(`Subtotal: ${data.currency} ${data.subtotal}`);
    doc.text(`IVA: ${data.currency} ${data.taxAmount}`);
    doc.text(`TOTAL: ${data.currency} ${data.total}`, { font: 'Helvetica-Bold' });
    doc.moveDown(2);

    if (data.qrDataUrl) {
      try {
        const base64 = data.qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const img = Buffer.from(base64, 'base64');
        doc.image(img, 400, doc.y - 80, { width: 100, height: 100 });
      } catch {
        doc.fontSize(8).text('QR no disponible', 400, doc.y);
      }
    }

    doc.end();
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  /** Genera datos QR en base64 para incrustar en PDF. */
  async getQrDataUrl(qrData: string): Promise<string> {
    return this.qr.toBase64(qrData);
  }
}
