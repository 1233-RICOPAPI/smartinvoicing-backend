import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../src/common/guards/company-access.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AiController } from '../src/modules/ai/ai.controller';
import { CopilotService } from '../src/modules/ai/services/copilot.service';

/**
 * E2E: POST /ai/copilot/query
 * - Sin token -> 401
 * - Con guards y servicio mock -> 200 y body con answer/data
 */
describe('AiController Copilot (e2e)', () => {
  let app: INestApplication;
  const mockUser = { id: 'e2e-user-id', companyId: 'e2e-company-id' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: CopilotService,
          useValue: {
            query: jest.fn().mockResolvedValue({
              answer: 'En el período consultado el IVA generado fue $190.000.',
              data: { totalIva: 190000, from: '2025-02-01', to: '2025-02-28' },
              intent: 'TAX_SUMMARY',
              conversationId: 'conv-1',
              from: '2025-02-01',
              to: '2025-02-28',
            }),
          },
        },
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

  describe('POST /ai/copilot/query', () => {
    it('sin Authorization retorna 401', async () => {
      const mod = await Test.createTestingModule({
        controllers: [AiController],
        providers: [{ provide: CopilotService, useValue: {} }],
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
        .post('/ai/copilot/query')
        .send({ query: '¿Cuánto IVA generé este mes?' })
        .set('Content-Type', 'application/json')
        .expect(401);
      await noAuthApp.close();
    });

    it('con token y query retorna respuesta Copilot (mock)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/copilot/query')
        .set('Authorization', 'Bearer fake-jwt')
        .set('X-Company-Id', mockUser.companyId)
        .set('Content-Type', 'application/json')
        .send({ query: '¿Cuánto IVA generé este mes?' })
        .expect(201);
      expect(res.body).toHaveProperty('answer');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('intent');
      expect(res.body.answer).toContain('IVA');
    });
  });
});
