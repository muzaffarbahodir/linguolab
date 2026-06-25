import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService — обёртка над ioredis клиентом.
 *
 * Предоставляет типизированные методы для работы с Redis.
 * Используется AuthService для хранения refresh токенов.
 *
 * Подключение: REDIS_URL из env (redis://:password@host:6379)
 */
@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');
    if (!redisUrl) throw new Error('REDIS_URL is not configured');

    super(redisUrl, {
      // Автоматически переподключаться при разрыве
      retryStrategy: (times: number) => {
        if (times > 10) {
          this.logger.error('Redis reconnect attempts exceeded 10, giving up');
          return null; // Прекращаем попытки
        }
        const delay = Math.min(times * 200, 2000);
        this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      // Не логируем предупреждение о "no ready" при первом коннекте
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    this.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    // Проверяем соединение при старте
    await this.ping();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
    this.logger.log('Redis disconnected');
  }
}
