import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';

const KEY_PREFIX = 'myr_';
const HASH_ALGORITHM = 'sha256';

@Injectable()
export class DeveloperApiKeysService {
  constructor(private prisma: PrismaService) {}

  private hashKey(key: string): string {
    return crypto.createHash(HASH_ALGORITHM).update(key, 'utf8').digest('hex');
  }

  private generateKey(): string {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${KEY_PREFIX}${random}`;
  }

  async create(companyId: string, name: string): Promise<{ id: string; name: string; key: string; keyPrefix: string }> {
    const key = this.generateKey();
    const keyPrefix = key.slice(0, KEY_PREFIX.length + 8);
    const keyHash = this.hashKey(key);
    const record = await this.prisma.developerApiKey.create({
      data: { companyId, name, keyPrefix, keyHash },
    });
    return { id: record.id, name: record.name, key, keyPrefix: record.keyPrefix };
  }

  async list(companyId: string): Promise<{ id: string; name: string; keyPrefix: string; lastUsedAt: Date | null }[]> {
    const list = await this.prisma.developerApiKey.findMany({
      where: { companyId },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true },
    });
    return list;
  }

  async revoke(companyId: string, id: string): Promise<void> {
    const deleted = await this.prisma.developerApiKey.deleteMany({
      where: { id, companyId },
    });
    if (deleted.count === 0) throw new NotFoundException('API key no encontrada');
  }

  async validateAndGetCompanyId(apiKey: string): Promise<string | null> {
    if (!apiKey.startsWith(KEY_PREFIX)) return null;
    const keyHash = this.hashKey(apiKey);
    const keyPrefix = apiKey.slice(0, KEY_PREFIX.length + 8);
    const record = await this.prisma.developerApiKey.findFirst({
      where: { keyPrefix, keyHash },
    });
    if (!record) return null;
    await this.prisma.developerApiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });
    return record.companyId;
  }
}
