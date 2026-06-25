import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — глобальный (декоратор @Global).
 * Это означает что PrismaService доступен в любом модуле без явного импорта PrismaModule.
 * Достаточно добавить PrismaModule один раз в AppModule.imports.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
