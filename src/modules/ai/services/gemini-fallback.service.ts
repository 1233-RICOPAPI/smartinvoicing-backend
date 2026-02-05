import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * Fallback con Google Gemini cuando la pregunta no tiene datos en BD (UNKNOWN/EXPLAIN).
 * Lee GEMINI_API_KEY desde ConfigService (env). Sin key no llama a la API y retorna string vacío.
 */
@Injectable()
export class GeminiFallbackService {
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') ?? process.env.GEMINI_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey?.trim();
  }

  /**
   * Envía el prompt a Gemini y retorna la respuesta en texto.
   * Si no hay API key retorna ''. Si la API falla retorna '' (el Copilot usará su fallback).
   */
  async ask(prompt: string, context?: { companyName?: string }): Promise<string> {
    const key = this.apiKey?.trim();
    if (!key) {
      return '';
    }
    const systemContext = context?.companyName
      ? `Contexto: empresa "${context.companyName}".`
      : 'Contexto: software de facturación electrónica y contabilidad en Colombia.';
    const fullPrompt = `Eres un asistente de facturación electrónica y contabilidad en Colombia. Responde de forma breve y clara en español. ${systemContext} Pregunta del usuario: ${prompt}`;

    try {
      const url = `${GEMINI_API_BASE}?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.4,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[GeminiFallback] API error ${res.status}: ${errText.slice(0, 200)}`);
        return '';
      }

      const data = (await res.json()) as GeminiGenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text ?? '';
    } catch (err) {
      console.warn('[GeminiFallback] Request failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }
}
