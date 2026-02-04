import { create } from 'xmlbuilder2';

const UBL_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2';
const CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const EXT_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';

/** Referencia a la factura que se está anulando o ajustando (obligatorio DIAN para NC). */
export interface BillingReferencePayload {
  /** Número de la factura original (ej. SETP80000001). */
  id: string;
  /** Fecha expedición factura original YYYY-MM-DD. */
  issueDate: string;
  /** CUFE de la factura original. */
  cufe: string;
}

export interface UblCreditNotePayload {
  /** Número completo de la nota crédito (prefijo + número). */
  id: string;
  issueDate: Date;
  issueTime: string;
  currencyCode: string;
  cufe: string;
  /** Referencia a la factura que se corrige/anula. */
  billingReference: BillingReferencePayload;
  /** Motivo o descripción (DiscrepancyResponse). */
  discrepancyResponse?: string;
  supplier: {
    nit: string;
    dv?: number;
    name: string;
    address?: string;
    city?: string;
    countryCode: string;
    registrationName?: string;
  };
  customer: {
    nit: string;
    dv?: number;
    name: string;
    address?: string;
    city?: string;
    countryCode: string;
    registrationName?: string;
  };
  lines: Array<{
    id: number;
    quantity: number;
    unitCode: string;
    description: string;
    priceAmount: number;
    baseQuantity?: number;
    lineExtension: number;
    taxAmount: number;
    taxRate: number;
    total: number;
  }>;
  taxTotals: Array<{
    taxSchemeId: string;
    taxSchemeName: string;
    taxableAmount: number;
    taxAmount: number;
    percent: number;
  }>;
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  allowanceTotalAmount?: number;
  chargeTotalAmount?: number;
  payableAmount: number;
}

/**
 * Construye XML UBL 2.1 CreditNote conforme al Anexo Técnico DIAN.
 * Tipo documento 91. Incluye BillingReference a la factura original.
 */
