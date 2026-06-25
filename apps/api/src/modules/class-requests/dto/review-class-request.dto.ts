import { IsString, IsOptional, IsInt, Min, IsDateString, IsEnum, IsArray } from 'class-validator';
import { CEFR } from '@prisma/client';

/** DTO для PATCH /class-requests/:id/approve */
export class ApproveClassRequestDto {
  /** Фиксированная цена в сумах */
  @IsInt()
  @Min(0)
  price_uzs!: number;

  /** Фиксированная цена в долларах */
  @IsInt()
  @Min(0)
  price_usd!: number;

  /** Количество мест (можно скорректировать) */
  @IsOptional()
  @IsInt()
  @Min(2)
  max_students?: number;

  /** Уровень (можно скорректировать) */
  @IsOptional()
  @IsEnum(CEFR)
  level?: CEFR;

  /** Дни расписания (можно скорректировать) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schedule_days?: string[];

  /** Время начала (можно скорректировать) */
  @IsOptional()
  @IsString()
  schedule_time?: string;

  /** Длительность в минутах */
  @IsOptional()
  @IsInt()
  @Min(30)
  schedule_duration?: number;

  /** Дата открытия записи */
  @IsOptional()
  @IsDateString()
  enrollment_opens_at?: string;

  /** Дата закрытия записи */
  @IsOptional()
  @IsDateString()
  enrollment_closes_at?: string;

  /** Дата начала семестра */
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  /** Дата завершения семестра */
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  /** Метка семестра: "2026-07" */
  @IsOptional()
  @IsString()
  semester_label?: string;

  /** Ссылка на онлайн-урок (Zoom/Meet) — можно задать/исправить при апруве */
  @IsOptional()
  @IsString()
  meeting_url?: string;

  /** Комментарий менеджера для учителя */
  @IsOptional()
  @IsString()
  admin_note?: string;
}

/** DTO для PATCH /class-requests/:id/reject */
export class RejectClassRequestDto {
  @IsOptional()
  @IsString()
  admin_note?: string;
}
