-- Migration: payments, fiscal_receipts, webhook_events, payment_providers_config
-- Этап 11: Payments

CREATE TYPE "PaymentProvider" AS ENUM ('PAYME', 'CLICK', 'UZUMBANK');
CREATE TYPE "PaymentStatus"   AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'CANCELLED', 'REFUNDED', 'FAILED', 'EXPIRED');
CREATE TYPE "FiscalStatus"    AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED', 'REFUNDED');
CREATE TYPE "ReceiptType"     AS ENUM ('SALE', 'REFUND');

CREATE TABLE "payments" (
  "id"               TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "payer_user_id"    TEXT,
  "class_id"         TEXT,
  "amount_tiyin"     BIGINT NOT NULL,
  "vat_amount_tiyin" BIGINT NOT NULL DEFAULT 0,
  "vat_rate"         INTEGER NOT NULL DEFAULT 12,
  "currency"         TEXT NOT NULL DEFAULT 'UZS',
  "provider"         "PaymentProvider" NOT NULL,
  "provider_txn_id"  TEXT,
  "provider_state"   INTEGER,
  "status"           "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key"  TEXT NOT NULL,
  "payload_in"       JSONB,
  "payload_out"      JSONB,
  "paid_at"          TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX "payments_user_id_status_idx"           ON "payments"("user_id", "status");
CREATE INDEX "payments_provider_txn_id_idx"          ON "payments"("provider", "provider_txn_id");
CREATE INDEX "payments_status_created_at_idx"        ON "payments"("status", "created_at");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_payer_user_id_fkey"
  FOREIGN KEY ("payer_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Fiscal receipts ────────────────────────────────────────────────────────

CREATE TABLE "fiscal_receipts" (
  "id"               TEXT NOT NULL,
  "payment_id"       TEXT NOT NULL,
  "status"           "FiscalStatus" NOT NULL DEFAULT 'PENDING',
  "receipt_type"     "ReceiptType" NOT NULL DEFAULT 'SALE',
  "fiscal_sign"      TEXT,
  "fiscal_number"    TEXT,
  "receipt_url"      TEXT,
  "total_tiyin"      BIGINT NOT NULL,
  "vat_tiyin"        BIGINT NOT NULL,
  "items"            JSONB NOT NULL,
  "request_payload"  JSONB,
  "response_payload" JSONB,
  "attempts"         INTEGER NOT NULL DEFAULT 0,
  "last_error"       TEXT,
  "sent_at"          TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fiscal_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_receipts_payment_id_key" ON "fiscal_receipts"("payment_id");
CREATE INDEX "fiscal_receipts_status_attempts_idx"   ON "fiscal_receipts"("status", "attempts");

ALTER TABLE "fiscal_receipts"
  ADD CONSTRAINT "fiscal_receipts_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Webhook events ─────────────────────────────────────────────────────────

CREATE TABLE "webhook_events" (
  "id"           TEXT NOT NULL,
  "provider"     "PaymentProvider" NOT NULL,
  "external_id"  TEXT NOT NULL,
  "payment_id"   TEXT,
  "signature"    TEXT,
  "raw_body"     JSONB NOT NULL,
  "processed"    BOOLEAN NOT NULL DEFAULT false,
  "processed_at" TIMESTAMP(3),
  "error"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_external_id_key" ON "webhook_events"("provider", "external_id");
CREATE INDEX "webhook_events_processed_created_at_idx"        ON "webhook_events"("processed", "created_at");

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Payment providers config ────────────────────────────────────────────────

CREATE TABLE "payment_providers_config" (
  "id"            TEXT NOT NULL,
  "provider"      "PaymentProvider" NOT NULL,
  "is_enabled"    BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "config"        JSONB NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_providers_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_providers_config_provider_key" ON "payment_providers_config"("provider");

-- ─── Seed default provider configs ──────────────────────────────────────────

INSERT INTO "payment_providers_config" ("id", "provider", "is_enabled", "display_order", "config", "updated_at")
VALUES
  (gen_random_uuid()::text, 'PAYME',    true,  1, '{"display_name":"Payme","logo_url":"/providers/payme.svg"}',    NOW()),
  (gen_random_uuid()::text, 'CLICK',    false, 2, '{"display_name":"Click","logo_url":"/providers/click.svg"}',    NOW()),
  (gen_random_uuid()::text, 'UZUMBANK', false, 3, '{"display_name":"Uzum Bank","logo_url":"/providers/uzum.svg"}', NOW());
