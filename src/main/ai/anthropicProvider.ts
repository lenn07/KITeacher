/**
 * Anthropic-Implementierung des `AIProvider`-Interfaces (Etappe 5 + 6).
 *
 * Kapselt das `@anthropic-ai/sdk`. Der Verbindungstest ruft die Modelle-Liste
 * der API ab (`GET /v1/models`): das prüft den API-Key, ohne Tokens zu
 * verbrauchen, und stellt zugleich sicher, dass das gewählte Modell verfügbar
 * ist. `explainPage` schickt das Seitenbild per Vision an Claude und liefert den
 * reinen Erklärtext zurück.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AIProviderConfig, ChatOptions, ExplainPageOptions } from './aiProvider'
import {
  buildChatContextText,
  buildChatSystemPrompt,
  buildExplanationSystemPrompt,
  CHAT_CONTEXT_ACK,
  CHAT_MAX_TOKENS,
  EXPLANATION_MAX_TOKENS,
  EXPLANATION_USER_PROMPT
} from './prompts'

/** Fügt die Text-Blöcke einer Antwort zusammen (ignoriert andere Block-Typen). */
function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

export const anthropicProvider: AIProvider = {
  async testConnection({ apiKey, model }: AIProviderConfig): Promise<void> {
    const client = new Anthropic({ apiKey })
    // Wirft bei ungültigem Key (401) bzw. unbekanntem Modell (404) – die
    // Fehlerübersetzung übernimmt der IPC-Handler.
    await client.models.retrieve(model)
  },

  async explainPage(
    { apiKey, model }: AIProviderConfig,
    { image, level }: ExplainPageOptions
  ): Promise<string> {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model,
      max_tokens: EXPLANATION_MAX_TOKENS,
      system: buildExplanationSystemPrompt(level),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64 }
            },
            { type: 'text', text: EXPLANATION_USER_PROMPT }
          ]
        }
      ]
    })

    const text = extractText(response)
    if (!text) throw new Error('Die KI hat keinen Text zurückgegeben.')
    return text
  },

  async chat(
    { apiKey, model }: AIProviderConfig,
    { image, explanation, level, history }: ChatOptions
  ): Promise<string> {
    const client = new Anthropic({ apiKey })

    // Erster Turn liefert das Seitenbild + Erklärtext als Kontext; ein kurzer
    // Bestätigungs-Turn der KI hält den anschließenden echten Verlauf sauber.
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.base64 }
          },
          { type: 'text', text: buildChatContextText(explanation) }
        ]
      },
      { role: 'assistant', content: CHAT_CONTEXT_ACK },
      ...history.map((turn) => ({ role: turn.role, content: turn.content }))
    ]

    const response = await client.messages.create({
      model,
      max_tokens: CHAT_MAX_TOKENS,
      system: buildChatSystemPrompt(level),
      messages
    })

    const text = extractText(response)
    if (!text) throw new Error('Die KI hat keinen Text zurückgegeben.')
    return text
  }
}

export { Anthropic }
