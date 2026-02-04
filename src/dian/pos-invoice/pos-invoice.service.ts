import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DianService } from '../dian.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import * as fs from 'fs';
import * as path from 'path';

export interface EmitPosElectronicInvoiceResult {
  success: boolean;
  invoiceId: string;
  cufe?: string;
  statusDian?: string;
  pdfUrl?: string;
  message?: string;
}

/**
 * Orquesta el flujo completo de Factura POS Electrónica:
 * 1. Generar factura electrónica (CUFE, XML UBL 2.1, firma)
 * 2. Persistir DianDocument
 * 3. Enviar a DIAN
 * 4. Almacenar respuesta y eventos
 * 5. Generar PDF con QR (URL validación) y guardar
 * 6. Asociación contable ya realizada en PosSaleService
 */
@Injectable()
export class PosInvoiceService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dian: DianService,
    private readonly pdf: PdfGeneratorService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
  }

  /**
   * Emite la factura electrónica POS completa: construir, firmar, enviar DIAN, PDF.
   * La factura debe existir (creada por POS) y no estar ya aceptada/rechazada.
   */
  async emitElectronicInvoice(companyId: string, invoiceId: string): Promise<EmitPosElectronicInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { company: true, client: true, items: { include: { product: true }, orderBy: { order: 'asc' } }, dianDoc: true },
    });
    if (!invoice) throw new BadRequestException('Factura no encontrada');
    if (invoice.type !== 'FACTURA_POS') throw new BadRequestException('Solo aplica a facturas POS');
    if (invoice.status === 'ACEPTADA') {
      return { success: true, invoiceId, statusDian: 'ACEPTADO', pdfUrl: invoice.dianDoc?.pdfUrl ?? undefined };
    }
    if (invoice.status === 'RECHAZADA') {
      return { success: false, invoiceId, statusDian: 'RECHAZADO', message: 'Factura ya rechazada por la DIAN' };
    }

    const fullNumber = invoice.fullNumber;

    const built = await this.dian.buildAndSignInvoice(companyId, invoiceId);
    await this.dian.persistDianDocument(companyId, invoiceId, built);

    const sendResult = await this.dian.sendToDian(companyId, invoiceId);

    let pdfUrl: string | undefined;
    if (sendResult.success && sendResult.statusDian === 'ACEPTADO') {
      const qrDataUrl = await this.pdf.getQrDataUrl(built.qrData);
      const pdfData = {
        documentNumber: fullNumber,
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
      const pdfBuffer = await this.pdf.generateInvoicePdf(pdfData);
      pdfUrl = await this.savePdf(companyId, invoiceId, pdfBuffer);
      await this.prisma.dianDocument.update({
        where: { invoiceId },
        data: { pdfUrl },
      });
    }

    return {
      success: sendResult.success,
      invoiceId,
      cufe: built.cufe,
      statusDian: sendResult.statusDian,
      pdfUrl,
      message: sendResult.message,
    };
  }

  private async savePdf(companyId: string, invoiceId: string, buffer: Buffer): Promise<string> {
    const dir = path.join(this.uploadsDir, companyId);
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `${invoiceId}.pdf`;
    const filePath = path.join(dir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return `/uploads/invoices/${companyId}/${filename}`;
  }
}
