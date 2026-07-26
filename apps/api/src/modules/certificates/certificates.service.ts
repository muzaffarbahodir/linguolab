import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import JSZip from 'jszip';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Ручная выдача (кнопкой). Генерирует ZIP-бандл, загружает в R2, сохраняет запись.
   * Учитель — только для своего класса; менеджер/админ — для любого.
   */
  async issue(studentId: string, classId: string, actor: { id: string; role: Role }) {
    // Учитель вправе выдавать сертификат только по своему классу.
    if (actor.role === Role.TEACHER) {
      const owns = await this.prisma.class.findFirst({
        where: { id: classId, teacher: { user_id: actor.id } },
        select: { id: true },
      });
      if (!owns) throw new ForbiddenException('Not your class');
    }

    // Проверка дубля
    const existing = await this.prisma.certificate.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (existing) throw new ConflictException('Certificate already issued');

    return this.generateAndStore(studentId, classId);
  }

  /**
   * B2 — авто-выдача сертификатов всем завершившим студентам при COMPLETED класса
   * (крон ClassLifecycleService). Идемпотентно (пропускает уже выданные), без auth,
   * без throw (ошибка по одному студенту не роняет остальных / крон).
   * Сертификат получают ACTIVE не-пробные записи (реально проходили курс).
   */
  async issueForCompletedClass(classId: string): Promise<{ issued: number }> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { class_id: classId, status: 'ACTIVE', is_trial: false },
      select: { student_id: true },
    });

    let issued = 0;
    for (const e of enrollments) {
      const existing = await this.prisma.certificate.findUnique({
        where: { student_id_class_id: { student_id: e.student_id, class_id: classId } },
      });
      if (existing) continue;
      try {
        await this.generateAndStore(e.student_id, classId);
        issued++;
      } catch (err) {
        this.logger.error(`cert auto-issue failed (student ${e.student_id}): ${String(err)}`);
      }
    }
    return { issued };
  }

  /**
   * Ядро: PDF → ZIP-бандл → R2 → запись + уведомление. Дубль НЕ проверяет
   * (вызывающий проверяет). Бросает при отсутствии студента/класса или сбое R2.
   */
  private async generateAndStore(studentId: string, classId: string) {
    const [student, cls] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: studentId } }),
      this.prisma.class.findUnique({
        where: { id: classId },
        include: { language: true },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!cls) throw new NotFoundException('Class not found');

    const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ');
    const pdfBuffer = await this.generatePdf(studentName, cls.title, cls.language.name_ru);
    const zipBuffer = await this.buildBundle(pdfBuffer, studentName, cls.title);

    const key = `certificates/${studentId}/${randomUUID()}.zip`;

    // Серверная загрузка через presigned PUT в R2.
    const uploadUrl = await this.storage.presignedUpload(key, 'application/zip', 300);
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: new Uint8Array(zipBuffer),
    });
    if (!resp.ok) throw new Error(`R2 upload failed: ${resp.status}`);

    const fileUrl = this.storage.publicUrl(key);

    const cert = await this.prisma.certificate.create({
      data: { student_id: studentId, class_id: classId, file_key: key, file_url: fileUrl },
    });

    void this.notifications.scheduleCertificateIssued(studentId, cls.title, cert.id);

    void this.analytics.track('certificate_issued', {
      userId: studentId,
      userRole: 'STUDENT',
      entityId: cert.id,
      entityType: 'certificate',
      properties: { class_id: classId, class_title: cls.title },
    });

    return cert;
  }

  /**
   * ZIP-бандл сертификата. Сейчас: реальный PDF + пустые плейсхолдеры под будущие
   * бонусы (промокод, голосовое, фото). Наполним реальным контентом позже —
   * инфраструктура упаковки уже готова, останется положить файлы в bonus/.
   */
  private async buildBundle(
    pdfBuffer: Buffer,
    studentName: string,
    classTitle: string,
  ): Promise<Buffer> {
    const zip = new JSZip();
    zip.file('sertifikat.pdf', pdfBuffer);
    zip.file(
      'README.txt',
      `Сертификат LinguoLab\nСтудент: ${studentName}\nКурс: ${classTitle}\n\n` +
        `В папке bonus/ появятся дополнительные материалы (промокод, аудио, фото).`,
    );
    // Плейсхолдеры под бонусы — пока пустые (наполним при продаже проекта).
    const bonus = zip.folder('bonus');
    bonus?.file('promo-code.txt', '');
    bonus?.file('voice-message.ogg', '');
    bonus?.file('photo.jpg', '');

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /** Мои сертификаты */
  async myCertificates(studentId: string) {
    return this.prisma.certificate.findMany({
      where: { student_id: studentId },
      include: {
        class: { include: { language: { select: { name_ru: true, flag_emoji: true } } } },
      },
      orderBy: { issued_at: 'desc' },
    });
  }

  private generatePdf(studentName: string, classTitle: string, language: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Фон
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F8F7FF');

      // Рамка
      doc
        .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
        .lineWidth(3)
        .strokeColor('#6C5CE7')
        .stroke();

      // Заголовок
      doc
        .fillColor('#6C5CE7')
        .fontSize(36)
        .font('Helvetica-Bold')
        .text('СЕРТИФИКАТ', 0, 80, { align: 'center' });

      doc
        .fillColor('#333')
        .fontSize(16)
        .font('Helvetica')
        .text('Настоящим подтверждается, что', 0, 140, { align: 'center' });

      // Имя студента
      doc
        .fillColor('#1a1a2e')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(studentName, 0, 170, { align: 'center' });

      // Курс
      doc
        .fillColor('#333')
        .fontSize(16)
        .font('Helvetica')
        .text(`успешно завершил(а) курс`, 0, 220, { align: 'center' });

      doc
        .fillColor('#6C5CE7')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(`"${classTitle}" — ${language}`, 0, 250, { align: 'center' });

      // Дата
      const date = new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      doc
        .fillColor('#666')
        .fontSize(13)
        .font('Helvetica')
        .text(`LinguoLab  •  ${date}`, 0, 330, { align: 'center' });

      doc.end();
    });
  }
}
