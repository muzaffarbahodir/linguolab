import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { StorageService } from '../storage/storage.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// Roboto TTF lives inside the pdfmake package — full Cyrillic/Unicode support.
const PDFMAKE_DIR = path.dirname(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require.resolve('pdfmake/package.json'),
);
const FONT_REGULAR = path.join(PDFMAKE_DIR, 'build/fonts/Roboto/Roboto-Regular.ttf');
const FONT_BOLD = path.join(PDFMAKE_DIR, 'build/fonts/Roboto/Roboto-Medium.ttf');

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtUzs(uzs: number): string {
  return uzs.toLocaleString('ru-RU') + ' сум';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function periodLabel(from: Date, to: Date): string {
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (diffDays <= 1) return 'Дневной отчёт';
  if (diffDays <= 8) return 'Еженедельный отчёт';
  if (diffDays <= 32) return 'Месячный отчёт';
  return 'Отчёт за период';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  // ─── Cron ──────────────────────────────────────────────────────────────────

  /** Каждое воскресенье 08:00 Ташкент = 03:00 UTC */
  @Cron('0 3 * * 0', { name: 'weekly-report', timeZone: 'UTC' })
  async sendWeeklyReport() {
    this.logger.log('Generating weekly report...');
    try {
      await this.generateAndSend();
    } catch (err) {
      this.logger.error(`Weekly report failed: ${String(err)}`);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** POST /reports/weekly/generate — ручной запуск за последние 7 дней. */
  async generateAndSend(): Promise<{ pdf_url: string; sent_to: number }> {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const stats = await this.collectStats(from, to);
    const label = 'Еженедельный отчёт';
    const pdfBuffer = await this.buildPdf(stats, label);

    const key = `reports/weekly-${to.toISOString().slice(0, 10)}.pdf`;
    const pdfUrl = await this.uploadPdf(key, pdfBuffer);

    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', tg_blocked: false },
      select: { telegram_user_id: true },
    });

    const caption =
      `📊 *${label} LinguoLab*\n` +
      `🗓 ${fmtDate(from)} — ${fmtDate(to)}\n\n` +
      `💰 Выручка: *${fmtUzs(stats.revenue)}*\n` +
      `👥 Новых студентов: *${stats.newStudents}*\n` +
      `📚 Активных записей: *${stats.activeEnrollments}*\n` +
      `📄 [Скачать PDF](${pdfUrl})`;

    let sent = 0;
    for (const admin of superAdmins) {
      try {
        await this.telegram.sendMessageStr(admin.telegram_user_id.toString(), caption);
        sent++;
      } catch {
        // один упал — продолжаем
      }
    }

    this.logger.log(`Weekly report sent to ${sent} SUPER_ADMINs. PDF: ${pdfUrl}`);
    return { pdf_url: pdfUrl, sent_to: sent };
  }

  /**
   * GET /reports/generate?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Генерирует PDF за произвольный период. Возвращает URL без отправки в TG.
   */
  async generatePeriodReport(from: Date, to: Date): Promise<{ pdf_url: string; label: string }> {
    const stats = await this.collectStats(from, to);
    const label = periodLabel(from, to);
    const pdfBuffer = await this.buildPdf(stats, label);
    const key = `reports/period-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.pdf`;
    const pdfUrl = await this.uploadPdf(key, pdfBuffer);
    return { pdf_url: pdfUrl, label };
  }

  // ─── Stats collector ───────────────────────────────────────────────────────

  private async collectStats(from: Date, to: Date) {
    const monthAgo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      revenueRow,
      newStudents,
      activeEnrollments,
      pendingEnrollments,
      failedPayments,
      topClasses,
      trialRequests,
      newEnrollments,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paid_at: { gte: from, lte: to } },
        _sum: { amount_tiyin: true },
      }),
      this.prisma.user.count({ where: { role: 'STUDENT', created_at: { gte: from, lte: to } } }),
      this.prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.enrollment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({
        where: { status: 'FAILED', created_at: { gte: from, lte: to } },
      }),
      this.prisma.class.findMany({
        where: { is_active: true },
        select: {
          title: true,
          level: true,
          price_uzs: true,
          language: { select: { name_ru: true, flag_emoji: true } },
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { enrollments: { _count: 'desc' } },
        take: 5,
      }),
      this.prisma.trialLessonRequest.count({ where: { created_at: { gte: from, lte: to } } }),
      this.prisma.enrollment.count({ where: { enrolled_at: { gte: from, lte: to } } }),
    ]);

    // Выручка за 30д (для сравнения — всегда фиксированный период)
    const revMonth30 = await this.prisma.payment.aggregate({
      where: { status: 'PAID', paid_at: { gte: monthAgo, lte: to } },
      _sum: { amount_tiyin: true },
    });

    const toUzs = (t: bigint | null | undefined) => (t ? Math.round(Number(t) / 100) : 0);

    return {
      from,
      to,
      revenue: toUzs(revenueRow._sum.amount_tiyin),
      revenue30d: toUzs(revMonth30._sum.amount_tiyin),
      newStudents,
      activeEnrollments,
      pendingEnrollments,
      failedPayments,
      trialRequests,
      newEnrollments,
      topClasses,
    };
  }

  // ─── PDF builder ───────────────────────────────────────────────────────────

  private buildPdf(
    stats: Awaited<ReturnType<typeof this.collectStats>>,
    label: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register Roboto — full Unicode / Cyrillic support
      doc.registerFont('R', FONT_REGULAR);
      doc.registerFont('B', FONT_BOLD);

      const gray = '#555555';
      const accent = '#6C5CE7';

      // ── Header ─────────────────────────────────────────────────────────────
      doc
        .font('B')
        .fontSize(20)
        .fillColor('#000')
        .text('LinguoLab — ' + label, { align: 'center' });
      doc
        .font('R')
        .fontSize(11)
        .fillColor(gray)
        .text(`${fmtDate(stats.from)} — ${fmtDate(stats.to)}`, { align: 'center' });
      doc.moveDown(1.5);

      // ── Divider ────────────────────────────────────────────────────────────
      const divider = () => {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#EEEEEE').lineWidth(1).stroke();
        doc.moveDown(0.5);
      };

      const section = (title: string) => {
        doc.moveDown(0.5);
        divider();
        doc.font('B').fontSize(13).fillColor(accent).text(title);
        doc.font('R').fontSize(11).fillColor('#000');
      };

      const row = (label2: string, value: string) => {
        const y = doc.y;
        doc.font('R').fillColor(gray).text(label2, { continued: false, width: 280 });
        doc.font('B').fillColor('#000').text(value, 280, y, { width: 265, align: 'right' });
      };

      // ── Финансы ────────────────────────────────────────────────────────────
      section('Финансы');
      row(`Выручка за период:`, fmtUzs(stats.revenue));
      row(`Выручка за 30 дней:`, fmtUzs(stats.revenue30d));
      row(`Неудавших платежей за период:`, String(stats.failedPayments));

      // ── Студенты ───────────────────────────────────────────────────────────
      section('Студенты и записи');
      row('Новых студентов за период:', String(stats.newStudents));
      row('Активных записей (всего):', String(stats.activeEnrollments));
      row('Ожидают подтверждения:', String(stats.pendingEnrollments));
      row('Новых записей за период:', String(stats.newEnrollments));
      row('Заявок на пробный урок:', String(stats.trialRequests));

      // ── Топ классов ────────────────────────────────────────────────────────
      section('Топ-5 классов по студентам');
      stats.topClasses.forEach((cls, i) => {
        const count = cls._count.enrollments;
        const price = fmtUzs(cls.price_uzs);
        doc
          .font('R')
          .fillColor('#000')
          .text(`${i + 1}. ${cls.language.flag_emoji} ${cls.title} (${cls.level})`, {
            continued: true,
            width: 360,
          })
          .font('B')
          .text(`  ${count} студ. · ${price}/мес`, { align: 'right' });
      });

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.moveDown(2);
      divider();
      doc
        .font('R')
        .fontSize(9)
        .fillColor('#AAAAAA')
        .text(`Отчёт сгенерирован автоматически · LinguoLab · ${new Date().toISOString()}`, {
          align: 'center',
        });

      doc.end();
    });
  }

  // ─── Storage helper ────────────────────────────────────────────────────────

  private async uploadPdf(key: string, buffer: Buffer): Promise<string> {
    const uploadUrl = await this.storage.presignedUpload(key, 'application/pdf', 300);
    await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(buffer),
      headers: { 'Content-Type': 'application/pdf' },
    });
    return this.storage.publicUrl(key);
  }
}
