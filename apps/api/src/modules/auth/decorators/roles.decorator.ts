import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * @Roles(Role.ADMIN, Role.SUPER_ADMIN) — задаёт разрешённые роли для endpoint.
 * Читается RolesGuard.
 *
 * Использование:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.TEACHER)
 *   @Get('/teachers/me/classes')
 *   getMyClasses() {}
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
