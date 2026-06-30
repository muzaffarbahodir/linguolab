import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  EmploymentType,
  SalaryType,
  PayrollStatus,
  LessonStatus,
  PaymentStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

// Ставки налогов Узбекистана (проверять с бухгалтером — могут меняться).
const NDFL_RATE = 12; // НДФЛ, удерживается из зарплаты штатного
const SOCIAL_RATE = 12; // соцналог работодателя (затрата центра, не удержание)

/** Экранирование поля CSV: запятая/кавычки/перенос → оборачиваем в "..." */
function csvField(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const SALARY_LABEL_RU: Record<SalaryType, string> = {
  FIXED: 'Оклад',
  PER_LESSON: 'За урок',
  REVENUE_SHARE: '% выручки',
};

export interface UpsertEmployeeDto {
  user_id?: string;
  telegram_username?: string;
  employment_type?: EmploymentType;
  salary_type?: SalaryType;
  rate_uzs?: number;
  rate_percent?: number;
  is_active?: boolean;
  note?: string;
}

const employeeSelect = {
  id: true,
  user_id: true,
  employment_type: true,
  salary_type: true,
  rate_uzs: true,
  rate_percent: true,
  is_active: true,
  note: true,
  hired_at: true,
  user: {
    select: { first_name: true, last_name: true, telegram_username: true, role: true },
  },
} as const;

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Employees ───────────────────────────────────────────────────────────────

  listEmployees() {
    return this.prisma.employee.findMany({
      select: employeeSelect,
      orderBy: { created_at: 'desc' },
    });
  }

  async createEmployee(dto: UpsertEmployeeDto) {
    const userId = await this.resolveUserId(dto);
    const exists = await this.prisma.employee.findUnique({ where: { user_id: userId } });
    if (exists) throw new ConflictException('Этот пользователь уже сотрудник');

    return this.prisma.employee.create({
      data: {
        user_id: userId,
        employment_type: dto.employment_type ?? EmploymentType.STAFF,
        salary_type: dto.salary_type ?? SalaryType.PER_LESSON,
        rate_uzs: dto.rate_uzs ?? 0,
        rate_percent: dto.rate_percent ?? 0,
        is_active: dto.is_active ?? true,
        note: dto.note ?? null,
      },
      select: employeeSelect,
    });
  }

  async updateEmployee(id: string, dto: UpsertEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.employment_type !== undefined ? { employment_type: dto.employment_type } : {}),
        ...(dto.salary_type !== undefined ? { salary_type: dto.salary_type } : {}),
        ...(dto.rate_uzs !== undefined ? { rate_uzs: dto.rate_uzs } : {}),
        ...(dto.rate_percent !== undefined ? { rate_percent: dto.rate_percent } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      select: employeeSelect,
    });
  }

  async removeEmployee(id: string) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    await this.prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Payroll ─────────────────────────────────────────────────────────────────

  listRuns() {
    return this.prisma.payrollRun.findMany({ orderBy: { period: 'desc' } });
  }

  async getRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                employment_type: true,
                salary_type: true,
                user: { select: { first_name: true, last_name: true } },
              },
            },
          },
          orderBy: { net_uzs: 'desc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  /**
   * Сформировать черновик зарплаты за месяц period="YYYY-MM".
   * Пересчитывает с нуля (удаляет старые листки если прогон ещё DRAFT).
   */
  async generateDraft(period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('period должен быть в формате YYYY-MM');
    }

    const existing = await this.prisma.payrollRun.findUnique({ where: { period } });
    if (existing && existing.status === PayrollStatus.FINALIZED) {
      throw new BadRequestException('Прогон за этот месяц уже финализирован');
    }

    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year!, month! - 1, 1));
    const end = new Date(Date.UTC(year!, month!, 1));

    const employees = await this.prisma.employee.findMany({
      where: { is_active: true },
      select: employeeSelect,
    });

    const slips: {
      employee_id: string;
      gross_uzs: number;
      lessons_count: number;
      ndfl_uzs: number;
      social_uzs: number;
      net_uzs: number;
    }[] = [];

    for (const emp of employees) {
      const { gross, lessons } = await this.computeGross(emp, start, end);
      const isStaff = emp.employment_type === EmploymentType.STAFF;
      const ndfl = isStaff ? Math.round((gross * NDFL_RATE) / 100) : 0;
      const social = isStaff ? Math.round((gross * SOCIAL_RATE) / 100) : 0;
      const net = gross - ndfl;
      slips.push({
        employee_id: emp.id,
        gross_uzs: gross,
        lessons_count: lessons,
        ndfl_uzs: ndfl,
        social_uzs: social,
        net_uzs: net,
      });
    }

    const totalGross = slips.reduce((s, p) => s + p.gross_uzs, 0);
    const totalNet = slips.reduce((s, p) => s + p.net_uzs, 0);

    // Транзакция: пересоздаём прогон + листки.
    const run = await this.prisma.$transaction(async (tx) => {
      const r = await tx.payrollRun.upsert({
        where: { period },
        create: { period, total_gross_uzs: totalGross, total_net_uzs: totalNet },
        update: { total_gross_uzs: totalGross, total_net_uzs: totalNet },
      });
      await tx.payslip.deleteMany({ where: { run_id: r.id } });
      if (slips.length) {
        await tx.payslip.createMany({ data: slips.map((s) => ({ ...s, run_id: r.id })) });
      }
      return r;
    });

    return this.getRun(run.id);
  }

  /**
   * GET /hr/payroll/runs/:id/export — реестр зарплат за месяц в CSV.
   * Строки по сотрудникам + итоговая строка (НДФЛ/соцналог/к выплате) для бухгалтера.
   */
  async exportPayrollCsv(runId: string): Promise<{ period: string; csv: string }> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                employment_type: true,
                salary_type: true,
                user: { select: { first_name: true, last_name: true } },
              },
            },
          },
          orderBy: { net_uzs: 'desc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    const slips = run.payslips;

    const header = [
      'Сотрудник',
      'Занятость',
      'Тип оплаты',
      'Уроков',
      'Начислено',
      'НДФЛ',
      'Соцналог',
      'К выплате',
    ].join(',');

    const rows = slips.map((p) => {
      const name = `${p.employee.user.first_name}${
        p.employee.user.last_name ? ' ' + p.employee.user.last_name : ''
      }`;
      return [
        csvField(name),
        p.employee.employment_type === EmploymentType.STAFF ? 'Штат' : 'Самозанятый',
        csvField(SALARY_LABEL_RU[p.employee.salary_type]),
        p.lessons_count,
        p.gross_uzs,
        p.ndfl_uzs,
        p.social_uzs,
        p.net_uzs,
      ].join(',');
    });

    const sum = (sel: (s: (typeof slips)[number]) => number) =>
      slips.reduce((acc, p) => acc + sel(p), 0);
    const totalRow = [
      'ИТОГО',
      '',
      '',
      '',
      sum((p) => p.gross_uzs),
      sum((p) => p.ndfl_uzs),
      sum((p) => p.social_uzs),
      sum((p) => p.net_uzs),
    ].join(',');

    const csv = [header, ...rows, '', totalRow].join('\n');
    return { period: run.period, csv };
  }

  async finalizeRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status === PayrollStatus.FINALIZED) {
      throw new BadRequestException('Уже финализирован');
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: PayrollStatus.FINALIZED, finalized_at: new Date() },
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /** Считает начисление (gross) и число уроков сотрудника за период. */
  private async computeGross(
    emp: {
      id: string;
      user_id: string;
      salary_type: SalaryType;
      rate_uzs: number;
      rate_percent: number;
    },
    start: Date,
    end: Date,
  ): Promise<{ gross: number; lessons: number }> {
    if (emp.salary_type === SalaryType.FIXED) {
      return { gross: emp.rate_uzs, lessons: 0 };
    }

    if (emp.salary_type === SalaryType.PER_LESSON) {
      const lessons = await this.prisma.lesson.count({
        where: {
          status: LessonStatus.COMPLETED,
          scheduled_at: { gte: start, lt: end },
          class: { teacher: { user_id: emp.user_id } },
        },
      });
      return { gross: lessons * emp.rate_uzs, lessons };
    }

    // REVENUE_SHARE — % от PAID-выручки его групп за период
    const agg = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paid_at: { gte: start, lt: end },
        class: { teacher: { user_id: emp.user_id } },
      },
      _sum: { amount_tiyin: true },
    });
    const revenueUzs = Math.round(Number(agg._sum.amount_tiyin ?? 0n) / 100);
    return { gross: Math.round((revenueUzs * emp.rate_percent) / 100), lessons: 0 };
  }

  private async resolveUserId(dto: UpsertEmployeeDto): Promise<string> {
    if (dto.user_id) return dto.user_id;
    if (dto.telegram_username) {
      const uname = dto.telegram_username.trim().replace(/^@/, '');
      const u = await this.prisma.user.findFirst({
        where: { telegram_username: uname },
        select: { id: true },
      });
      if (!u) throw new BadRequestException(`Пользователь @${uname} не найден`);
      return u.id;
    }
    throw new BadRequestException('Укажите пользователя (user_id или @username)');
  }
}