export function buildUblCreditNoteXml(payload: UblCreditNotePayload): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('CreditNote', {
      xmlns: UBL_NS,
      'xmlns:cac': CAC_NS,
      'xmlns:cbc': CBC_NS,
      'xmlns:ext': EXT_NS,
    })
    .ele('ext:UBLExtensions')
    .ele('ext:UBLExtension')
    .ele('ext:ExtensionContent')
    .up()
    .up()
    .up();

  const root = doc.root();
  root
    .ele('cbc:CustomizationID', { schemeAgencyID: '195', schemeName: 'Colombia' })
    .txt('10')
    .up();
  root.ele('cbc:ProfileID').txt('DIAN 2.1').up();
  root.ele('cbc:ID').txt(payload.id).up();
  root.ele('cbc:IssueDate').txt(formatDate(payload.issueDate)).up();
  root.ele('cbc:IssueTime').txt(payload.issueTime).up();
  root
    .ele('cbc:DocumentCurrencyCode', {
      listAgencyName: 'United Nations Economic Commission for Europe',
      listName: 'ISO 4217 Alpha',
    })
    .txt(payload.currencyCode)
    .up();
  root.ele('cbc:UUID', { schemeName: 'CUFE', schemeAgencyName: 'CO, DIAN' }).txt(payload.cufe).up();

  // BillingReference (factura que se referencia)
  const billingRef = root.ele('cac:BillingReference');
  const invDocRef = billingRef.ele('cac:InvoiceDocumentReference');
  invDocRef.ele('cbc:ID').txt(payload.billingReference.id).up();
  invDocRef.ele('cbc:IssueDate').txt(payload.billingReference.issueDate).up();
  invDocRef
    .ele('cbc:UUID', { schemeName: 'CUFE', schemeAgencyName: 'CO, DIAN' })
    .txt(payload.billingReference.cufe)
    .up();
  invDocRef.up();
  billingRef.up();

  if (payload.discrepancyResponse) {
    const disc = root.ele('cac:DiscrepancyResponse');
    disc.ele('cbc:Description').txt(payload.discrepancyResponse).up();
    disc.up();
  }

  // AccountingSupplierParty
  const supplier = root.ele('cac:AccountingSupplierParty');
  supplier
    .ele('cbc:AdditionalAccountID')
    .txt(payload.supplier.nit + (payload.supplier.dv != null ? String(payload.supplier.dv) : ''))
    .up();
  const supplierParty = supplier.ele('cac:Party');
  supplierParty
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: '31', schemeName: 'NIT' })
    .txt(payload.supplier.nit)
    .up()
    .up();
  supplierParty
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(payload.supplier.registrationName ?? payload.supplier.name)
    .up()
    .up();
  if (payload.supplier.address) {
    const addr = supplierParty.ele('cac:PhysicalLocation').ele('cac:Address');
    addr.ele('cbc:AddressLine').txt(payload.supplier.address).up();
    if (payload.supplier.city) addr.ele('cbc:CityName').txt(payload.supplier.city).up();
    addr
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', {
        listAgencyName: 'United Nations Economic Commission for Europe',
        listName: 'Country',
      })
      .txt(payload.supplier.countryCode ?? 'CO')
      .up()
      .up();
    addr.up().up();
  }
  supplier.up();

  // AccountingCustomerParty
  const customer = root.ele('cac:AccountingCustomerParty');
  customer
    .ele('cbc:AdditionalAccountID')
    .txt(payload.customer.nit + (payload.customer.dv != null ? String(payload.customer.dv) : ''))
    .up();
  const customerParty = customer.ele('cac:Party');
  customerParty
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: '31', schemeName: 'NIT' })
    .txt(payload.customer.nit)
    .up()
    .up();
  customerParty
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(payload.customer.registrationName ?? payload.customer.name)
    .up()
    .up();
  if (payload.customer.address) {
    const addr = customerParty.ele('cac:PhysicalLocation').ele('cac:Address');
    addr.ele('cbc:AddressLine').txt(payload.customer.address).up();
    if (payload.customer.city) addr.ele('cbc:CityName').txt(payload.customer.city).up();
    addr
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', {
        listAgencyName: 'United Nations Economic Commission for Europe',
        listName: 'Country',
      })
      .txt(payload.customer.countryCode ?? 'CO')
      .up()
      .up();
    addr.up().up();
  }
  customer.up();

  // CreditNoteLine
  payload.lines.forEach((line) => {
    const cnLine = root.ele('cac:CreditNoteLine');
    cnLine.ele('cbc:ID').txt(String(line.id)).up();
    cnLine
      .ele('cbc:CreditedQuantity', { unitCode: line.unitCode })
      .txt(String(line.quantity))
      .up();
    cnLine
      .ele('cbc:LineExtensionAmount', { currencyID: payload.currencyCode })
      .txt(round2(line.lineExtension))
      .up();
    cnLine.ele('cac:Item').ele('cbc:Description').txt(line.description).up().up();
    cnLine
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: payload.currencyCode })
      .txt(round2(line.priceAmount))
      .up()
      .ele('cbc:BaseQuantity', { unitCode: line.unitCode })
      .txt(String(line.baseQuantity ?? line.quantity))
      .up()
      .up();
    if (line.taxAmount > 0) {
      const tax = cnLine.ele('cac:TaxTotal');
      tax.ele('cbc:TaxAmount', { currencyID: payload.currencyCode }).txt(round2(line.taxAmount)).up();
      tax
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: payload.currencyCode })
        .txt(round2(line.lineExtension))
        .up()
        .ele('cbc:TaxAmount', { currencyID: payload.currencyCode })
        .txt(round2(line.taxAmount))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt(String(line.taxRate))
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('01')
        .up()
        .ele('cbc:Name')
        .txt('IVA')
        .up()
        .up()
        .up()
        .up()
        .up()
        .up();
    }
    cnLine.up();
  });

  // TaxTotals
  payload.taxTotals.forEach((t) => {
    const taxTotal = root.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: payload.currencyCode }).txt(round2(t.taxAmount)).up();
    taxTotal
      .ele('cac:TaxSubtotal')
      .ele('cbc:TaxableAmount', { currencyID: payload.currencyCode })
      .txt(round2(t.taxableAmount))
      .up()
      .ele('cbc:TaxAmount', { currencyID: payload.currencyCode })
      .txt(round2(t.taxAmount))
      .up()
      .ele('cac:TaxCategory')
      .ele('cbc:Percent')
      .txt(String(t.percent))
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt(t.taxSchemeId)
      .up()
      .ele('cbc:Name')
      .txt(t.taxSchemeName)
      .up()
      .up()
      .up()
      .up()
      .up()
      .up();
  });

  // LegalMonetaryTotal
  const monetary = root.ele('cac:LegalMonetaryTotal');
  monetary
    .ele('cbc:LineExtensionAmount', { currencyID: payload.currencyCode })
    .txt(round2(payload.lineExtensionAmount))
    .up();
  monetary
    .ele('cbc:TaxExclusiveAmount', { currencyID: payload.currencyCode })
    .txt(round2(payload.taxExclusiveAmount))
    .up();
  monetary
    .ele('cbc:TaxInclusiveAmount', { currencyID: payload.currencyCode })
    .txt(round2(payload.taxInclusiveAmount))
    .up();
  if (payload.allowanceTotalAmount != null && payload.allowanceTotalAmount > 0) {
    monetary
      .ele('cbc:AllowanceTotalAmount', { currencyID: payload.currencyCode })
      .txt(round2(payload.allowanceTotalAmount))
      .up();
  }
  monetary.ele('cbc:PayableAmount', { currencyID: payload.currencyCode }).txt(round2(payload.payableAmount)).up();
  monetary.up();

  return doc.end({ prettyPrint: true });
}

function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function round2(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
