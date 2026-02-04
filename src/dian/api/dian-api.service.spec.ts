import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DianApiService, clearDianTokenCache } from './dian-api.service';

const mockFetch = jest.fn();

describe('DianApiService', () => {
  let service: DianApiService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    clearDianTokenCache();
    mockFetch.mockReset();
    configGet = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianApiService,
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();
    service = module.get<DianApiService>(DianApiService);
    (global as any).fetch = mockFetch;
  });

  afterEach(() => {
    clearDianTokenCache();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getToken', () => {
    it('retorna null cuando no hay DIAN_CLIENT_ID ni DIAN_CLIENT_SECRET', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_CLIENT_ID' || key === 'DIAN_CLIENT_SECRET') return undefined;
        return key === 'DIAN_API_URL' ? 'https://vpfe-hab.dian.gov.co' : undefined;
      });
      const token = await service.getToken();
      expect(token).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retorna null cuando la API de token responde con error', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_CLIENT_ID') return 'client';
        if (key === 'DIAN_CLIENT_SECRET') return 'secret';
        if (key === 'DIAN_API_URL') return 'https://vpfe-hab.dian.gov.co';
        return undefined;
      });
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const token = await service.getToken();
      expect(token).toBeNull();
    });

    it('retorna el token cuando la API responde 200 con access_token', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_CLIENT_ID') return 'client';
        if (key === 'DIAN_CLIENT_SECRET') return 'secret';
        if (key === 'DIAN_API_URL') return 'https://vpfe-hab.dian.gov.co';
        return undefined;
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token-123', expires_in: 3600 }),
      });
      const token = await service.getToken();
      expect(token).toBe('token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://vpfe-hab.dian.gov.co/GetToken',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('usa Token (mayúscula) si access_token no viene', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_CLIENT_ID') return 'c';
        if (key === 'DIAN_CLIENT_SECRET') return 's';
        if (key === 'DIAN_API_URL') return 'https://vpfe-hab.dian.gov.co';
        return undefined;
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Token: 'token-mayus', expires_in: 3600 }),
      });
      const token = await service.getToken();
      expect(token).toBe('token-mayus');
    });

    it('segunda llamada usa cache y no vuelve a llamar fetch', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_CLIENT_ID') return 'c';
        if (key === 'DIAN_CLIENT_SECRET') return 's';
        if (key === 'DIAN_API_URL') return 'https://vpfe-hab.dian.gov.co';
        return undefined;
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'cached', expires_in: 3600 }),
      });
      const t1 = await service.getToken();
      const t2 = await service.getToken();
      expect(t1).toBe('cached');
      expect(t2).toBe('cached');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendDocument', () => {
    beforeEach(() => {
      configGet.mockImplementation((key: string) => {
        if (key === 'DIAN_API_URL') return 'https://vpfe-hab.dian.gov.co';
        return undefined;
      });
    });

    it('envía XML con Content-Type application/xml', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('{"IsValid":true,"StatusCode":"00","StatusMessage":"ACEPTADO"}'),
      });
      const result = await service.sendDocument('company-1', '<Invoice/>');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://vpfe-hab.dian.gov.co/SendBillSync',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/xml' }),
          body: '<Invoice/>',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('incluye Authorization Bearer cuando hay token', async () => {
      configGet.mockImplementation((k: string) => (k === 'DIAN_CLIENT_ID' ? 'c' : k === 'DIAN_CLIENT_SECRET' ? 's' : k === 'DIAN_API_URL' ? 'https://vpfe-hab.dian.gov.co' : undefined));
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'tk', expires_in: 3600 }) })
        .mockResolvedValueOnce({ status: 200, text: () => Promise.resolve('ACEPTADO') });
      await service.getToken();
      await service.sendDocument('company-1', '<Invoice/>');
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer tk' }),
        }),
      );
    });

    it('retorna success false y statusDian RECHAZADO cuando status >= 400', async () => {
      mockFetch.mockResolvedValue({
        status: 400,
        text: () => Promise.resolve('{"ErrorMessage":"Documento inválido"}'),
      });
      const result = await service.sendDocument('company-1', '<bad/>');
      expect(result.success).toBe(false);
      expect(result.statusDian).toBe('RECHAZADO');
      expect(result.statusCode).toBe('400');
    });

    it('retorna success false y message en catch de red', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.sendDocument('company-1', '<Invoice/>');
      expect(result.success).toBe(false);
      expect(result.message).toContain('ECONNREFUSED');
      expect(result.statusDian).toBe('PENDIENTE');
    });
  });
});
