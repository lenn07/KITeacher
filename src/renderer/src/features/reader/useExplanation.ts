/**
 * Lädt den KI-Erklärtext zur aktuellen Seite (Etappe 6, angepasst in Etappe 7).
 *
 * Wichtig: Eine noch nicht erklärte Seite wird NICHT automatisch generiert – auch
 * nicht im Voraus. Beim Öffnen wird nur der Cache geprüft:
 *  - liegt ein Text vor → sofort anzeigen (kein Token),
 *  - sonst Zustand `idle` → die UI zeigt einen „Seite erklären"-Knopf.
 * Erst auf Knopfdruck (`explain`) wird die Seite mit pdf.js zum Bild gerendert
 * und erklärt; `regenerate` umgeht den Cache („Neu erklären"). Ein Vision-Aufruf
 * passiert ausschließlich, wenn man ihn auslöst.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiFailureKind } from '@shared/domain'
import { renderPageImage } from './pdfImage'

export type ExplanationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string; kind: AiFailureKind }

interface UseExplanationArgs {
  projectId: number
  pageNumber: number
}

interface UseExplanationResult {
  state: ExplanationState
  /** Erklärung erzeugen (Knopf bei einer noch nicht erklärten Seite). */
  explain: () => void
  /** Erklärung verwerfen und neu erzeugen (Cache umgehen). */
  regenerate: () => void
}

export function useExplanation({
  projectId,
  pageNumber
}: UseExplanationArgs): UseExplanationResult {
  const [state, setState] = useState<ExplanationState>({ status: 'idle' })
  // Verwirft veraltete Antworten, wenn die Seite zwischenzeitlich gewechselt wird.
  const requestRef = useRef(0)

  // Erzeugt die Erklärung der aktuellen Seite (force = Cache umgehen).
  const generate = useCallback(
    async (force: boolean): Promise<void> => {
      const token = ++requestRef.current
      setState({ status: 'loading' })
      try {
        const image = await renderPageImage(projectId, pageNumber)
        if (requestRef.current !== token) return
        const result = await window.api.pages.generateExplanation({
          projectId,
          pageNumber,
          image,
          force
        })
        if (requestRef.current !== token) return
        if (result.ok) {
          setState({ status: 'ready', text: result.page.explanation ?? '' })
        } else {
          setState({ status: 'error', message: result.message, kind: result.kind })
        }
      } catch {
        if (requestRef.current === token) {
          // Fehler schon im Renderer (z. B. Seite ließ sich nicht zum Bild rendern).
          setState({
            status: 'error',
            message: 'Die Seite konnte nicht erklärt werden.',
            kind: 'ai'
          })
        }
      }
    },
    [projectId, pageNumber]
  )

  const explain = useCallback(() => void generate(false), [generate])
  const regenerate = useCallback(() => void generate(true), [generate])

  // Seitenwechsel: nur den Cache prüfen, NICHT automatisch generieren.
  useEffect(() => {
    const token = ++requestRef.current
    setState({ status: 'loading' })

    window.api.pages
      .get(projectId, pageNumber)
      .then((cached) => {
        if (requestRef.current !== token) return
        setState(
          cached?.explanation
            ? { status: 'ready', text: cached.explanation }
            : { status: 'idle' }
        )
      })
      .catch(() => {
        if (requestRef.current === token) setState({ status: 'idle' })
      })
  }, [projectId, pageNumber])

  return { state, explain, regenerate }
}
