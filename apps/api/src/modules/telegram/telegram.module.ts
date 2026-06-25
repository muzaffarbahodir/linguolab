import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

/**
 * TelegramModule — @Global() чтобы TelegramService был доступен
 * в ClassesModule, а в будущем в BookingsModule, PaymentsModule и т.д.
 * без лишних imports.
 */
@Global()
@Module({
  imports: [RedisModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
