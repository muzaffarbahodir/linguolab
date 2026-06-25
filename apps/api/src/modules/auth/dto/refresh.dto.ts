import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO для POST /auth/refresh
 * refresh_token — UUID v4, выданный при /auth/telegram/init или /auth/admin/login
 */
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID(4)
  refresh_token!: string;
}
