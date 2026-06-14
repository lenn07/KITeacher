/**
 * Registriert die IPC-Handler für den seitenbezogenen Chat (Etappe 7).
 *
 * Rückfragen an die KI mit Seitenbild + Erklärtext als Kontext; der Verlauf wird
 * pro Seite gespeichert. Wichtig: Erst nach erfolgreicher KI-Antwort werden
 * Frage UND Antwort gespeichert – schlägt der Aufruf fehl (kein Key, API-Fehler),
 * bleibt der Verlauf unverändert und es entstehen keine „verwaisten" Fragen.
 *
 * Doppelte Kosten ausgeschlossen: Läuft für eine Seite bereits eine Anfrage,
 * wird eine weitere abgelehnt (statt eine zweite API-Anfrage zu starten).
 *
 * Hält die Schichten getrennt: Der Handler übersetzt nur zwischen IPC,
 * Repository, Settings-Store und KI-Provider. Vertrag siehe `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ChatMessage, ChatResult, SendChatMessageInput } from '@shared/domain'
import { chatMessageRepository, pageRepository } from '../db/repositories'
import { settingsStore } from '../settings/settingsStore'
import { anthropicProvider } from '../ai/anthropicProvider'
import { describeAiError } from '../ai/errors'

/** Gerade laufende Chat-Anfragen je Seite (`projectId:pageNumber`). */
const inFlight = new Set<string>()

/** Liefert den gespeicherten Verlauf einer Seite, ohne sie anzulegen. */
function listHistory(projectId: number, pageNumber: number): ChatMessage[] {
  const page = pageRepository.getByNumber(projectId, pageNumber)
  return page ? chatMessageRepository.listByPage(page.id) : []
}

async function send(input: SendChatMessageInput): Promise<ChatResult> {
  const { projectId, pageNumber, message, image } = input

  const text = message.trim()
  if (!text) return { ok: false, message: 'Die Nachricht ist leer.' }

  const apiKey = settingsStore.getApiKey()
  if (!apiKey) {
    return {
      ok: false,
      message: 'Es ist kein API-Key hinterlegt. Bitte in den Einstellungen eintragen.'
    }
  }

  // Seite (und damit ihre id für den Verlauf) sicherstellen; trägt den
  // gecachten Erklärtext als Kontext bei.
  const page = pageRepository.getOrCreate(projectId, pageNumber)
  const previous = chatMessageRepository.listByPage(page.id)

  const { model, explanationLevel } = settingsStore.getSettings()
  try {
    const answer = await anthropicProvider.chat(
      { apiKey, model },
      {
        image,
        explanation: page.explanation,
        level: explanationLevel,
        // Bisheriger Verlauf plus die neue Frage als letzter Turn.
        history: [
          ...previous.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: text }
        ]
      }
    )

    // Erst jetzt – nach erfolgreicher Antwort – Frage und Antwort speichern.
    chatMessageRepository.add({ pageId: page.id, role: 'user', content: text })
    chatMessageRepository.add({ pageId: page.id, role: 'assistant', content: answer })
    return { ok: true, messages: chatMessageRepository.listByPage(page.id) }
  } catch (error) {
    return { ok: false, message: describeAiError(error) }
  }
}

export function registerChatHandlers(): void {
  ipcMain.handle(IpcChannels.chatList, (_event, projectId: number, pageNumber: number) =>
    listHistory(projectId, pageNumber)
  )

  ipcMain.handle(
    IpcChannels.chatSend,
    async (_event, input: SendChatMessageInput): Promise<ChatResult> => {
      const key = `${input.projectId}:${input.pageNumber}`
      if (inFlight.has(key)) {
        return { ok: false, message: 'Für diese Seite läuft bereits eine Anfrage.' }
      }
      inFlight.add(key)
      try {
        return await send(input)
      } finally {
        inFlight.delete(key)
      }
    }
  )

  ipcMain.handle(IpcChannels.chatClear, (_event, projectId: number, pageNumber: number) => {
    const page = pageRepository.getByNumber(projectId, pageNumber)
    if (page) chatMessageRepository.clearByPage(page.id)
  })
}
