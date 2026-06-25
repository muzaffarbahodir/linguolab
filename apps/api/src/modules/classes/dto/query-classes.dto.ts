import { IsOptional, IsString, IsEnum } from 'class-validator';
import { CEFR } from '@prisma/client';

export class QueryClassesDto {
  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsEnum(CEFR)
  level?: CEFR;
}
