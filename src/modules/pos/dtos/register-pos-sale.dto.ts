import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class PosSaleItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;
}

export class PosSalePaymentDto {
  @IsString()
  method: string; // EFECTIVO | TARJETA | TRANSFERENCIA

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}

export class RegisterPosSaleDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  posSessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSalePaymentDto)
  payments: PosSalePaymentDto[];
}
