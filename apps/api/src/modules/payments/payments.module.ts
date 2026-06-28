import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymeService } from './payme/payme.service';
import { ClickService } from './click/click.service';
import { BillingReminderService } from './billing-reminder.service';
import { TelegramModule } from '../telegram/telegram.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [TelegramModule, FiscalModule, NotificationsModule, PromoModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymeService, ClickService, BillingReminderService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
