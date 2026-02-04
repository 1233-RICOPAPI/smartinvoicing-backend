import { Test, TestingModule } from '@nestjs/testing';
import { DianAuditService, DIAN_AUDIT_ACTIONS } from './dian-audit.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import { getModelToken } from '@nestjs/mongoose';

describe('DianAuditService', () => {
  let service: DianAuditService;
  let auditLog: jest.Mock;

  beforeEach(async () => {
    auditLog = jest.fn().mockResolvedValue(undefined);
    const mockAuditService = { log: auditLog };
    const mockPrisma = {};
    const mockDianHistoryModel = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianAuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: getModelToken('DianHistory'), useValue: mockDianHistoryModel },
      ],
    }).compile();

    service = module.get<DianAuditService>(DianAuditService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('logDianAction', () => {
    it('debe llamar a auditService.log con los parámetros correctos', async () => {
      await service.logDianAction({
        companyId: 'company-1',
        userId: 'user-1',
        action: DIAN_AUDIT_ACTIONS.DIAN_ENVIO,
        entity: 'Invoice',
        entityId: 'inv-1',
        payload: { success: true },
      });
      expect(auditLog).toHaveBeenCalledWith({
        companyId: 'company-1',
        userId: 'user-1',
        action: DIAN_AUDIT_ACTIONS.DIAN_ENVIO,
        entity: 'Invoice',
        entityId: 'inv-1',
        payload: { success: true },
        ip: undefined,
        userAgent: undefined,
      });
    });
  });

  describe('DIAN_AUDIT_ACTIONS', () => {
    it('debe exportar las acciones esperadas', () => {
      expect(DIAN_AUDIT_ACTIONS.DIAN_ENVIO).toBe('DIAN_ENVIO');
      expect(DIAN_AUDIT_ACTIONS.DIAN_REINTENTO).toBe('DIAN_REINTENTO');
      expect(DIAN_AUDIT_ACTIONS.AJUSTE_CONTABLE).toBe('AJUSTE_CONTABLE');
    });
  });
});
