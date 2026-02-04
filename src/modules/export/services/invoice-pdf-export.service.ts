import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PdfGeneratorService } from '../../../dian/pdf/pdf-generator.service';
import { Readable } from 'stream';

/**
 * Genera PDF de factura (representación gráfica DIAN) en memoria para descarga.
 * Incluye encabezado empresarial y pie con NIT, período y fecha de generación.
 */
@Injectable()
export class InvoicePdfExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  async getInvoicePdfStream(companyId: string, invoiceId: string): Promise<{ stream: Readable; filename: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { company: true, client: true, items: { orderBy: { order: 'asc' } }, dianDoc: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    let qrDataUrl: string | undefined;
    if (invoice.dianDoc?.qrData) {
      qrDataUrl = await this.pdfGenerator.getQrDataUrl(invoice.dianDoc.qrData);
    }

    const pdfData = {
      documentNumber: invoice.fullNumber,
      issueDate: new Date(invoice.issueDate).toISOString().slice(0, 10),
      companyName: invoice.company.name,
      companyNit: invoice.company.nit + (invoice.company.dv != null ? `-${invoice.company.dv}` : ''),
      clientName: invoice.client.name,
      clientNit: invoice.client.nit + (invoice.client.dv != null ? `-${invoice.client.dv}` : ''),
      subtotal: String(invoice.subtotal),
      taxAmount: String(invoice.taxAmount),
      total: String(invoice.total),
      currency: invoice.currency,
      lines: invoice.items.map((i) => ({
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        total: String(i.total),
      })),
      qrDataUrl,
    };
    const buffer = await this.pdfGenerator.generateInvoicePdf(pdfData);
    const filename = `factura_${invoice.fullNumber}.pdf`;
    return { stream: Readable.from(buffer), filename };
  }
}
