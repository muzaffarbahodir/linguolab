import { Module } from '@nestjs/common';

import { TeachersModule } from '../teachers/teachers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentMaintenanceService } from './enrollment-maintenance.service';

@Module({
  imports: [TeachersModule, NotificationsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentMaintenanceService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
