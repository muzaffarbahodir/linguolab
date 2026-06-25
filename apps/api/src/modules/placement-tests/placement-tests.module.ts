import { Module } from '@nestjs/common';
import { PlacementTestsService } from './placement-tests.service';
import { PlacementTestsController } from './placement-tests.controller';

@Module({
  controllers: [PlacementTestsController],
  providers: [PlacementTestsService],
  exports: [PlacementTestsService],
})
export class PlacementTestsModule {}
