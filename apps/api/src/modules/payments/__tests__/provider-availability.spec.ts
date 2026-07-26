/**
 * Доступность способа оплаты.
 *
 * Тумблер is_enabled в админке раньше не читался при оплате: выключенным
 * провайдером всё равно можно было расплатиться. На проде все провайдеры
 * выключены и Click не настроен (пустые service_id/secret), поэтому студент
 * с выбором Click уходил на нерабочую страницу кассы, а платёж навсегда
 * оставался PENDING.
 */
import { BadRequestException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { PaymentsService } from '../payments.service';

type Cfg = { is_enabled: boolean } | null;

function serviceWith(cfg: Cfg): PaymentsService {
  const svc = Object.create(PaymentsService.prototype) as PaymentsService;
  // defineProperty, а не присваивание: prisma объявлено private readonly.
  Object.defineProperty(svc, 'prisma', {
    value: { paymentProviderConfig: { findUnique: jest.fn().mockResolvedValue(cfg) } },
  });
  return svc;
}

// Приватный метод — вызываем через прототип, чтобы проверять именно решение
// о допуске, а не весь checkout с его побочными эффектами.
function assertAvailable(svc: unknown, provider: PaymentProvider): Promise<void> {
  return (
    PaymentsService.prototype as unknown as {
      assertProviderAvailable: (p: PaymentProvider) => Promise<void>;
    }
  ).assertProviderAvailable.call(svc, provider);
}

describe('PaymentsService — какие способы оплаты доступны', () => {
  it('провайдер без вебхука закрыт, даже если в конфиге включён', async () => {
    // Ключевой случай: включить тумблер мало — принять оплату всё равно нечем,
    // подтверждение никогда не придёт и деньги зависнут.
    for (const p of [PaymentProvider.PAYME, PaymentProvider.UZUMBANK]) {
      const svc = serviceWith({ is_enabled: true });
      await expect(assertAvailable(svc, p)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('выключенный в конфиге провайдер не пропускается', async () => {
    const svc = serviceWith({ is_enabled: false });
    await expect(assertAvailable(svc, PaymentProvider.CLICK)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('включённый провайдер пропускается', async () => {
    const svc = serviceWith({ is_enabled: true });
    await expect(assertAvailable(svc, PaymentProvider.CLICK)).resolves.toBeUndefined();
  });

  it('без строки в конфиге способ разрешён — так работают наличные', async () => {
    // У наличных нет и не будет онлайн-кассы; строки в конфиге тоже нет.
    // Если считать отсутствие строки запретом, школа лишится единственного
    // реально работающего способа оплаты.
    const svc = serviceWith(null);
    await expect(assertAvailable(svc, PaymentProvider.CASH)).resolves.toBeUndefined();
  });
});
