import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * RedisModule — глобальный (декоратор @Global).
 * RedisService доступен везде без явного импорта.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
