import { Module } from '@nestjs/common';

import { AchievementsModule } from '../achievements/achievements.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';

@Module({
  imports: [AchievementsModule, NotificationsModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
})
export class HomeworkModule {}
