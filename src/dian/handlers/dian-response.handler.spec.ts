import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DianResponseHandler } from './dian-response.handler';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { DianSendResult } from '../api/dian-api.service';

describe('DianResponseHandler', () => {
  let handler: DianResponseHandler;
  let prismaInvoiceUpdate: jest.Mock;
  let prismaDianDocUpdate: jest.Mock;
  let prismaDianEventCreate: jest.Mock;
  let prismaTransaction: jest.Mock;
  let historyCreate: jest.Mock;

  beforeEach(async () => {
    prismaInvoiceUpdate = jest.fn().mockResolvedValue({});
    prismaDianDocUpdate = jest.fn().mockResolvedValue({});
    prismaDianEventCreate = jest.fn().mockResolvedValue({});
    prismaTransaction = jest.fn().mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)({}),
    );
    historyCreate = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianResponseHandler,
        {
          provide: PrismaService,
          useValue: {
            $transaction: prismaTransaction,
            invoice: { update: prismaInvoiceUpdate },
            dianDocument: { update: prismaDianDocUpdate },
            dianEvent: { create: prismaDianEventCreate },
          },
        },
        {
          provide: getModelToken('DianHistory'),
          useValue: { create: historyCreate },
        },
      ],
    }).compile();

    handler = module.get<DianResponseHandler>(DianResponseHandler);
  });

  it('debe estar definido', () => {
    expect(handler).toBeDefined();
  });

  describe('handle - ACEPTADO', () => {
    it('actualiza Invoice a ACEPTADA, DianDocument con statusDian y crea DianEvent ACEPTACION', async () => {
      const result: DianSendResult = {
        success: true,
        statusDian: 'ACEPTADO',
        isValid: true,
        responsePayload: '{}',
      };
      const out = await handler.handle('company-1', 'inv-1', 'doc-1', result, '<xml/>');
      expect(out.invoiceStatus).toBe('ACEPTADA');
      expect(out.statusDian).toBe('ACEPTADO');
      expect(prismaInvoiceUpdate).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'ACEPTADA' },
      });
      expect(prismaDianDocUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          statusDian: 'ACEPTADO',
          isValid: true,
          sentAt: expect.any(Date),
        }),
      });
      expect(prismaDianEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-1',
          invoiceId: 'inv-1',
          eventType: 'ACEPTACION',
        }),
      });
      expect(historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          invoiceId: 'inv-1',
          dianDocumentId: 'doc-1',
          statusDian: 'ACEPTADO',
          isValid: true,
        }),
      );
    });
  });

  describe('handle - RECHAZADO', () => {
    it('actualiza Invoice a RECHAZADA y crea evento RECHAZO', async () => {
      const result: DianSendResult = {
        success: false,
        statusDian: 'RECHAZADO',
        message: 'Error validación',
      };
      const out = await handler.handle('company-1', 'inv-1', 'doc-1', result, '<xml/>');
      expect(out.invoiceStatus).toBe('RECHAZADA');
      expect(out.statusDian).toBe('RECHAZADO');
      expect(prismaInvoiceUpdate).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'RECHAZADA' },
      });
      expect(prismaDianEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventType: 'RECHAZO' }),
      });
      expect(historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ statusDian: 'RECHAZADO' }),
      );
    });
  });

  describe('handle - PENDIENTE / ENVIADA', () => {
    it('cuando statusDian no es ACEPTADO ni RECHAZADO deja Invoice ENVIADA y evento NOTIFICACION', async () => {
      const result: DianSendResult = { success: true, statusDian: 'PENDIENTE' };
      const out = await handler.handle('company-1', 'inv-1', 'doc-1', result, '<xml/>');
      expect(out.invoiceStatus).toBe('ENVIADA');
      expect(out.statusDian).toBe('PENDIENTE');
      expect(prismaDianEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventType: 'NOTIFICACION' }),
      });
    });
  });

  describe('dian_history', () => {
    it('guarda xmlSent truncado a 50000 caracteres', async () => {
      const longXml = 'x'.repeat(60000);
      await handler.handle('company-1', 'inv-1', 'doc-1', { success: true }, longXml);
      expect(historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ xmlSent: longXml.slice(0, 50000) }),
      );
    });
  });
});
