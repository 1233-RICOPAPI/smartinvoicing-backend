import { IsDateString, IsNotEmpty } from 'class-validator';

/**
 * Rango de fechas para reportes contables.
 * Período cerrado [from, to].
 */
export class ReportRangeDto {
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}
