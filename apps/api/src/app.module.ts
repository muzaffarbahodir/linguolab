import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { ClassesModule } from './modules/classes/classes.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TrialLessonsModule } from './modules/trial-lessons/trial-lessons.module';
import { SupportModule } from './modules/support/support.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { StorageModule } from './modules/storage/storage.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlacementTestsModule } from './modules/placement-tests/placement-tests.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PromoModule } from './modules/promo/promo.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TeachersModule } from './modules/teachers/teachers.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ConfigAppModule } from './modules/config-app/config-app.module';
import { ClassRequestsModule } from './modules/class-requests/class-requests.module';
import { TeacherOffersModule } from './modules/teacher-offers/teacher-offers.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { HrModule } from './modules/hr/hr.module';
import { PointsModule } from './modules/points/points.module';

/**
 * AppModule — корневой модуль.
 *
 * Архитектурные решения:
 *
 * 1. ConfigModule.forRoot({ isGlobal: true }) — ConfigService доступен везде.
 *    cache: true — переменные кэшируются при первом обращении.
 *
 * 2. PrismaModule и RedisModule — @Global(), поэтому PrismaService и RedisService
 *    доступны в любом модуле без явного импорта PrismaModule/RedisModule.
 *
 * 3. APP_GUARD (JwtAuthGuard) — применяется ко ВСЕМ эндпоинтам глобально.
 *    Чтобы сделать эндпоинт публичным — используй @Public() декоратор.
 *    Так по умолчанию всё защищено, публичное явно помечается.
 *    /health и / исключены через setGlobalPrefix exclude в main.ts.
 */
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    // Rate limiting: 20 req/sec (burst) + 300 req/min (sustained)
    // skipIf: отключаем в тестах чтобы не мешать unit-тестам
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1_000, limit: 20 },
          { name: 'medium', ttl: 60_000, limit: 300 },
        ],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
    // BullMQ глобальное подключение к Redis.
    // forRootAsync — читаем REDIS_URL из ConfigService (он уже инициализирован).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          // ioredis принимает URL вида redis://:password@host:port
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    TelegramModule,
    UsersModule,
    LanguagesModule,
    LessonsModule,
    ClassesModule,
    EnrollmentsModule,
    TrialLessonsModule,
    SupportModule,
    ReferralsModule,
    StorageModule,
    HomeworkModule,
    AchievementsModule,
    CertificatesModule,
    NotificationsModule,
    PlacementTestsModule,
    AdminModule,
    PaymentsModule,
    PromoModule,
    FiscalModule,
    ParentsModule,
    TeachersModule,
    AnalyticsModule,
    ReportsModule,
    ConfigAppModule,
    ClassRequestsModule,
    TeacherOffersModule,
    AnnouncementsModule,
    HrModule,
    PointsModule,
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  providers: [
    {
      // Sentry global filter — перехватывает все необработанные исключения.
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      // ThrottlerGuard — rate limiting на всех роутах (до JWT, чтобы блокировать раньше).
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Глобальный гвард — JWT проверка на всех роутах.
      // Публичные роуты помечаются @Public() в контроллерах.
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // Глобальный гвард — проверка роли после JWT.
      // Эндпоинты без @Roles() пропускаются.
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
