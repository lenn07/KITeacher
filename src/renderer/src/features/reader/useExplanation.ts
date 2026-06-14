/**
 * Lädt und cacht den KI-Erklärtext zur aktuellen Seite und prefetcht die nächste
 * Seite im Hintergrund (Etappe 6).
 *
 * Ablauf pro Seite:
 *  1. Cache befragen (`pages.get`) – liegt Text vor, sofort anzeigen (kein Token).
 *  2. Sonst Seite mit pdf.js zum Bild rendern und erklären lassen (`generateExplanation`).
 *
 * Prefetch (n+1) ist entprellt: Bei schnellem Durchklicken wird der Timer der
 * vorigen Seite verworfen, sodass nur die Seite vorausgeladen wird, auf der man
 * kurz verweilt. Bereits gecachte Seiten werden übersprungen.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { renderPageImage } from './pdfImage'

/** Wartezeit, bevor die nächste Seite vorausgeladen wird (Entprellung). */
const PREFETCH_DELAY_MS = 600

export type ExplanationState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string }

interface UseExplanationArgs {
  projectId: number
  pageNumber: number
  pageCount: number
  prefetchEnabled: boolean
}

interface UseExplanationResult {
  state: ExplanationState
  /** Erklärung verwerfen und neu generieren (Cache umgehen). */
  regenerate: () => void
}

export function useExplanation({
  projectId,
  pageNumber,
  pageCount,
  prefetchEnabled
}: UseExplanationArgs): UseExplanationResult {
  const [state, setState] = useState<ExplanationState>({ status: 'loading' })
  // Zählt hoch, um eine Neugenerierung anzustoßen; trägt zugleich das „force"-Signal.
  const [reloadToken, setReloadToken] = useState(0)
  const forceRef = useRef(false)

  const regenerate = useCallback(() => {
    forceRef.current = true
    setReloadToken((token) => token + 1)
  }, [])

  // Aktuelle Seite laden (Cache → sonst generieren). Bei Wechsel sauber abbrechen.
  useEffect(() => {
    const force = forceRef.current
    forceRef.current = false
    let cancelled = false

    async function load(): Promise<void> {
      setState({ status: 'loading' })

      if (!force) {
        const cached = await window.api.pages.get(projectId, pageNumber)
        if (cancelled) return
        if (cached?.explanation) {
          setState({ status: 'ready', text: cached.explanation })
          return
        }
      }

      try {
        const image = await renderPageImage(projectId, pageNumber)
        if (cancelled) return
        const result = await window.api.pages.generateExplanation({
          projectId,
          pageNumber,
          image,
          force
        })
        if (cancelled) return
        if (result.ok) {
          setState({ status: 'ready', text: result.page.explanation ?? '' })
        } else {
          setState({ status: 'error', message: result.message })
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'Die Seite konnte nicht erklärt werden.' })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId, pageNumber, reloadToken])

  // Nächste Seite vorausladen – entprellt, abbrechbar bei schnellem Klicken.
  useEffect(() => {
    if (!prefetchEnabled) return
    const next = pageNumber + 1
    if (next > pageCount) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const cached = await window.api.pages.get(projectId, next)
        if (cancelled || cached?.explanation) return
        const image = await renderPageImage(projectId, next)
        if (cancelled) return
        // Ergebnis landet im Cache; die Seite zeigt es beim Aufschlagen sofort.
        await window.api.pages.generateExplanation({ projectId, pageNumber: next, image })
      } catch {
        // Prefetch-Fehler bewusst ignorieren – die Seite generiert beim Öffnen erneut.
      }
    }, PREFETCH_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [projectId, pageNumber, pageCount, prefetchEnabled])

  return { state, regenerate }
}
