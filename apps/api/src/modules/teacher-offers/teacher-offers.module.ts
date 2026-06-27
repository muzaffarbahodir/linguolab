import { Module } from '@nestjs/common';

import { TeacherOffersController } from './teacher-offers.controller';
import { TeacherOffersService } from './teacher-offers.service';

@Module({
  controllers: [TeacherOffersController],
  providers: [TeacherOffersService],
})
export class TeacherOffersModule {}
