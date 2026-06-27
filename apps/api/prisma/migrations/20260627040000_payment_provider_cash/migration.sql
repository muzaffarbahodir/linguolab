-- Наличная оплата: новый провайдер CASH (подтверждает менеджер вручную).
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'CASH';
