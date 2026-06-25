import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateHomeworkDto {
  @IsString()
  class_id!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
