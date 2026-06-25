import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SubmitHomeworkDto {
  /** R2 object key — получен из /storage/presigned-upload */
  @IsOptional()
  @IsString()
  file_key?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text_answer?: string;
}
