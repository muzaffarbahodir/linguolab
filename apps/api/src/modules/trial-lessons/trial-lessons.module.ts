import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { TrialLessonsController } from './trial-lessons.controller';
import { TrialLessonsService } from './trial-lessons.service';

@Module({
  imports: [NotificationsModule, TelegramModule, AchievementsModule],
  controllers: [TrialLessonsController],
  providers: [TrialLessonsService],
})
export class TrialLessonsModule {}
