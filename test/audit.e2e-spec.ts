import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../src/common/guards/company-access.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AuditController } from '../src/modules/audit/audit.controller';
import { DianAuditService, DianHistoryResult } from '../src/modules/audit/services/dian-audit.service';
import { AuditExportService } from '../src/modules/audit/services/audit-export.service';

/**
 * E2E: GET /audit/dian/:invoiceId/history
 * - Sin token -> 401
 * - Con guards y servicio mock -> 200 y body con entries
 */
describe('AuditController (e2e)', () => {
  let app: INestApplication;
  const mockUser = { id: 'e2e-user-id', companyId: 'e2e-company-id' };
  const mockHistory: DianHistoryResult = {
    invoiceId: 'inv-1',
    fullNumber: 'SETP80000001',
    cufe: 'CUFE96',
    status: 'ACEPTADA',
    statusDian: 'ACEPTADO',
    entries: [
      { at: '2025-02-03T10:00:00Z', type: 'ENVIO', description: 'Envío a DIAN', source: 'dian_event' },
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: DianAuditService,
          useValue: { getDianHistory: jest.fn().mockResolvedValue(mockHistory) },
        },
        { provide: AuditExportService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .overrideGuard(CompanyAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /audit/dian/:invoiceId/history', () => {
    it('sin Authorization retorna 401', async () => {
      const mod = await Test.createTestingModule({
        controllers: [AuditController],
        providers: [
          { provide: DianAuditService, useValue: {} },
          { provide: AuditExportService, useValue: {} },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => { throw new UnauthorizedException(); } })
        .overrideGuard(CompanyAccessGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();
      const noAuthApp = mod.createNestApplication();
      await noAuthApp.init();
      await request(noAuthApp.getHttpServer())
        .get('/audit/dian/inv-1/history')
        .expect(401);
      await noAuthApp.close();
    });

    it('con token retorna historial DIAN (mock)', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit/dian/inv-1/history')
        .set('Authorization', 'Bearer fake-jwt')
        .set('X-Company-Id', mockUser.companyId)
        .expect(200);
      expect(res.body).toHaveProperty('invoiceId', 'inv-1');
      expect(res.body).toHaveProperty('fullNumber', 'SETP80000001');
      expect(res.body).toHaveProperty('status', 'ACEPTADA');
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body.entries.length).toBeGreaterThan(0);
    });
  });
});
