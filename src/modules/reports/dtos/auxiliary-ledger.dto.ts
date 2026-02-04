import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Parámetros para libro auxiliar por cuenta.
 */
export class AuxiliaryLedgerDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}
