import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { StorageModule } from '../storage/storage.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [StorageModule, TelegramModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
