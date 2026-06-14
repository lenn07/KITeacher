/**
 * PDF-Viewer (Etappe 4) – rendert eine einzelne Seite mit pdf.js auf ein Canvas.
 *
 * Der Renderer hat keinen Datei-Zugriff: Die PDF-Bytes kommen über die
 * typisierte Bridge (`window.api.projects.readPdf`). Das Dokument wird einmal
 * pro Projekt geladen; die aktuell sichtbare Seite steuert die Eltern-Komponente
 * über `pageNumber`. Die tatsächliche Seitenzahl meldet der Viewer per
 * `onLoaded` zurück (zum Nachtragen + für die Navigation).
 */
import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// pdf.js lagert das Parsen in einen Web-Worker aus. Vite liefert dessen URL.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface PdfViewerProps {
  /** Projekt, dessen PDF angezeigt wird. */
  projectId: number
  /** 1-basierte, aktuell sichtbare Seite. */
  pageNumber: number
  /** Meldet die tatsächliche Seitenzahl, sobald das Dokument geladen ist. */
  onLoaded: (numPages: number) => void
  /** Meldet einen Lade-/Renderfehler an die Eltern-Komponente. */
  onError: (message: string) => void
}

export function PdfViewer({
  projectId,
  pageNumber,
  onLoaded,
  onError
}: PdfViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [width, setWidth] = useState(0)

  // Dokument einmal pro Projekt laden und beim Verlassen sauber freigeben.
  useEffect(() => {
    let cancelled = false
    setDoc(null)

    window.api.projects
      .readPdf(projectId)
      .then((data) => pdfjs.getDocument({ data }).promise)
      .then((loaded) => {
        if (cancelled) {
          loaded.destroy()
          return
        }
        setDoc(loaded)
        onLoaded(loaded.numPages)
      })
      .catch(() => {
        if (!cancelled) onError('Das PDF konnte nicht geladen werden.')
      })

    return () => {
      cancelled = true
    }
    // onLoaded/onError sind stabil genug; nur der Projektwechsel lädt neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Beim Verlassen das Dokument freigeben (separater Effekt, an `doc` gebunden).
  useEffect(() => {
    return () => {
      doc?.destroy()
    }
  }, [doc])

  // Verfügbare Breite beobachten, damit die Seite den Platz ausfüllt.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Aktuelle Seite rendern – bei Seitenwechsel/Resize neu, alter Lauf abgebrochen.
  useEffect(() => {
    if (!doc || width === 0) return
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null =
      null

    async function render(): Promise<void> {
      const page = await doc!.getPage(pageNumber)
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      // An die Containerbreite anpassen, für Schärfe mit Geräte-Pixeldichte rendern.
      const base = page.getViewport({ scale: 1 })
      const dpr = window.devicePixelRatio || 1
      const scale = Math.max(0.2, width / base.width)
      const viewport = page.getViewport({ scale: scale * dpr })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`

      renderTask = page.render({ canvasContext: ctx, viewport })
      try {
        await renderTask.promise
      } catch {
        // Beim Abbrechen wirft pdf.js eine RenderingCancelledException – ignorieren.
      }
    }

    render().catch(() => {
      if (!cancelled) onError('Die Seite konnte nicht dargestellt werden.')
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNumber, width])

  return (
    <div className="pdf-canvas-wrap" ref={containerRef}>
      {doc ? <canvas ref={canvasRef} /> : <p className="muted">Lade PDF…</p>}
    </div>
  )
}
