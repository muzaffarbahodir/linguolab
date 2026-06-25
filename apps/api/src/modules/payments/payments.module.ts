import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymeService } from './payme/payme.service';
import { ClickService } from './click/click.service';
import { TelegramModule } from '../telegram/telegram.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TelegramModule, FiscalModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymeService, ClickService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
