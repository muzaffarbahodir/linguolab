import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('R2_BUCKET_NAME');
    this.cdnUrl = config.getOrThrow<string>('R2_PUBLIC_URL');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: config.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Генерирует presigned PUT URL для прямой загрузки с клиента.
   * TTL 15 минут. Клиент делает PUT на этот URL, затем вызывает confirm.
   */
  async presignedUpload(key: string, contentType: string, ttlSeconds = 900): Promise<string> {
    try {
      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });
      return await getSignedUrl(this.s3, cmd, { expiresIn: ttlSeconds });
    } catch (err) {
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /** Публичный CDN URL по object key */
  publicUrl(key: string): string {
    return `${this.cdnUrl}/${key}`;
  }

  /** Удаляет объект из R2 */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
