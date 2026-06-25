import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — обёртка над PrismaClient.
 *
 * OnModuleInit  → $connect() при старте NestJS (создаёт пул соединений).
 * OnModuleDestroy → $disconnect() при остановке (graceful shutdown).
 *
 * Импортируй PrismaModule туда где нужен Prisma, или сделай PrismaModule global
 * чтобы не тащить импорт в каждый модуль.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
