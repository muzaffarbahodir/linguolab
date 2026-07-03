import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { LessonsModule } from '../lessons/lessons.module';
import { ClassRequestsController } from './class-requests.controller';
import { ClassRequestsService } from './class-requests.service';
import { ClassLifecycleService } from './class-lifecycle.service';

@Module({
  imports: [NotificationsModule, LessonsModule],
  controllers: [ClassRequestsController],
  providers: [ClassRequestsService, ClassLifecycleService],
})
export class ClassRequestsModule {}
