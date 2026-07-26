import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { ZoomAttendanceService } from './zoom-attendance.service';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ZoomController],
  providers: [ZoomService, ZoomAttendanceService],
  exports: [ZoomService],
})
export class ZoomModule {}
