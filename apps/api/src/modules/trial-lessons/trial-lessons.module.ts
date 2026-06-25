import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TrialLessonsController } from './trial-lessons.controller';
import { TrialLessonsService } from './trial-lessons.service';

@Module({
  imports: [NotificationsModule, TelegramModule],
  controllers: [TrialLessonsController],
  providers: [TrialLessonsService],
})
export class TrialLessonsModule {}
