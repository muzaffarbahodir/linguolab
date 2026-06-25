import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
