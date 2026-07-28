import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Ссылки на внешние ресурсы принимаем только по http/https.
 *
 * Профиль публичный, а его поля попадают прямо в href и src. Без этого
 * ограничения преподаватель может сохранить `javascript:` — и получится
 * активная ссылка на странице, которую открывают незалогиненные посетители.
 */
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class SpokenLanguageDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  /** Свободный текст: и «Native», и «C2», и «Свободно» — всё это встречается. */
  @IsString()
  @MaxLength(30)
  level!: string;
}

export class EducationEntryDto {
  @IsString()
  @Length(1, 160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  org?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;
}

export class UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  /** null — «убрать фото»; поэтому не @IsUrl, он бы не пропустил null. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo_url?: string | null;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  website_url?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  instagram_url?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  telegram_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  intro_video_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  intro_video_poster?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  /** 70 — граница здравого смысла, а не биографии: цифра идёт в витрину. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experience_years?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  specializations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SpokenLanguageDto)
  speaks?: SpokenLanguageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EducationEntryDto)
  education?: EducationEntryDto[];
}

/**
 * То же самое, но от лица менеджера.
 *
 * Нужен потому, что преподаватель, заведённый через админку, в Telegram не
 * заходит вовсе: createTeacher ставит ему placeholder вместо telegram_user_id.
 * Без этого DTO витрину таким преподавателям заполнить было бы некому — а их
 * большинство, пока центр не перевёл всех на самостоятельную регистрацию.
 *
 * Черты здесь есть, в отличие от преподавательского DTO: менеджеру их ставить
 * как раз можно.
 */
export class AdminUpdateTeacherDto extends UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  last_name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  highlights?: string[];
}

/** Черты преподавателя проставляет менеджер — отдельным эндпоинтом. */
export class SetHighlightsDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  highlights!: string[];
}
