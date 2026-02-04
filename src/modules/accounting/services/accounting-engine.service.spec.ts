import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountingEngineService } from './accounting-engine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AccountingDocumentType } from '../enums/document-type.enum';
import { ACCOUNT_KEYS } from '../constants/account-keys';

describe('AccountingEngineService', () => {
  let service: AccountingEngineService;
  let prismaFindMany: jest.Mock;

  const mockMapping = (key: string, id: string) => ({
    companyId: 'company-1',
    accountKey: key,
    accountId: id,
    account: { id, code: key.slice(0, 6), name: key },
  });

  const baseDto = {
    documentType: AccountingDocumentType.FACTURA_VENTA,
    documentNumber: 'SETP80000001',
    date: '2025-02-03',
    subtotal: 1_000_000,
    taxAmount: 190_000,
    total: 1_190_000,
  };

  beforeEach(async () => {
    prismaFindMany = jest.fn().mockResolvedValue([
      mockMapping(ACCOUNT_KEYS.CLIENTES_NACIONALES, 'acc-cli'),
      mockMapping(ACCOUNT_KEYS.INGRESOS_VENTAS, 'acc-ing'),
      mockMapping(ACCOUNT_KEYS.IVA_GENERADO, 'acc-iva'),
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingEngineService,
        {
          provide: PrismaService,
          useValue: {
            companyAccountMapping: { findMany: prismaFindMany },
          },
        },
      ],
    }).compile();

    service = module.get<AccountingEngineService>(AccountingEngineService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('generateJournalEntry - FACTURA_VENTA', () => {
    it('genera asiento con partida doble (débitos = créditos)', async () => {
      const entry = await service.generateJournalEntry('company-1', baseDto as any);
      expect(entry.companyId).toBe('company-1');
      expect(entry.documentType).toBe('FACTURA_VENTA');
      expect(entry.documentNumber).toBe(baseDto.documentNumber);
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBe(baseDto.total);
    });

    it('incluye líneas de clientes, ingresos e IVA', async () => {
      const entry = await service.generateJournalEntry('company-1', baseDto as any);
      const accounts = entry.lines.map((l) => l.accountId);
      expect(accounts).toContain('acc-cli');
      expect(accounts).toContain('acc-ing');
      expect(accounts).toContain('acc-iva');
    });
  });

  describe('generateJournalEntry - retenciones', () => {
    it('solicita mapeo de RETENCION_FUENTE cuando retentionSource > 0', async () => {
      prismaFindMany.mockResolvedValue([
        mockMapping(ACCOUNT_KEYS.CLIENTES_NACIONALES, 'acc-cli'),
        mockMapping(ACCOUNT_KEYS.INGRESOS_VENTAS, 'acc-ing'),
        mockMapping(ACCOUNT_KEYS.IVA_GENERADO, 'acc-iva'),
        mockMapping(ACCOUNT_KEYS.RETENCION_FUENTE, 'acc-ret'),
      ]);
      const dto = { ...baseDto, retentionSource: 50_000 };
      const entry = await service.generateJournalEntry('company-1', dto as any);
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });
  });

  describe('generateJournalEntry - FACTURA_POS', () => {
    it('solicita CAJA, INGRESOS_VENTAS, IVA_GENERADO', async () => {
      prismaFindMany.mockResolvedValue([
        mockMapping(ACCOUNT_KEYS.CAJA, 'acc-caja'),
        mockMapping(ACCOUNT_KEYS.INGRESOS_VENTAS, 'acc-ing'),
        mockMapping(ACCOUNT_KEYS.IVA_GENERADO, 'acc-iva'),
      ]);
      const dto = {
        ...baseDto,
        documentType: AccountingDocumentType.FACTURA_POS,
      };
      const entry = await service.generateJournalEntry('company-1', dto as any);
      expect(entry.documentType).toBe('FACTURA_POS');
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });
  });

  describe('generateJournalEntry - falta mapeo', () => {
    it('lanza BadRequestException cuando falta cuenta requerida', async () => {
      prismaFindMany.mockResolvedValue([]);
      await expect(service.generateJournalEntry('company-1', baseDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
