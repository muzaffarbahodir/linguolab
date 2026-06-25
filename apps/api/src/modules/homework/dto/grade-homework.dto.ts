import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';

export class GradeHomeworkDto {
  @IsInt()
  @Min(0)
  @Max(100)
  grade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
