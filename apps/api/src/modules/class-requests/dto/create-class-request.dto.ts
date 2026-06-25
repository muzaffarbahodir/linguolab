import { IsString, IsEnum, IsOptional, IsInt, IsArray, Min, Max, MaxLength } from 'class-validator';
import { CEFR } from '@prisma/client';

export class CreateClassRequestDto {
  @IsString()
  language_id!: string;

  @IsString()
  title!: string;

  @IsEnum(CEFR)
  level!: CEFR;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  schedule_days!: string[];

  @IsOptional()
  @IsString()
  schedule_time?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  schedule_duration?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(30)
  max_students?: number;

  /** Ссылка на онлайн-урок (Zoom/Google Meet) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meeting_url?: string;

  /** Инфо о курсе (направлении) — продолжительность, что входит, требования */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  course_duration?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  course_includes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  course_requirements?: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
