import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO для POST /auth/admin/login
 * Только для ролей MANAGER | ADMIN | SUPER_ADMIN.
 * STUDENT / TEACHER / PARENT используют /auth/telegram/init.
 */
export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
