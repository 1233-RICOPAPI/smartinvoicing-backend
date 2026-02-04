import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountingDocumentType } from '../enums/document-type.enum';

/**
 * DTO para generar un asiento contable a partir de un documento.
 * El motor calcula las líneas según tipo de documento y valida partida doble.
 */
export class GenerateEntryDto {
  @IsEnum(AccountingDocumentType)
  documentType: AccountingDocumentType;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsDateString()
  date: string;

  /** Base gravada (sin impuestos) */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;

  /** IVA u otro impuesto principal */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount: number;

  /** Valor total del documento */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total: number;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  /** true si es nota crédito: se invierte el asiento original */
  @IsOptional()
  isCreditNote?: boolean;

  /** true si es nota débito: asiento de ajuste al cliente */
  @IsOptional()
  isDebitNote?: boolean;

  /** Retenciones (opcional, para extensión futura) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  retentionSource?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  retentionIca?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  retentionIva?: number;

  /** Costo de venta (POS): genera Débito Costo de venta, Crédito Inventario */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costOfGoodsSold?: number;
}
