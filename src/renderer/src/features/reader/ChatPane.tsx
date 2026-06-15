/**
 * Rechte Spalte als durchgehender Chat-Verlauf (Etappe 7).
 *
 * Alles ist ein einziger Chat: Die KI-Erklärung der Seite ist die erste
 * Nachricht (assistant), darunter reihen sich die Rückfragen (user) und die
 * Antworten (assistant) ein. Die Erklärung bleibt technisch getrennt gecacht
 * (`pages`-Tabelle, On-Demand) und wird hier nur als erste Blase dargestellt –
 * inkl. `idle` (noch nicht erklärt, „Seite erklären"), Lade-/Fehlerzustand und
 * „Neu erklären".
 *
 * KI-Texte werden als Markdown gerendert (inkl. Mathe via KaTeX); während die KI
 * antwortet, erscheint die Frage sofort als „pending"-Blase mit Spinner.
 */
import { useEffect, useRef, useState } from 'react'
import { MarkdownView } from './MarkdownView'
import type { ExplanationState } from './useExplanation'
import type { UseChatResult } from './useChat'

/**
 * Zeigt eine Fehlermeldung an, in der das Wort „Einstellungen" ein anklickbarer,
 * unterstrichener Link ist (statt eines separaten Knopfs). Kommt das Wort nicht
 * vor, wird der Text unverändert ausgegeben.
 */
function ErrorWithSettingsLink({
  message,
  onOpenSettings
}: {
  message: string
  onOpenSettings: () => void
}): React.JSX.Element {
  const [before, ...rest] = message.split('Einstellungen')
  if (rest.length === 0) return <>{message}</>
  return (
    <>
      {before}
      <button type="button" className="link-button" onClick={onOpenSettings}>
        Einstellungen
      </button>
      {rest.join('Einstellungen')}
    </>
  )
}

interface ChatPaneProps {
  explanation: ExplanationState
  onExplain: () => void
  onRegenerate: () => void
  /** Wechsel in die Einstellungen – angeboten, wenn kein API-Key hinterlegt ist. */
  onOpenSettings: () => void
  chat: UseChatResult
}

export function ChatPane({
  explanation,
  onExplain,
  onRegenerate,
  onOpenSettings,
  chat
}: ChatPaneProps): React.JSX.Element {
  const { messages, pending, status, error, send, clear } = chat
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sending = status === 'sending'
  // Rückfragen brauchen die Erklärung als Kontext – erst zulassen, wenn sie vorliegt.
  const explanationReady = explanation.status === 'ready'
  const inputDisabled = sending || !explanationReady

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
        {/* Erste Nachricht: die Seiten-Erklärung der KI. Neue Seiten werden nicht
            automatisch erklärt – stattdessen ein Knopf zum Auslösen. */}
        {explanation.status === 'idle' && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-bubble chat-bubble-cta">
              <p className="muted">Diese Seite wurde noch nicht erklärt.</p>
              <button className="btn" onClick={onExplain}>
                Seite erklären
              </button>
            </div>
          </div>
        )}

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
              <p className="error">
                {explanation.kind === 'no-key' ? (
                  <ErrorWithSettingsLink
                    message={explanation.message}
                    onOpenSettings={onOpenSettings}
                  />
                ) : (
                  explanation.message
                )}
              </p>
              {explanation.kind !== 'no-key' && (
                <div className="chat-bubble-error-actions">
                  <button className="btn ghost" onClick={onRegenerate}>
                    Erneut versuchen
                  </button>
                </div>
              )}
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

      {error && (
        <p className="error chat-error">
          {error.kind === 'no-key' ? (
            <ErrorWithSettingsLink message={error.message} onOpenSettings={onOpenSettings} />
          ) : (
            error.message
          )}
        </p>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            explanationReady
              ? 'Frage zu dieser Seite stellen…'
              : 'Erst die Seite erklären lassen…'
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
