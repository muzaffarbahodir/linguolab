import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Генерирует PDF-сертификат, загружает в R2, сохраняет запись.
   * Вызывается менеджером после завершения курса студентом.
   */
  async issue(studentId: string, classId: string) {
    // Проверка дубля
    const existing = await this.prisma.certificate.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (existing) throw new ConflictException('Certificate already issued');

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

    const key = `certificates/${studentId}/${randomUUID()}.pdf`;

    // Загружаем через S3 PutObject напрямую (не presigned — серверная загрузка)
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { ConfigService } = await import('@nestjs/config');

    // Используем storage service endpoint через storage service
    const uploadUrl = await this.storage.presignedUpload(key, 'application/pdf', 300);

    // Server-side upload через fetch на presigned URL
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Uint8Array(pdfBuffer),
    });
    if (!resp.ok) throw new Error(`R2 upload failed: ${resp.status}`);

    const fileUrl = this.storage.publicUrl(key);

    const cert = await this.prisma.certificate.create({
      data: { student_id: studentId, class_id: classId, file_key: key, file_url: fileUrl },
    });

    // Уведомляем студента
    void this.notifications.scheduleCertificateIssued(studentId, cls.title, cert.id);

    return cert;
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
