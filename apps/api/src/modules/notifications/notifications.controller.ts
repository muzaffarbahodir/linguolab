import { Controller, Get, Post, Patch, Param } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

/**
 * NotificationsController — REST API для уведомлений текущего пользователя.
 *
 * Все маршруты защищены глобальным JwtAuthGuard.
 *
 * Порядок маршрутов ВАЖЕН: статические пути ('read-all') должны идти
 * ДО параметрических ('/:id/read'), иначе 'read-all' будет перехвачен
 * как param :id со значением 'read-all'.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** GET /notifications — последние 50 уведомлений текущего пользователя */
  @Get()
  my(@CurrentUser() user: RequestUser) {
    return this.notifications.myNotifications(user.id);
  }

  /**
   * POST /notifications/test — отправить себе тестовое уведомление.
   * Проверяет полный pipeline: BullMQ → processor → Telegram + DB.
   */
  @Post('test')
  sendTest(@CurrentUser() user: RequestUser) {
    return this.notifications.sendTest(user.id);
  }

  /**
   * PATCH /notifications/read-all — отметить ВСЕ уведомления прочитанными.
   *
   * ⚠️ Должен быть объявлен ДО /:id/read — иначе 'read-all' парсится как :id.
   */
  @Patch('read-all')
  readAll(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }

  /** PATCH /notifications/:id/read — отметить одно уведомление прочитанным */
  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user.id);
  }
}
