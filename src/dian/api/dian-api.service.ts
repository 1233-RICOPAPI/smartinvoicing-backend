import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DianSendResult {
  success: boolean;
  statusCode?: string;
  message?: string;
  responsePayload?: string;
  isValid?: boolean;
  statusDian?: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE';
  xmlResponse?: string;
}

/** Token en memoria (sin Redis). En producción considerar cache por empresa. */
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 min

/** Solo para tests: limpia el token en memoria. */
export function clearDianTokenCache(): void {
  cachedToken = null;
}

/**
 * Servicio de envío a la DIAN (Proveedor Tecnológico o Desarrollador Propio).
 * OAuth2 con client_id/client_secret; registro de eventos en DianEvent lo hace el llamador.
 */
@Injectable()
export class DianApiService {
  constructor(private config: ConfigService) {}

  /**
   * Obtiene token de acceso DIAN (OAuth2 client credentials).
   * Sin Redis: se cachea en memoria con TTL corto.
   */
  async getToken(): Promise<string | null> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token;
    }
    const clientId = this.config.get('DIAN_CLIENT_ID');
    const clientSecret = this.config.get('DIAN_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    const baseUrl = this.config.get('DIAN_API_URL', 'https://vpfe-hab.dian.gov.co');
    const tokenUrl = `${baseUrl.replace(/\/$/, '')}/GetToken`;
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { access_token?: string; Token?: string; expires_in?: number };
      const token = data?.access_token ?? data?.Token;
      if (token) {
        const expiresIn = (data?.expires_in ?? 3600) * 1000;
        cachedToken = { token, expiresAt: Date.now() + Math.min(expiresIn, TOKEN_TTL_MS) };
        return token;
      }
    } catch {
      cachedToken = null;
    }
    return null;
  }

  /**
   * Envía el XML firmado a la DIAN.
   * Incluye Authorization Bearer si hay token configurado.
   */
  async sendDocument(_companyId: string, xmlContent: string): Promise<DianSendResult> {
    const baseUrl = this.config.get('DIAN_API_URL', 'https://vpfe-hab.dian.gov.co');
    const url = `${baseUrl.replace(/\/$/, '')}/SendBillSync`;

    try {
      const token = await this.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/xml' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: xmlContent,
      });

      const status = response.status;
      const raw = await response.text();
      const data = raw.startsWith('{') ? raw : JSON.stringify(raw);

      if (status >= 200 && status < 300) {
        const { isValid, statusDian } = this.parseDianSuccessResponse(data);
        return {
          success: true,
          responsePayload: data,
          isValid,
          statusDian,
          xmlResponse: data,
        };
      }

      return {
        success: false,
        statusCode: String(status),
        message: this.parseDianErrorMessage(data),
        responsePayload: data,
        statusDian: 'RECHAZADO',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión con la DIAN';
      return {
        success: false,
        message,
        responsePayload: undefined,
        statusDian: 'PENDIENTE',
      };
    }
  }

  private parseDianSuccessResponse(payload: string): { isValid: boolean; statusDian: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE' } {
    const upper = payload.toUpperCase();
    if (upper.includes('ACEPTADO') || upper.includes('ACCEPTED')) return { isValid: true, statusDian: 'ACEPTADO' };
    if (upper.includes('RECHAZADO') || upper.includes('REJECTED')) return { isValid: false, statusDian: 'RECHAZADO' };
    return { isValid: false, statusDian: 'PENDIENTE' };
  }

  private parseDianErrorMessage(payload: string): string {
    try {
      const obj = JSON.parse(payload);
      const msg = obj?.ErrorMessage ?? obj?.message ?? obj?.Message ?? obj?.error_description;
      if (msg) return String(msg).slice(0, 500);
    } catch {
      // no JSON
    }
    const lower = payload.toLowerCase();
    if (lower.includes('codigo') || lower.includes('message')) return payload.slice(0, 500);
    return payload.slice(0, 300);
  }
}
