import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CufeService } from '../modules/invoicing/services/cufe.service';
import { QrService } from './qr/qr.service';
import { buildUblInvoiceXml, UblInvoicePayload } from './xml-builder/ubl-invoice.builder';
import { buildUblCreditNoteXml, UblCreditNotePayload } from './xml-builder/ubl-credit-note.builder';
import { buildUblDebitNoteXml, UblDebitNotePayload } from './xml-builder/ubl-debit-note.builder';
import { SignerService } from './signer/signer.service';
import { DianApiService } from './api/dian-api.service';
import { DianResponseHandler } from './handlers/dian-response.handler';
import { DianAuditService, DIAN_AUDIT_ACTIONS } from '../modules/audit/services/dian-audit.service';
import { DianDocumentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface DianAuditContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface BuildAndSignResult {
  xml: string;
  cufe: string;
  qrData: string;
}

/**
 * Orquesta construcción XML UBL 2.1, CUFE, QR y firma digital.
 * Opcionalmente envía a DIAN (token, API) según configuración empresa.
 */
@Injectable()
export class DianService {
  constructor(
    private prisma: PrismaService,
    private cufe: CufeService,
    private qr: QrService,
    private signer: SignerService,
    private dianApi: DianApiService,
    private responseHandler: DianResponseHandler,
    private dianAudit: DianAuditService,
  ) {}

  /**
   * Construye XML UBL 2.1, genera CUFE, datos QR y firma el XML.
   * Soporta Factura venta, Factura POS, Nota Crédito (91) y Nota Débito (92).
   */
  async buildAndSignInvoice(companyId: string, invoiceId: string): Promise<BuildAndSignResult> {
    const invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId },
      include: {
        company: true,
        client: true,
        items: { include: { product: true }, orderBy: { order: 'asc' } },
        taxes: true,
      },
    });

    const docNumber = `${invoice.prefix}${String(invoice.number).padStart(8, '0')}`;
    const issueDate = new Date(invoice.issueDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const issueDateStr = `${issueDate.getFullYear()}-${pad(issueDate.getMonth() + 1)}-${pad(issueDate.getDate())}`;
    const issueTimeStr = `${pad(issueDate.getHours())}:${pad(issueDate.getMinutes())}:${pad(issueDate.getSeconds())}-05:00`;

    const dianConfig = await this.prisma.dianConfig.findUnique({
      where: { companyId },
    });
    const technicalKey = dianConfig?.technicalKey ?? '';
    if (!technicalKey) {
      throw new BadRequestException(
        'Configure la clave técnica DIAN en DianConfig para generar el CUFE',
      );
    }

    const nitEmisor = invoice.company.nit.replace(/\D/g, '') + (invoice.company.dv != null ? String(invoice.company.dv) : '');
    const nitReceptor = invoice.client.nit.replace(/\D/g, '') + (invoice.client.dv != null ? String(invoice.client.dv) : '');
    const totalStr = new Decimal(invoice.total).toFixed(2);

    const documentTypeCode =
      invoice.type === 'FACTURA_POS'
        ? '04'
        : invoice.type === 'NOTA_CREDITO'
          ? '91'
          : invoice.type === 'NOTA_DEBITO'
            ? '92'
            : '01';
    const environmentCode = dianConfig?.env === 'produccion' ? '1' : '2';
    const cufe = this.cufe.generateCufeExtended({
      invoiceNumber: docNumber,
      issueDate: issueDateStr,
      issueTime: issueTimeStr,
      taxExclusiveAmount: Number(invoice.subtotal),
      mainTaxCode: '01',
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.total),
      issuerNit: invoice.company.nit + (invoice.company.dv != null ? String(invoice.company.dv) : ''),
      customerNit: invoice.client.nit + (invoice.client.dv != null ? String(invoice.client.dv) : ''),
      technicalKey,
      softwareId: dianConfig?.softwareId ?? undefined,
      documentTypeCode,
      environmentCode,
    });

    const lines = invoice.items.map((item, i) => {
      const lineExt = Number(item.subtotal);
      const taxAmt = Number(item.taxAmount);
      const total = Number(item.total);
      return {
        id: i + 1,
        quantity: Number(item.quantity),
        unitCode: item.unit,
        description: item.description,
        priceAmount: Number(item.unitPrice),
        baseQuantity: Number(item.quantity),
        lineExtension: lineExt,
        taxAmount: taxAmt,
        taxRate: Number(item.ivaRate),
        total,
      };
    });

    const taxTotals = invoice.taxes.map((t) => ({
      taxSchemeId: '01',
      taxSchemeName: 'IVA',
      taxableAmount: Number(t.base),
      taxAmount: Number(t.amount),
      percent: Number(t.rate),
    }));
    const taxTotalsDefault =
      taxTotals.length > 0 ? taxTotals : [{ taxSchemeId: '01', taxSchemeName: 'IVA', taxableAmount: 0, taxAmount: 0, percent: 0 }];

    let xml: string;

    if (invoice.type === 'NOTA_CREDITO') {
      const ref = await this.prisma.invoiceReference.findFirst({
        where: { invoiceId },
      });
      if (!ref?.referencedCufe) {
        throw new BadRequestException('Nota Crédito debe tener referencia a factura original con CUFE (InvoiceReference).');
      }
      const refIssueDate = new Date(ref.issueDate);
      const refIssueDateStr = `${refIssueDate.getFullYear()}-${pad(refIssueDate.getMonth() + 1)}-${pad(refIssueDate.getDate())}`;
      const cnPayload: UblCreditNotePayload = {
        id: docNumber,
        issueDate,
        issueTime: issueTimeStr,
        currencyCode: invoice.currency,
        cufe,
        billingReference: { id: ref.number, issueDate: refIssueDateStr, cufe: ref.referencedCufe },
        discrepancyResponse: invoice.notes ?? undefined,
        supplier: {
          nit: invoice.company.nit,
          dv: invoice.company.dv ?? undefined,
          name: invoice.company.name,
          address: invoice.company.address ?? undefined,
          city: invoice.company.city ?? undefined,
          countryCode: invoice.company.country ?? 'CO',
          registrationName: invoice.company.name,
        },
        customer: {
          nit: invoice.client.nit,
          dv: invoice.client.dv ?? undefined,
          name: invoice.client.name,
          address: invoice.client.address ?? undefined,
          city: invoice.client.city ?? undefined,
          countryCode: invoice.client.country ?? 'CO',
          registrationName: invoice.client.name,
        },
        lines,
        taxTotals: taxTotalsDefault,
        lineExtensionAmount: Number(invoice.subtotal),
        taxExclusiveAmount: Number(invoice.subtotal),
        taxInclusiveAmount: Number(invoice.total),
        allowanceTotalAmount: Number(invoice.discount) || undefined,
        payableAmount: Number(invoice.total),
      };
      xml = buildUblCreditNoteXml(cnPayload);
    } else if (invoice.type === 'NOTA_DEBITO') {
      const ref = await this.prisma.invoiceReference.findFirst({
        where: { invoiceId },
      });
      if (!ref?.referencedCufe) {
        throw new BadRequestException('Nota Débito debe tener referencia a factura original con CUFE (InvoiceReference).');
      }
      const refIssueDate = new Date(ref.issueDate);
      const refIssueDateStr = `${refIssueDate.getFullYear()}-${pad(refIssueDate.getMonth() + 1)}-${pad(refIssueDate.getDate())}`;
      const dnPayload: UblDebitNotePayload = {
        id: docNumber,
        issueDate,
        issueTime: issueTimeStr,
        currencyCode: invoice.currency,
        cufe,
        billingReference: { id: ref.number, issueDate: refIssueDateStr, cufe: ref.referencedCufe },
        discrepancyResponse: invoice.notes ?? undefined,
        supplier: {
          nit: invoice.company.nit,
          dv: invoice.company.dv ?? undefined,
          name: invoice.company.name,
          address: invoice.company.address ?? undefined,
          city: invoice.company.city ?? undefined,
          countryCode: invoice.company.country ?? 'CO',
          registrationName: invoice.company.name,
        },
        customer: {
          nit: invoice.client.nit,
          dv: invoice.client.dv ?? undefined,
          name: invoice.client.name,
          address: invoice.client.address ?? undefined,
          city: invoice.client.city ?? undefined,
          countryCode: invoice.client.country ?? 'CO',
          registrationName: invoice.client.name,
        },
        lines,
        taxTotals: taxTotalsDefault,
        lineExtensionAmount: Number(invoice.subtotal),
        taxExclusiveAmount: Number(invoice.subtotal),
        taxInclusiveAmount: Number(invoice.total),
        allowanceTotalAmount: Number(invoice.discount) || undefined,
        payableAmount: Number(invoice.total),
      };
      xml = buildUblDebitNoteXml(dnPayload);
    } else {
      const payload: UblInvoicePayload = {
        documentType: invoice.type as DianDocumentType,
        id: docNumber,
        issueDate,
        issueTime: issueTimeStr,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
        currencyCode: invoice.currency,
        cufe,
        supplier: {
          nit: invoice.company.nit,
          dv: invoice.company.dv ?? undefined,
          name: invoice.company.name,
          address: invoice.company.address ?? undefined,
          city: invoice.company.city ?? undefined,
          countryCode: invoice.company.country ?? 'CO',
          registrationName: invoice.company.name,
        },
        customer: {
          nit: invoice.client.nit,
          dv: invoice.client.dv ?? undefined,
          name: invoice.client.name,
          address: invoice.client.address ?? undefined,
          city: invoice.client.city ?? undefined,
          countryCode: invoice.client.country ?? 'CO',
          registrationName: invoice.client.name,
        },
        lines,
        taxTotals: taxTotalsDefault,
        lineExtensionAmount: Number(invoice.subtotal),
        taxExclusiveAmount: Number(invoice.subtotal),
        taxInclusiveAmount: Number(invoice.total),
        allowanceTotalAmount: Number(invoice.discount) || undefined,
        payableAmount: Number(invoice.total),
      };
      xml = buildUblInvoiceXml(payload);
    }

    if (dianConfig?.certEnc) {
      const certBuffer = Buffer.from(dianConfig.certEnc, 'base64');
      const certPassword = dianConfig.certPasswordEnc || '';
      xml = this.signer.signXml(xml, certBuffer, certPassword);
    }

    const validationUrl = this.qr.buildValidationUrl({
      nitEmisor: invoice.company.nit.replace(/\D/g, '') + (invoice.company.dv != null ? String(invoice.company.dv) : ''),
      documentTypeCode,
      number: docNumber,
      cufe,
      environment: dianConfig?.env === 'produccion' ? 'produccion' : 'habilitacion',
    });
    const qrData = this.qr.buildQrData({
      nitEmisor: nitEmisor,
      nitReceptor: nitReceptor,
      cufe,
      issueDate,
      totalAmount: totalStr,
      totalTax: totalStr,
      totalIva: String(Number(invoice.taxAmount)),
      validationUrl,
    });

    return { xml, cufe, qrData };
  }

  /**
   * Persiste XML, CUFE y QR en DianDocument y actualiza estado de la factura.
   */
  async persistDianDocument(
    companyId: string,
    invoiceId: string,
    data: BuildAndSignResult,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.dianDocument.upsert({
        where: { invoiceId },
        create: {
          companyId,
          invoiceId,
          documentType: (await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).type,
          cufe: data.cufe,
          xmlSent: data.xml,
          qrData: data.qrData,
        },
        update: {
          cufe: data.cufe,
          xmlSent: data.xml,
          qrData: data.qrData,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'FIRMADA' },
      }),
    ]);
  }

  /**
   * Envío a DIAN: token, envío XML, registro en DianEvent y actualización de estado.
   * Registra la acción en auditoría DIAN (audit_logs).
   */
  async sendToDian(
    companyId: string,
    invoiceId: string,
    auditContext?: DianAuditContext,
  ): Promise<{ success: boolean; message?: string; statusDian?: string }> {
    const doc = await this.prisma.dianDocument.findFirst({
      where: { invoiceId, companyId },
    });
    if (!doc?.xmlSent) {
      return { success: false, message: 'No hay XML firmado para enviar' };
    }

    await this.prisma.dianEvent.create({
      data: {
        companyId,
        invoiceId,
        eventType: 'ENVIO',
        payload: JSON.stringify({ dianDocumentId: doc.id, sentAt: new Date().toISOString() }),
      },
    });

    const result = await this.dianApi.sendDocument(companyId, doc.xmlSent);
    const { statusDian } = await this.responseHandler.handle(
      companyId,
      invoiceId,
      doc.id,
      result,
      doc.xmlSent,
    );

    await this.dianAudit.logDianAction({
      companyId,
      userId: auditContext?.userId,
      action: DIAN_AUDIT_ACTIONS.DIAN_ENVIO,
      entity: 'Invoice',
      entityId: invoiceId,
      payload: { success: result.success, statusDian, message: result.message },
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent,
    });

    return {
      success: result.success && statusDian === 'ACEPTADO',
      message: result.message,
      statusDian,
    };
  }
}
