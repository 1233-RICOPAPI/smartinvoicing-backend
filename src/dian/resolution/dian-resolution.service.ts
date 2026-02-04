import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DianDocumentType } from '@prisma/client';

export interface NextAuthorizedNumberResult {
  prefix: string;
  number: number;
  fullNumber: string;
}

/**
 * Numeración autorizada por Resolución DIAN.
 * Valida que prefix + número estén dentro de una resolución activa y vigente.
 */
@Injectable()
export class DianResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la resolución activa vigente para el tipo de documento.
   */
  async getActiveResolution(
    companyId: string,
    documentType: 'FACTURA_VENTA' | 'FACTURA_POS' | 'NOTA_CREDITO' | 'NOTA_DEBITO',
  ) {
    const now = new Date();
    return this.prisma.dianResolution.findFirst({
      where: {
        companyId,
        documentType,
        active: true,
        fromDate: { lte: now },
        toDate: { gte: now },
      },
      orderBy: { toDate: 'desc' },
    });
  }

  /**
   * Devuelve el próximo número autorizado para facturación.
   * Si hay resolución activa: usa su prefijo y rango; si no, usa DianConfig.
   */
  async getNextAuthorizedNumber(
    companyId: string,
    documentType: DianDocumentType,
  ): Promise<NextAuthorizedNumberResult> {
    const resolution = await this.getActiveResolution(companyId, documentType);
    const config = await this.prisma.dianConfig.findUnique({ where: { companyId } });

    const prefix = resolution?.prefix ?? (documentType === 'FACTURA_POS' ? config?.prefixPos ?? 'FCP' : config?.prefixFe ?? 'SETP');
    const fromNumber = resolution?.fromNumber ?? config?.fromNumber ?? 1;
    const toNumber = resolution?.toNumber ?? 99999999;

    const last = await this.prisma.invoice.findFirst({
      where: { companyId, type: documentType, prefix },
      orderBy: { number: 'desc' },
    });
    const nextNumber = last ? last.number + 1 : fromNumber;

    if (nextNumber > toNumber) {
      throw new BadRequestException(
        `Numeración agotada para ${documentType} (prefijo ${prefix}). Rango autorizado hasta ${toNumber}. Gestione una nueva resolución DIAN.`,
      );
    }

    const fullNumber = `${prefix}${String(nextNumber).padStart(8, '0')}`;
    return { prefix, number: nextNumber, fullNumber };
  }

  /**
   * Valida que (prefix, number) esté dentro de una resolución activa.
   */
  async validateNumber(
    companyId: string,
    documentType: string,
    prefix: string,
    number: number,
  ): Promise<boolean> {
    const resolution = await this.getActiveResolution(companyId, documentType as any);
    if (!resolution) return true; // Sin resolución cargada, no bloquear
    if (resolution.prefix !== prefix) return false;
    return number >= resolution.fromNumber && number <= resolution.toNumber;
  }
}
