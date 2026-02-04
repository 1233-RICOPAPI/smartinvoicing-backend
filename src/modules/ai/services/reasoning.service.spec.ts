import { Test, TestingModule } from '@nestjs/testing';
import { ReasoningService } from './reasoning.service';
import { COPILOT_INTENTS } from '../constants/intents';

describe('ReasoningService', () => {
  let service: ReasoningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReasoningService],
    }).compile();
    service = module.get<ReasoningService>(ReasoningService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('TAX_IVA_DUE', () => {
    it('formatea IVA a pagar en lenguaje natural', () => {
      const data = {
        from: '2025-02-01',
        to: '2025-02-28',
        ivaGenerado: 190000,
        ivaDescontable: 50000,
        ivaAPagar: 140000,
        invoiceCount: 10,
      };
      const text = service.formatAnswer(COPILOT_INTENTS.TAX_IVA_DUE, data);
      expect(text).toContain('IVA generado');
      expect(text).toContain('190.000');
      expect(text).toContain('IVA descontable');
      expect(text).toContain('140.000');
    });
  });

  describe('TAX_RETENTIONS_BY_INVOICE', () => {
    it('formatea retenciones por factura', () => {
      const data = {
        fullNumber: 'SETP80000001',
        issueDate: '2025-02-01',
        retenciones: [
          { taxType: 'ReteFuente', rate: 2.5, base: 1000000, amount: 25000 },
          { taxType: 'ReteICA', rate: 1, base: 1000000, amount: 10000 },
        ],
        totalRetenciones: 35000,
      };
      const text = service.formatAnswer(COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE, data);
      expect(text).toContain('SETP80000001');
      expect(text).toContain('ReteFuente');
      expect(text).toContain('35.000');
    });

    it('respuesta cuando no hay factura', () => {
      const data = { message: 'No se encontró la factura "X".' };
      const text = service.formatAnswer(COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE, data);
      expect(text).toBe(data.message);
    });
  });

  describe('TAX_INSISTENCIES_SANCTIONS', () => {
    it('formatea rechazos y anomalías fiscales', () => {
      const data = {
        from: '2025-02-01',
        to: '2025-02-28',
        rejectedInvoicesCount: 2,
        taxRelatedCount: 1,
        anomaliesCount: 3,
      };
      const text = service.formatAnswer(COPILOT_INTENTS.TAX_INSISTENCIES_SANCTIONS, data);
      expect(text).toContain('2 factura(s) rechazada(s)');
      expect(text).toContain('anomalía(s)');
    });
  });
});
