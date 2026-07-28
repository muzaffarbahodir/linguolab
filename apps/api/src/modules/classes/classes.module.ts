import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [NotificationsModule, AchievementsModule],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
