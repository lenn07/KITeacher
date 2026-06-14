/**
 * Anthropic-Implementierung des `AIProvider`-Interfaces (Etappe 5).
 *
 * Kapselt das `@anthropic-ai/sdk`. Der Verbindungstest ruft die Modelle-Liste
 * der API ab (`GET /v1/models`): das prüft den API-Key, ohne Tokens zu
 * verbrauchen, und stellt zugleich sicher, dass das gewählte Modell verfügbar
 * ist. So vermeidet der Test unnötige Kosten beim Einrichten.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AIProviderConfig } from './aiProvider'

export const anthropicProvider: AIProvider = {
  async testConnection({ apiKey, model }: AIProviderConfig): Promise<void> {
    const client = new Anthropic({ apiKey })
    // Wirft bei ungültigem Key (401) bzw. unbekanntem Modell (404) – die
    // Fehlerübersetzung übernimmt der IPC-Handler.
    await client.models.retrieve(model)
  }
}

export { Anthropic }
