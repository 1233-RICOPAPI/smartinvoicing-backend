import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CufeService } from './cufe.service';
import { buildAndComputeCufe } from '../utils/cufe.builder';

/**
 * Validación explícita del CUFE según Anexo Técnico DIAN.
 * Campos obligatorios + opcionales (softwareId, documentTypeCode, environmentCode).
 */
describe('CufeService', () => {
  let service: CufeService;

  const paramsObligatorios = {
    invoiceNumber: 'SETP80000001',
    issueDate: '2025-02-03',
    issueTime: '14:30:00-05:00',
    taxExclusiveAmount: 1000000,
    mainTaxCode: '01',
    taxAmount: 190000,
    totalAmount: 1190000,
    issuerNit: '900123456',
    customerNit: '901234567',
    technicalKey: 'CLAVE_TECNICA_EJEMPLO_12345',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CufeService],
    }).compile();
    service = module.get<CufeService>(CufeService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('CUFE solo campos obligatorios', () => {
    it('genera CUFE de 96 caracteres hexadecimales en mayúsculas', () => {
      const cufe = service.generateCufeExtended(paramsObligatorios);
      expect(cufe).toMatch(/^[0-9A-F]{96}$/);
    });

    it('mismo conjunto de datos produce el mismo CUFE (determinista)', () => {
      const a = service.generateCufeExtended(paramsObligatorios);
      const b = service.generateCufeExtended(paramsObligatorios);
      expect(a).toBe(b);
    });

    it('cambio en cualquier campo obligatorio cambia el CUFE', () => {
      const base = service.generateCufeExtended(paramsObligatorios);
      expect(service.generateCufeExtended({ ...paramsObligatorios, invoiceNumber: 'SETP80000002' })).not.toBe(base);
      expect(service.generateCufeExtended({ ...paramsObligatorios, issueDate: '2025-02-04' })).not.toBe(base);
      expect(service.generateCufeExtended({ ...paramsObligatorios, taxAmount: 200000 })).not.toBe(base);
      expect(service.generateCufeExtended({ ...paramsObligatorios, issuerNit: '900999999' })).not.toBe(base);
      expect(service.generateCufeExtended({ ...paramsObligatorios, technicalKey: 'OTRA_CLAVE' })).not.toBe(base);
    });
  });

  describe('CUFE con campos opcionales', () => {
    it('incluye softwareId cuando se envía', () => {
      const sin = service.generateCufeExtended(paramsObligatorios);
      const con = service.generateCufeExtended({ ...paramsObligatorios, softwareId: 'SOFT-001' });
      expect(con).not.toBe(sin);
    });

    it('incluye documentTypeCode (01 Factura, 04 POS, 91 NC, 92 ND)', () => {
      const c01 = service.generateCufeExtended({ ...paramsObligatorios, documentTypeCode: '01' });
      const c04 = service.generateCufeExtended({ ...paramsObligatorios, documentTypeCode: '04' });
      const c91 = service.generateCufeExtended({ ...paramsObligatorios, documentTypeCode: '91' });
      const c92 = service.generateCufeExtended({ ...paramsObligatorios, documentTypeCode: '92' });
      expect(new Set([c01, c04, c91, c92]).size).toBe(4);
    });

    it('incluye environmentCode (1 producción, 2 pruebas)', () => {
      const prod = service.generateCufeExtended({ ...paramsObligatorios, environmentCode: '1' });
      const hab = service.generateCufeExtended({ ...paramsObligatorios, environmentCode: '2' });
      expect(prod).not.toBe(hab);
    });

    it('todos los opcionales juntos generan un CUFE distinto', () => {
      const soloObl = service.generateCufeExtended(paramsObligatorios);
      const conOpc = service.generateCufeExtended({
        ...paramsObligatorios,
        softwareId: 'ID',
        documentTypeCode: '01',
        environmentCode: '2',
      });
      expect(conOpc).not.toBe(soloObl);
    });
  });

  describe('clave técnica', () => {
    it('lanza BadRequestException si technicalKey está vacía', () => {
      expect(() =>
        service.generateCufeExtended({ ...paramsObligatorios, technicalKey: '' }),
      ).toThrow(BadRequestException);
    });

    it('lanza BadRequestException si technicalKey tiene menos de 4 caracteres', () => {
      expect(() =>
        service.generateCufeExtended({ ...paramsObligatorios, technicalKey: '123' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildConcatenationOnly (auditoría)', () => {
    it('devuelve cadena sin separadores entre campos', () => {
      const concat = service.buildConcatenationOnly(paramsObligatorios as any);
      expect(concat).not.toMatch(/\s/);
      expect(concat).toContain('SETP80000001');
      expect(concat).toContain('2025-02-03');
      expect(concat).toContain(paramsObligatorios.technicalKey);
    });
  });

  describe('consistencia con cufe.builder', () => {
    it('buildAndComputeCufe produce el mismo CUFE que generateCufeExtended', () => {
      const fromService = service.generateCufeExtended(paramsObligatorios);
      const fromBuilder = buildAndComputeCufe({
        ...paramsObligatorios,
        taxExclusiveAmount: String(paramsObligatorios.taxExclusiveAmount),
        taxAmount: String(paramsObligatorios.taxAmount),
        totalAmount: String(paramsObligatorios.totalAmount),
      });
      expect(fromService).toBe(fromBuilder);
    });
  });
});
