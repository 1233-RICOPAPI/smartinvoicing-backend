import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CopilotQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  query: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class CopilotResponseDto {
  answer: string;
  data?: Record<string, unknown>;
  conversationId: string;
  intent?: string;
  from?: string;
  to?: string;
}
