import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceStatsController } from './attendance-stats.controller';
import { AttendanceStatsService } from './attendance-stats.service';
import { DropoutRiskService } from './dropout-risk.service';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LessonsController, AttendanceStatsController],
  providers: [LessonsService, AttendanceStatsService, DropoutRiskService],
  exports: [LessonsService],
})
export class LessonsModule {}
