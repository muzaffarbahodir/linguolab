import { Controller, Get, Post, Param } from '@nestjs/common';
import { Role } from '@prisma/client';

import { FiscalService } from './fiscal.service';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * FiscalController — REST-эндпоинты для фискальных чеков.
 *
 * GET  /fiscal/receipt/:id               — статус чека (JWT, любой)
 * GET  /fiscal/receipt/by-payment/:pid   — чек по payment_id
 * POST /fiscal/receipt/:id/retry         — ретрай вручную (ADMIN+)
 */
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  /** Получить фискальный чек по его ID */
  @Get('receipt/:id')
  getReceipt(@Param('id') id: string) {
    return this.fiscal.getReceipt(id);
  }

  /** Получить фискальный чек по ID платежа */
  @Get('receipt/by-payment/:paymentId')
  getReceiptByPayment(@Param('paymentId') paymentId: string) {
    return this.fiscal.getReceiptByPayment(paymentId);
  }

  /** Ретрай фискализации вручную (только ADMIN и выше) */
  @Post('receipt/:id/retry')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  retryReceipt(@Param('id') id: string) {
    return this.fiscal.retryReceipt(id);
  }
}
