import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DianConfigUpdateDto } from './dto/dian-config.dto';

@Injectable()
export class DianConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const config = await this.prisma.dianConfig.findUnique({
      where: { companyId },
    });
    if (!config) {
      return {
        configured: false,
        env: 'habilitacion',
        prefixFe: null,
        prefixPos: null,
        fromNumber: 1,
        softwareId: null,
        softwarePin: null,
        hasCertificate: false,
      };
    }
    return {
      configured: true,
      env: config.env,
      technicalKey: config.technicalKey ?? null,
      prefixFe: config.prefixFe ?? null,
      prefixPos: config.prefixPos ?? null,
      fromNumber: config.fromNumber ?? 1,
      softwareId: config.softwareId ?? null,
      softwarePin: config.softwarePin ? '••••••••' : null,
      hasCertificate: !!config.certEnc,
    };
  }

  async update(companyId: string, dto: DianConfigUpdateDto) {
    const data: Record<string, unknown> = {};
    if (dto.env !== undefined) data.env = dto.env;
    if (dto.technicalKey !== undefined) data.technicalKey = dto.technicalKey;
    if (dto.prefixFe !== undefined) data.prefixFe = dto.prefixFe;
    if (dto.prefixPos !== undefined) data.prefixPos = dto.prefixPos;
    if (dto.fromNumber !== undefined) data.fromNumber = dto.fromNumber;
    if (dto.softwareId !== undefined) data.softwareId = dto.softwareId;
    if (dto.softwarePin !== undefined) data.softwarePin = dto.softwarePin;
    if (dto.certBase64 !== undefined) data.certEnc = dto.certBase64;
    if (dto.certPassword !== undefined) data.certPasswordEnc = dto.certPassword;

    const updated = await this.prisma.dianConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        env: (dto.env as string) ?? 'habilitacion',
        technicalKey: dto.technicalKey ?? null,
        prefixFe: dto.prefixFe ?? null,
        prefixPos: dto.prefixPos ?? null,
        fromNumber: dto.fromNumber ?? 1,
        softwareId: dto.softwareId ?? null,
        softwarePin: dto.softwarePin ?? null,
        certEnc: dto.certBase64 ?? null,
        certPasswordEnc: dto.certPassword ?? null,
      },
      update: data as any,
    });

    return this.get(companyId);
  }
}
