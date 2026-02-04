import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportReportType {
  BALANCE = 'balance',
  INCOME_STATEMENT = 'income-statement',
  AUXILIARY_LEDGER = 'auxiliary-ledger',
  JOURNAL_ENTRIES = 'journal-entries',
  INVOICES = 'invoices',
}

export class ExportExcelQueryDto {
  @IsEnum(ExportReportType)
  type: ExportReportType;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

export class ExportPdfQueryDto {
  @IsEnum(ExportReportType)
  type: ExportReportType;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}
