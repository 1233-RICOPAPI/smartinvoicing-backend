import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AccountingController } from './accounting.controller';
import { AccountingEngineService } from './services/accounting-engine.service';
import { DianAuditService, DIAN_AUDIT_ACTIONS } from '../audit/services/dian-audit.service';
import { AccountingDocumentType } from './enums/document-type.enum';
import { GenerateEntryDto } from './dtos/generate-entry.dto';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Escenario crítico certificación: ajuste contable debe registrar auditoría DIAN.
 */
describe('AccountingController', () => {
  let controller: AccountingController;
  let dianAuditLog: jest.Mock;

  const companyId = 'company-1';
  const dto: GenerateEntryDto = {
    documentType: AccountingDocumentType.FACTURA_VENTA,
    documentNumber: 'SETP80000001',
    date: '2025-02-03',
    subtotal: 1_000_000,
    taxAmount: 190_000,
    total: 1_190_000,
    documentId: 'invoice-id-123',
  };

  beforeEach(async () => {
    dianAuditLog = jest.fn().mockResolvedValue(undefined);
    const persistMock = jest.fn().mockResolvedValue({
      journalEntryId: 'je-1',
      linesCreated: 3,
    });
    const generateMock = jest.fn().mockResolvedValue({
      companyId,
      documentType: 'FACTURA_VENTA',
      documentNumber: dto.documentNumber,
      lines: [
        { accountId: 'a1', debit: 1_190_000, credit: 0 },
        { accountId: 'a2', debit: 0, credit: 1_000_000 },
        { accountId: 'a3', debit: 0, credit: 190_000 },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountingController],
      providers: [
        {
          provide: AccountingEngineService,
          useValue: {
            generateJournalEntry: generateMock,
            persistJournalEntry: persistMock,
          },
        },
        {
          provide: DianAuditService,
          useValue: { logDianAction: dianAuditLog },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CompanyAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccountingController>(AccountingController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('generateAndPersist con documentId', () => {
    it('registra auditoría DIAN con acción AJUSTE_CONTABLE cuando hay documentId', async () => {
      const req = {
        user: { id: 'user-1' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        get: () => undefined,
      } as unknown as Request;
      await controller.generateAndPersist(companyId, dto, req);
      expect(dianAuditLog).toHaveBeenCalledTimes(1);
      expect(dianAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          userId: 'user-1',
          action: DIAN_AUDIT_ACTIONS.AJUSTE_CONTABLE,
          entity: 'Invoice',
          entityId: dto.documentId,
          payload: expect.objectContaining({
            journalEntryId: 'je-1',
            documentNumber: dto.documentNumber,
          }),
        }),
      );
    });

    it('no registra auditoría cuando documentId no está presente', async () => {
      const req = { user: { id: 'user-1' }, ip: null, socket: {}, get: () => undefined } as unknown as Request;
      const dtoSinDoc = { ...dto, documentId: undefined };
      await controller.generateAndPersist(companyId, dtoSinDoc as GenerateEntryDto, req);
      expect(dianAuditLog).not.toHaveBeenCalled();
    });
  });
});
