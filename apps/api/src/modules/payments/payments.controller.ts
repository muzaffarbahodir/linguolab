import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  UnauthorizedException,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Role } from '@prisma/client';

import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveUserGuard } from '../auth/guards/active-user.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { PaymentsService, CheckoutDto } from './payments.service';
import { PaymeService } from './payme/payme.service';
import { ClickService } from './click/click.service';
import { PaymeRpcRequest } from './payme/payme.types';
import { ClickPrepareDto } from './click/dto/click-prepare.dto';
import { ClickCompleteDto } from './click/dto/click-complete.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymeService: PaymeService,
    private readonly clickService: ClickService,
    private readonly config: ConfigService,
  ) {}

  // ─── Student endpoints ───────────────────────────────────────────────────────

  /** POST /payments/checkout */
  @Post('checkout')
  @UseGuards(ActiveUserGuard)
  checkout(@CurrentUser() user: RequestUser, @Body() dto: CheckoutDto) {
    return this.paymentsService.checkout(user.id, dto);
  }

  /** GET /payments/history */
  @Get('history')
  history(@CurrentUser() user: RequestUser) {
    return this.paymentsService.myPayments(user.id);
  }

  /** GET /payments/last-pending */
  @Get('last-pending')
  lastPending(@CurrentUser() user: RequestUser) {
    return this.paymentsService.getLastPending(user.id);
  }

  /** GET /payments/:id/receipt — фискальный чек платежа (только владелец) */
  @Get(':id/receipt')
  receipt(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.paymentsService.getMyReceipt(id, user.id);
  }

  /** GET /payments/:id */
  @Get(':id')
  getOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.paymentsService.getPayment(id, user.id);
  }

  // ─── Payme webhook ───────────────────────────────────────────────────────────

  /**
   * POST /payments/payme/webhook
   * Payme отправляет JSON-RPC 2.0 запросы с Basic Auth.
   * Пароль = PAYME_MERCHANT_KEY из .env
   * @Public() — JWT не проверяем, проверяем Basic Auth вручную
   */
  @Post('payme/webhook')
  @Public()
  @HttpCode(200)
  async paymeWebhook(
    @Headers('authorization') authorization: string,
    @Body() body: PaymeRpcRequest,
  ) {
    // Проверяем Basic Auth
    this.verifyPaymeAuth(authorization);
    return this.paymeService.handle(body);
  }

  private verifyPaymeAuth(authorization: string) {
    if (!authorization?.startsWith('Basic ')) {
      throw new UnauthorizedException('Basic auth required');
    }

    const base64 = authorization.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    // Формат: "Paycom:<merchant_key>"  или  "<login>:<password>"
    const colonIdx = decoded.indexOf(':');
    const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : '';

    const merchantKey = this.config.get<string>('PAYME_MERCHANT_KEY') ?? '';
    if (!password || !merchantKey || password !== merchantKey) {
      throw new UnauthorizedException('Invalid Payme credentials');
    }
  }

  // ─── Click webhooks ──────────────────────────────────────────────────────────

  /** POST /payments/click/prepare */
  @Post('click/prepare')
  @Public()
  @HttpCode(200)
  clickPrepare(@Body() body: ClickPrepareDto) {
    return this.clickService.prepare(body);
  }

  /** POST /payments/click/complete */
  @Post('click/complete')
  @Public()
  @HttpCode(200)
  clickComplete(@Body() body: ClickCompleteDto) {
    return this.clickService.complete(body);
  }

  // ─── Uzumbank webhook (stub) ──────────────────────────────────────────────

  /**
   * POST /payments/uzumbank/callback
   * Uzumbank — пока заглушка (is_enabled=false в провайдер-конфиге).
   */
  @Post('uzumbank/callback')
  @Public()
  @HttpCode(501)
  uzumbankCallback(@Body() _body: Record<string, unknown>) {
    return { error: 'Uzumbank integration not implemented', code: 501 };
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  /** GET /payments/admin/list — MANAGER+ */
  @Get('admin/list')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  adminList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.adminListPayments(page, limit, status);
  }

  /** GET /payments/admin/resolve/:number — найти заказ по номеру (ручной ввод), MANAGER+ */
  @Get('admin/resolve/:number')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  adminResolve(@Param('number') number: string) {
    return this.paymentsService.adminResolveOrder(number);
  }

  /** GET /payments/admin/:id — карточка платежа (скан QR наличного чека), MANAGER+ */
  @Get('admin/:id')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  adminGet(@Param('id') id: string) {
    return this.paymentsService.adminGetPayment(id);
  }

  /** POST /payments/admin/:id/confirm-cash — MANAGER+ (приём наличных) */
  @Post('admin/:id/confirm-cash')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  confirmCash(@Param('id') id: string) {
    return this.paymentsService.adminConfirmCash(id);
  }

  /**
   * POST /payments/admin/:id/refund — ADMIN+
   * Возврат блокируется если студент учился >3 занятий. SUPER_ADMIN может
   * передать force=true чтобы обойти окно (исключения).
   */
  @Post('admin/:id/refund')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  refund(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
    @Body('force') force?: boolean,
  ) {
    const allowForce = user.role === Role.SUPER_ADMIN && force === true;
    return this.paymentsService.adminRefund(id, reason, allowForce);
  }
}
