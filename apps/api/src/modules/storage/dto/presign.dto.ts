import { IsString, IsIn, Length, Matches, IsNumber, Min, Max } from 'class-validator';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
];

export class PresignDto {
  @IsString()
  @Length(1, 255)
  @Matches(/^[\w.-]+$/, {
    message: 'filename must contain only letters, digits, dots, dashes, underscores',
  })
  filename!: string;

  @IsString()
  @IsIn(ALLOWED_TYPES, { message: `contentType must be one of: ${ALLOWED_TYPES.join(', ')}` })
  contentType!: string;

  @IsNumber()
  @Min(1, { message: 'size must be at least 1 byte' })
  @Max(52_428_800, { message: 'size must not exceed 50 MB' })
  size!: number;
}
