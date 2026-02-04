import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Opción B: cuando GEMINI_API_KEY esté en .env, se puede usar para
 * responder preguntas que no tengan datos en la base (UNKNOWN) o para
 * enriquecer respuestas. Sin API key no se llama a Gemini.
 *
 * Para activar: agregar en .env:
 *   GEMINI_API_KEY=tu_api_key_de_google_ai_studio
 *
 * Luego en este servicio implementar la llamada a la API de Gemini (ej. generateContent)
 * con un prompt que incluya el contexto de la empresa y la pregunta del usuario.
 */
@Injectable()
export class GeminiFallbackService {
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
  }

  isConfigured(): boolean {
    return !!this.apiKey?.trim();
  }

  /**
   * Si Gemini está configurado, intenta obtener una respuesta para preguntas
   * sin datos en BD. Retorna null si no hay key o si falla.
   */
  async ask(question: string, context?: { companyName?: string }): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      // TODO: cuando tengas la API key, descomentar y usar @google/generative-ai o fetch:
      // const { GoogleGenerativeAI } = require('@google/generative-ai');
      // const genAI = new GoogleGenerativeAI(this.apiKey);
      // const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      // const result = await model.generateContent(`Eres un asistente de facturación y contabilidad en Colombia. Responde brevemente en español. Contexto: ${context?.companyName ?? 'Empresa'}. Pregunta: ${question}`);
      // return result.response.text();
      return null;
    } catch {
      return null;
    }
  }
}
