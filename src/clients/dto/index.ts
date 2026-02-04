import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsArray } from 'class-validator';

export class CreateClientDto {
  @IsString()
  name: string;

  @IsString()
  nit: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  dv?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  personType?: string;

  @IsOptional()
  @IsBoolean()
  rutResponsible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rutCodes?: string[];
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  dv?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  personType?: string;

  @IsOptional()
  @IsBoolean()
  rutResponsible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rutCodes?: string[];
}
