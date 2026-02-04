import { Test, TestingModule } from '@nestjs/testing';
import { IntentParserService } from './intent-parser.service';
import { COPILOT_INTENTS } from '../constants/intents';

describe('IntentParserService', () => {
  let service: IntentParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntentParserService],
    }).compile();
    service = module.get<IntentParserService>(IntentParserService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('parse - intents fiscales', () => {
    it('detecta TAX_IVA_DUE para "¿Cuánto debo pagar de IVA este mes?"', () => {
      const r = service.parse('¿Cuánto debo pagar de IVA este mes?');
      expect(r.intent).toBe(COPILOT_INTENTS.TAX_IVA_DUE);
      expect(r.from).toBeDefined();
      expect(r.to).toBeDefined();
    });

    it('detecta TAX_RETENTIONS_BY_INVOICE cuando hay referencia a factura y retenciones', () => {
      const r = service.parse('Explícame mis retenciones de fuente e ICA por factura SETP80000001');
      expect(r.intent).toBe(COPILOT_INTENTS.TAX_RETENTIONS_BY_INVOICE);
      expect(r.invoiceRef).toBeDefined();
    });

    it('detecta TAX_INSISTENCIES_SANCTIONS para inconsistencias fiscales', () => {
      const r = service.parse('Detecta posibles sanciones fiscales');
      expect(r.intent).toBe(COPILOT_INTENTS.TAX_INSISTENCIES_SANCTIONS);
    });
  });

  describe('parse - intents existentes', () => {
    it('detecta BALANCE', () => {
      expect(service.parse('Balance general').intent).toBe(COPILOT_INTENTS.BALANCE);
    });
    it('detecta TAX_SUMMARY para IVA genérico', () => {
      expect(service.parse('Resumen de IVA este mes').intent).toBe(COPILOT_INTENTS.TAX_SUMMARY);
    });
    it('detecta ANOMALIES', () => {
      expect(service.parse('¿Hay anomalías?').intent).toBe(COPILOT_INTENTS.ANOMALIES);
    });
  });

  describe('extractInvoiceRef (vía parse)', () => {
    it('extrae número tipo SETP80000001', () => {
      const r = service.parse('Retenciones factura SETP80000001');
      expect(r.invoiceRef).toMatch(/SETP80000001/i);
    });
  });
});
