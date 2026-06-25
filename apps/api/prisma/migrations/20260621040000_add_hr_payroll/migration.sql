-- HR / Payroll: сотрудники, прогоны зарплаты, расчётные листки
DO $$ BEGIN
  CREATE TYPE "EmploymentType" AS ENUM ('STAFF', 'SELF_EMPLOYED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryType" AS ENUM ('FIXED', 'PER_LESSON', 'REVENUE_SHARE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "employment_type" "EmploymentType" NOT NULL DEFAULT 'STAFF',
  "salary_type" "SalaryType" NOT NULL DEFAULT 'PER_LESSON',
  "rate_uzs" INTEGER NOT NULL DEFAULT 0,
  "rate_percent" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "hired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_user_id_key" ON "Employee"("user_id");

CREATE TABLE IF NOT EXISTS "PayrollRun" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "total_gross_uzs" INTEGER NOT NULL DEFAULT 0,
  "total_net_uzs" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalized_at" TIMESTAMP(3),
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_period_key" ON "PayrollRun"("period");

CREATE TABLE IF NOT EXISTS "Payslip" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "gross_uzs" INTEGER NOT NULL,
  "lessons_count" INTEGER NOT NULL DEFAULT 0,
  "ndfl_uzs" INTEGER NOT NULL DEFAULT 0,
  "social_uzs" INTEGER NOT NULL DEFAULT 0,
  "net_uzs" INTEGER NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payslip_run_id_employee_id_key" ON "Payslip"("run_id", "employee_id");
CREATE INDEX IF NOT EXISTS "Payslip_employee_id_idx" ON "Payslip"("employee_id");

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
