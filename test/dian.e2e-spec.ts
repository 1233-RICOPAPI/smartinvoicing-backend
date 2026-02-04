import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../src/common/guards/company-access.guard';
import { DianController } from '../src/dian/dian.controller';
import { DianService } from '../src/dian/dian.service';
import { PosInvoiceService } from '../src/dian/pos-invoice/pos-invoice.service';
import { FacturaStatusTracker } from '../src/dian/tracker/factura-status.tracker';

/**
 * E2E: POST /dian/invoices/:invoiceId/emit-pos-electronic
 * - Sin token -> 401
 * - Con guards pasando y servicio mock -> 200 y body con success/statusDian
 */
describe('DianController (e2e)', () => {
  let app: INestApplication;
  let emitMock: jest.Mock;

  const mockUser = { id: 'e2e-user-id', companyId: 'e2e-company-id' };

  beforeAll(async () => {
    emitMock = jest.fn().mockResolvedValue({
      success: true,
      invoiceId: 'inv-pos-1',
      statusDian: 'ACEPTADO',
      cufe: 'CUFE_TEST',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DianController],
      providers: [
        { provide: DianService, useValue: {} },
        {
          provide: PosInvoiceService,
          useValue: { emitElectronicInvoice: emitMock },
        },
        { provide: FacturaStatusTracker, useValue: {} },
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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /dian/invoices/:invoiceId/emit-pos-electronic', () => {
    it('sin Authorization retorna 401', async () => {
      const mod = await Test.createTestingModule({
        controllers: [DianController],
        providers: [
          { provide: DianService, useValue: {} },
          { provide: PosInvoiceService, useValue: {} },
          { provide: FacturaStatusTracker, useValue: {} },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => { throw new UnauthorizedException(); } })
        .overrideGuard(CompanyAccessGuard)
        .useValue({ canActivate: () => true })
        .compile();
      const noAuthApp = mod.createNestApplication();
      await noAuthApp.init();
      await request(noAuthApp.getHttpServer())
        .post('/dian/invoices/inv-123/emit-pos-electronic')
        .expect(401);
      await noAuthApp.close();
    });

    it('con token y company emite POS electrónico (mock) y retorna 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/dian/invoices/inv-pos-1/emit-pos-electronic')
        .set('Authorization', 'Bearer fake-jwt')
        .set('X-Company-Id', mockUser.companyId)
        .expect(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('statusDian', 'ACEPTADO');
      expect(res.body).toHaveProperty('invoiceId', 'inv-pos-1');
      expect(emitMock).toHaveBeenCalledWith(mockUser.companyId, 'inv-pos-1');
    });
  });
});
