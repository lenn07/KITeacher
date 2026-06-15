/**
 * Lädt und verwaltet den seitenbezogenen Chat-Verlauf (Etappe 7).
 *
 * Pro Seite:
 *  1. Beim Öffnen den gespeicherten Verlauf laden (`chat.list`).
 *  2. Beim Senden die Seite als Bild rendern (Vision-Kontext) und die Frage
 *     mitsamt Bild an die KI schicken (`chat.send`). Der Main-Prozess speichert
 *     Frage + Antwort erst nach Erfolg und liefert den vollständigen Verlauf.
 *
 * Optimistische Anzeige: Während die KI antwortet, wird die Frage sofort als
 * `pending`-Blase gezeigt. Schlägt der Aufruf fehl, bleibt der Eingabetext in der
 * UI erhalten (siehe `send` → boolescher Rückgabewert) und es wird nichts gespeichert.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiFailureKind, ChatMessage } from '@shared/domain'
import { renderPageImage } from './pdfImage'

/** Fehler der letzten Rückfrage – mit `kind`, damit die UI „kein Key" gesondert behandeln kann. */
export interface ChatError {
  message: string
  kind: AiFailureKind
}

export interface UseChatResult {
  messages: ChatMessage[]
  /** Aktuell gesendete Frage, solange die KI antwortet (sonst `null`). */
  pending: string | null
  status: 'idle' | 'sending'
  error: ChatError | null
  /** Sendet eine Frage; `true` bei Erfolg (die UI leert dann das Eingabefeld). */
  send: (message: string) => Promise<boolean>
  /** Löscht den gesamten Verlauf der Seite. */
  clear: () => Promise<void>
}

interface UseChatArgs {
  projectId: number
  pageNumber: number
}

export function useChat({ projectId, pageNumber }: UseChatArgs): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState<ChatError | null>(null)

  // Verhindert, dass eine spät eintreffende Antwort einer alten Seite den
  // Verlauf der inzwischen geöffneten Seite überschreibt.
  const requestRef = useRef(0)

  // Verlauf der aktuellen Seite laden; bei Seitenwechsel sauber zurücksetzen.
  useEffect(() => {
    const token = ++requestRef.current
    setMessages([])
    setPending(null)
    setStatus('idle')
    setError(null)

    window.api.chat
      .list(projectId, pageNumber)
      .then((history) => {
        if (requestRef.current === token) setMessages(history)
      })
      .catch(() => {
        /* Verlauf bleibt leer – unkritisch, der Chat funktioniert trotzdem. */
      })
  }, [projectId, pageNumber])

  const send = useCallback(
    async (message: string): Promise<boolean> => {
      const text = message.trim()
      if (!text || status === 'sending') return false

      const token = requestRef.current
      setError(null)
      setPending(text)
      setStatus('sending')

      try {
        const image = await renderPageImage(projectId, pageNumber)
        const result = await window.api.chat.send({ projectId, pageNumber, message: text, image })
        // Seite zwischenzeitlich gewechselt? Ergebnis verwerfen.
        if (requestRef.current !== token) return result.ok

        if (result.ok) {
          setMessages(result.messages)
          return true
        }
        setError({ message: result.message, kind: result.kind })
        return false
      } catch {
        if (requestRef.current === token) {
          setError({ message: 'Die Nachricht konnte nicht gesendet werden.', kind: 'ai' })
        }
        return false
      } finally {
        if (requestRef.current === token) {
          setPending(null)
          setStatus('idle')
        }
      }
    },
    [projectId, pageNumber, status]
  )

  const clear = useCallback(async (): Promise<void> => {
    const token = requestRef.current
    await window.api.chat.clear(projectId, pageNumber)
    if (requestRef.current === token) {
      setMessages([])
      setError(null)
    }
  }, [projectId, pageNumber])

  return { messages, pending, status, error, send, clear }
}
