import { Injectable, BadRequestException } from '@nestjs/common';
import {
  buildAndComputeCufe,
  buildCufeConcatenation,
  CufeConcatenationInput,
} from '../utils/cufe.builder';
import { GenerateCufeDto } from '../dto/generate-cufe.dto';

/**
 * Servicio de generación de CUFE (Código Único de Factura Electrónica)
 * conforme al Anexo Técnico DIAN. Solo crypto nativo Node.js (SHA-384).
 */
@Injectable()
export class CufeService {
  /**
   * Genera el CUFE a partir de los insumos obligatorios DIAN.
   * Orden de concatenación (sin separadores): número factura, fecha, hora,
   * valor sin impuestos, código impuesto, valor impuesto, valor total,
   * NIT emisor, NIT adquiriente, clave técnica.
   * Algoritmo: SHA-384, salida hexadecimal en mayúsculas.
   *
   * @param input - GenerateCufeDto con los 10 campos obligatorios
   * @returns CUFE en hexadecimal (96 caracteres)
   */
  generateCUFE(input: GenerateCufeDto): string {
    return this.generateCufeExtended({
      ...input,
      technicalKey: input.technicalKey,
    });
  }

  /**
   * CUFE extendido para Factura POS/venta: incluye Software ID, tipo documento, ambiente.
   * Tipo doc: 01=Factura venta, 04=Factura POS, 91=NC, 92=ND. Ambiente: 1=Producción, 2=Pruebas.
   */
  generateCufeExtended(params: {
    invoiceNumber: string;
    issueDate: string;
    issueTime: string;
    taxExclusiveAmount: number | string;
    mainTaxCode: string;
    taxAmount: number | string;
    totalAmount: number | string;
    issuerNit: string;
    customerNit: string;
    technicalKey: string;
    softwareId?: string;
    documentTypeCode?: string;
    environmentCode?: string;
  }): string {
    this.validateTechnicalKey(params.technicalKey);
    const payload: CufeConcatenationInput = {
      invoiceNumber: params.invoiceNumber.trim(),
      issueDate: params.issueDate,
      issueTime: params.issueTime,
      taxExclusiveAmount: String(params.taxExclusiveAmount),
      mainTaxCode: params.mainTaxCode.trim(),
      taxAmount: String(params.taxAmount),
      totalAmount: String(params.totalAmount),
      issuerNit: params.issuerNit.trim(),
      customerNit: params.customerNit.trim(),
      technicalKey: params.technicalKey.trim(),
      softwareId: params.softwareId?.trim(),
      documentTypeCode: params.documentTypeCode?.trim(),
      environmentCode: params.environmentCode?.trim(),
    };
    return buildAndComputeCufe(payload);
  }

  /**
   * Expone la cadena concatenada (para auditoría/pruebas). No usar en producción para enviar.
   */
  buildConcatenationOnly(input: GenerateCufeDto): string {
    const payload: CufeConcatenationInput = {
      invoiceNumber: input.invoiceNumber.trim(),
      issueDate: input.issueDate,
      issueTime: input.issueTime,
      taxExclusiveAmount: String(input.taxExclusiveAmount),
      mainTaxCode: input.mainTaxCode.trim(),
      taxAmount: String(input.taxAmount),
      totalAmount: String(input.totalAmount),
      issuerNit: input.issuerNit.trim(),
      customerNit: input.customerNit.trim(),
      technicalKey: input.technicalKey.trim(),
    };
    return buildCufeConcatenation(payload);
  }

  private validateTechnicalKey(key: string): void {
    if (!key || key.length < 4) {
      throw new BadRequestException(
        'La clave técnica DIAN es obligatoria y debe tener al menos 4 caracteres',
      );
    }
  }

  /**
   * Ejemplo de uso con datos simulados válidos (formato DIAN).
   * Uso: this.cufeService.exampleGenerateCUFE()
   */
  exampleGenerateCUFE(): { cufe: string; concatenationLength: number } {
    const example: GenerateCufeDto = {
      invoiceNumber: 'SETP80000001',
      issueDate: '2025-02-03',
      issueTime: '14:30:00-05:00',
      taxExclusiveAmount: 1000000,
      mainTaxCode: '01',
      taxAmount: 190000,
      totalAmount: 1190000,
      issuerNit: '900123456',
      customerNit: '901234567',
      technicalKey: 'CLAVE_TECNICA_EJEMPLO_12345',
    };
    const concatenation = this.buildConcatenationOnly(example);
    const cufe = this.generateCUFE(example);
    return { cufe, concatenationLength: concatenation.length };
  }
}
