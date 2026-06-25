import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuditModule, // AuditService для записи действий
    NotificationsModule, // NotificationsService для broadcast
    TelegramModule, // TelegramService (уже в NotificationsModule, но на всякий случай)
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
