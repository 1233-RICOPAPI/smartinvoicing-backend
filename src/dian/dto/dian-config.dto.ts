import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class DianConfigUpdateDto {
  @IsOptional()
  @IsString()
  @IsIn(['habilitacion', 'produccion'])
  env?: string;

  @IsOptional()
  @IsString()
  technicalKey?: string;

  @IsOptional()
  @IsString()
  prefixFe?: string;

  @IsOptional()
  @IsString()
  prefixPos?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99999999)
  fromNumber?: number;

  @IsOptional()
  @IsString()
  softwareId?: string;

  @IsOptional()
  @IsString()
  softwarePin?: string;

  /** Certificado .p12 en base64 (opcional; si no se envía se mantiene el anterior). */
  @IsOptional()
  @IsString()
  certBase64?: string;

  /** Contraseña del certificado (opcional; solo si se envía certBase64). */
  @IsOptional()
  @IsString()
  certPassword?: string;
}
