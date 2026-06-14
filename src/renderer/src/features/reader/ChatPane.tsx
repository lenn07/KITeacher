/**
 * Rechte Spalte als durchgehender Chat-Verlauf (Etappe 7).
 *
 * Alles ist ein einziger Chat: Die KI-Erklärung der Seite ist die erste
 * Nachricht (assistant), darunter reihen sich die Rückfragen (user) und die
 * Antworten (assistant) ein. Die Erklärung bleibt technisch getrennt gecacht
 * (`pages`-Tabelle, On-Demand/Prefetch) und wird hier nur als erste Blase
 * dargestellt – inkl. ihrer Lade-/Fehlerzustände und „Neu erklären".
 *
 * KI-Texte werden als Markdown gerendert (inkl. Mathe via KaTeX); während die KI
 * antwortet, erscheint die Frage sofort als „pending"-Blase mit Spinner.
 */
import { useEffect, useRef, useState } from 'react'
import { MarkdownView } from './MarkdownView'
import type { ExplanationState } from './useExplanation'
import type { UseChatResult } from './useChat'

interface ChatPaneProps {
  explanation: ExplanationState
  onRegenerate: () => void
  chat: UseChatResult
}

export function ChatPane({ explanation, onRegenerate, chat }: ChatPaneProps): React.JSX.Element {
  const { messages, pending, status, error, send, clear } = chat
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sending = status === 'sending'
  // Solange die Erklärung lädt, fehlt der Kontext – erst danach Rückfragen zulassen.
  const explanationLoading = explanation.status === 'loading'
  const inputDisabled = sending || explanationLoading

  // Bei neuen Nachrichten / Statuswechseln ans Ende scrollen.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, error, explanation])

  async function handleSend(): Promise<void> {
    const ok = await send(input)
    if (ok) setInput('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter sendet, Shift+Enter fügt eine Zeile ein.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-title">Erklärung & Rückfragen</span>
        {messages.length > 0 && (
          <button className="btn ghost chat-clear" onClick={() => void clear()} disabled={sending}>
            Rückfragen löschen
          </button>
        )}
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {/* Erste Nachricht: die Seiten-Erklärung der KI. */}
        {explanation.status === 'loading' && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-bubble chat-typing">
              <span className="spinner" aria-hidden="true" />
              <span className="muted">KI erklärt die Seite…</span>
            </div>
          </div>
        )}

        {explanation.status === 'error' && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-bubble chat-bubble-error">
              <p className="error">{explanation.message}</p>
              <button className="btn ghost" onClick={onRegenerate}>
                Erneut versuchen
              </button>
            </div>
          </div>
        )}

        {explanation.status === 'ready' && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-bubble chat-markdown">
              <MarkdownView>{explanation.text}</MarkdownView>
              <div className="chat-bubble-actions">
                <button className="btn ghost" onClick={onRegenerate} disabled={sending}>
                  ↻ Neu erklären
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danach die Rückfragen und Antworten. */}
        {messages.map((message) => (
          <div key={message.id} className={`chat-msg chat-msg-${message.role}`}>
            {message.role === 'assistant' ? (
              <div className="chat-bubble chat-markdown">
                <MarkdownView>{message.content}</MarkdownView>
              </div>
            ) : (
              <div className="chat-bubble">{message.content}</div>
            )}
          </div>
        ))}

        {pending && (
          <>
            <div className="chat-msg chat-msg-user">
              <div className="chat-bubble">{pending}</div>
            </div>
            <div className="chat-msg chat-msg-assistant">
              <div className="chat-bubble chat-typing">
                <span className="spinner" aria-hidden="true" />
                <span className="muted">KI denkt nach…</span>
              </div>
            </div>
          </>
        )}
      </div>

      {error && <p className="error chat-error">{error}</p>}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            explanationLoading ? 'Erklärung wird erstellt…' : 'Frage zu dieser Seite stellen…'
          }
          rows={2}
          disabled={inputDisabled}
        />
        <button
          className="btn"
          onClick={() => void handleSend()}
          disabled={inputDisabled || !input.trim()}
        >
          Senden
        </button>
      </div>
    </div>
  )
}
