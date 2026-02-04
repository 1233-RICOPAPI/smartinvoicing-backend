import { createHash } from 'crypto';

/**
 * Cadena para CUFE según Anexo Técnico DIAN.
 * Orden obligatorio, sin separadores entre campos.
 */
export interface CufeConcatenationInput {
  /** 1. Número de factura (ej. SETP80000001) - Obligatorio DIAN */
  invoiceNumber: string;
  /** 2. Fecha de expedición YYYY-MM-DD - Obligatorio DIAN */
  issueDate: string;
  /** 3. Hora de expedición HH:mm:ss-05:00 (zona horaria Colombia) - Obligatorio DIAN */
  issueTime: string;
  /** 4. Valor total antes de impuestos - Obligatorio DIAN */
  taxExclusiveAmount: string;
  /** 5. Código del impuesto principal (01 = IVA) - Obligatorio DIAN */
  mainTaxCode: string;
  /** 6. Valor del impuesto - Obligatorio DIAN */
  taxAmount: string;
  /** 7. Valor total de la factura - Obligatorio DIAN */
  totalAmount: string;
  /** 8. NIT del emisor (solo dígitos, 10 posiciones) - Obligatorio DIAN */
  issuerNit: string;
  /** 9. NIT del adquiriente (solo dígitos, 10 posiciones) - Obligatorio DIAN */
  customerNit: string;
  /** 10. Clave técnica asignada por la DIAN al software - Obligatorio DIAN */
  technicalKey: string;
  /** 11. Software ID (opcional, extensión DIAN) */
  softwareId?: string;
  /** 12. Código tipo documento: 01=Factura venta, 04=Factura POS, 91=NC, 92=ND */
  documentTypeCode?: string;
  /** 13. Ambiente: 1=Producción, 2=Pruebas */
  environmentCode?: string;
}

/**
 * Concatena los campos en el orden exigido por la DIAN (sin separadores)
 * y devuelve la cadena lista para hashear.
 */
export function buildCufeConcatenation(input: CufeConcatenationInput): string {
  const issuerNit = input.issuerNit.replace(/\D/g, '').padStart(10, '0');
  const customerNit = input.customerNit.replace(/\D/g, '').padStart(10, '0');
  const taxExclusive = formatAmountForCufe(input.taxExclusiveAmount);
  const taxAmount = formatAmountForCufe(input.taxAmount);
  const total = formatAmountForCufe(input.totalAmount);

  let cadena =
    input.invoiceNumber +
    input.issueDate +
    input.issueTime +
    taxExclusive +
    input.mainTaxCode +
    taxAmount +
    total +
    issuerNit +
    customerNit +
    input.technicalKey;
  if (input.softwareId) cadena += input.softwareId;
  if (input.documentTypeCode) cadena += input.documentTypeCode;
  if (input.environmentCode) cadena += input.environmentCode;
  return cadena;
}

/**
 * Formato de valores monetarios para CUFE: solo dígitos, 2 decimales implícitos.
 * Sin punto, coma ni espacios (DIAN: sin separadores en la cadena).
 * Ej: 1000000.50 → "100000050"
 */
function formatAmountForCufe(value: string | number): string {
  const str = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  const normalized = str.replace(/,/g, '').replace(/\s/g, '');
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return '000';
  const int = match[1].replace(/^0+/, '') || '0';
  const dec = (match[2] ?? '00').padEnd(2, '0').slice(0, 2);
  return int + dec;
}

/**
 * Genera el CUFE: SHA-384 sobre la cadena concatenada, salida en hexadecimal.
 * Anexo Técnico DIAN exige SHA-384 y presentación en hex.
 */
export function computeCufeFromConcatenation(concatenated: string): string {
  const hash = createHash('sha384').update(concatenated, 'utf8').digest('hex');
  return hash.toUpperCase();
}

/**
 * Genera CUFE en un solo paso (concatena + hashea).
 */
export function buildAndComputeCufe(input: CufeConcatenationInput): string {
  const concatenated = buildCufeConcatenation(input);
  return computeCufeFromConcatenation(concatenated);
}
