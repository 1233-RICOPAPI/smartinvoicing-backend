import {
  IsString,
  IsNotEmpty,
  Matches,
  Length,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para generación de CUFE según Anexo Técnico DIAN.
 * Orden de concatenación: 1 Número factura, 2 Fecha, 3 Hora, 4 Valor sin impuestos,
 * 5 Código impuesto, 6 Valor impuesto, 7 Valor total, 8 NIT emisor, 9 NIT adquiriente, 10 Clave técnica.
 */
export class GenerateCufeDto {
  /** 1. Número de factura (ej. SETP80000001) - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  invoiceNumber: string;

  /** 2. Fecha de expedición YYYY-MM-DD - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'issueDate debe ser YYYY-MM-DD',
  })
  issueDate: string;

  /** 3. Hora de expedición HH:mm:ss-05:00 (zona Colombia) - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}:\d{2}-05:00$/, {
    message: 'issueTime debe ser HH:mm:ss-05:00',
  })
  issueTime: string;

  /** 4. Valor total antes de impuestos - Obligatorio DIAN */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxExclusiveAmount: number;

  /** 5. Código del impuesto principal (01 = IVA) - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  mainTaxCode: string;

  /** 6. Valor del impuesto - Obligatorio DIAN */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount: number;

  /** 7. Valor total de la factura - Obligatorio DIAN */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount: number;

  /** 8. NIT del emisor - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Length(1, 15)
  issuerNit: string;

  /** 9. NIT del adquiriente - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Length(1, 15)
  customerNit: string;

  /** 10. Clave técnica asignada por la DIAN al software - Obligatorio DIAN */
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  technicalKey: string;
}
