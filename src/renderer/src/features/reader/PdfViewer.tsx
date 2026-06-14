/**
 * PDF-Viewer (Etappe 4) – rendert eine einzelne Seite mit pdf.js auf ein Canvas.
 *
 * Der Renderer hat keinen Datei-Zugriff: Die PDF-Bytes kommen über die
 * typisierte Bridge (`window.api.projects.readPdf`). Das Dokument wird einmal
 * pro Projekt geladen; die aktuell sichtbare Seite steuert die Eltern-Komponente
 * über `pageNumber`. Die tatsächliche Seitenzahl meldet der Viewer per
 * `onLoaded` zurück (zum Nachtragen + für die Navigation).
 *
 * Zoom: Beim Zoomen (Pinch/Strg+Scrollrad) wird das vorhandene Bild sofort per
 * CSS-`transform` skaliert (flüssig, GPU). Das teure, scharfe Neu-Rendern durch
 * pdf.js passiert erst kurz nach dem Loslassen (entprellt) – so ruckelt nichts.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// pdf.js lagert das Parsen in einen Web-Worker aus. Vite liefert dessen URL.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Wartezeit nach der letzten Zoom-Aktion, bevor scharf neu gerendert wird. */
const SHARPEN_DELAY_MS = 140

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
  const [size, setSize] = useState({ width: 0, height: 0 })
  // CSS-Maße der Seite bei Zoom 1 (Breite füllt die Spalte). Aus Seiten- und
  // Containermaßen berechnet; treibt die Größe von Sizer und Canvas im JSX.
  const [pageBox, setPageBox] = useState({ w: 0, h: 0 })
  // Live-Zoom (jeder Scroll-Tick) – steuert Sizer-Größe und CSS-Transform.
  const [zoom, setZoom] = useState(1)
  // Zoom, bei dem das Canvas-Bitmap tatsächlich (scharf) gerendert wurde.
  // Wird entprellt nachgezogen; im Ruhezustand gilt renderZoom === zoom.
  const [renderZoom, setRenderZoom] = useState(1)

  const zoomRef = useRef(1)
  // Untergrenze des Zooms: so weit raus, dass die ganze Seite ins Feld passt.
  const minZoomRef = useRef(1)
  // Timer für das entprellte scharfe Neu-Rendern.
  const sharpenTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Fixpunkt für „zum Mauszeiger zoomen": Mausposition + Punkt auf der Seite (0–1).
  const pendingFocusRef = useRef<{
    clientX: number
    clientY: number
    fx: number
    fy: number
  } | null>(null)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Dokument einmal pro Projekt laden und beim Verlassen sauber freigeben.
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setZoom(1)
    setRenderZoom(1)

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

  // Verfügbaren Platz (Breite + Höhe) beobachten, damit die Seite ihn ausfüllt
  // und die „ganze Seite sichtbar"-Grenze korrekt bleibt.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Zoom per Maus/Trackpad: Pinch-Geste und Strg/Cmd+Scrollrad kommen beide als
  // `wheel`-Event mit `ctrlKey` an. Nativer Listener mit `passive: false`, damit
  // wir das Standard-Scrollen/Browser-Zoom unterdrücken können.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function onWheel(event: WheelEvent): void {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      // Fixpunkt unter der Maus festhalten (Anteil auf der Seite), damit nach dem
      // Zoom genau dieser Punkt wieder unter dem Mauszeiger liegt.
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        pendingFocusRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          fx: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
          fy: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
        }
      }
      // Live-Zoom sofort anpassen (nur CSS-Transform → flüssig). Nach oben 5×,
      // nach unten nur bis die ganze Seite sichtbar ist (minZoomRef).
      setZoom((current) => {
        const next = Math.min(
          5,
          Math.max(minZoomRef.current, current * Math.exp(-event.deltaY * 0.01))
        )
        if (next === current) pendingFocusRef.current = null
        return next
      })
      // Scharfes Neu-Rendern erst, wenn das Zoomen kurz pausiert.
      clearTimeout(sharpenTimerRef.current)
      sharpenTimerRef.current = setTimeout(() => {
        setRenderZoom(zoomRef.current)
      }, SHARPEN_DELAY_MS)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', onWheel)
      clearTimeout(sharpenTimerRef.current)
    }
  }, [])

  // Bitmap rendern – bei Seitenwechsel/Resize und (entprellt) bei Zoom. Läuft
  // offscreen, das sichtbare Bild wird erst fertig befüllt umgestellt (kein Flackern).
  useEffect(() => {
    if (!doc || size.width === 0 || size.height === 0) return
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null =
      null

    async function render(): Promise<void> {
      const page = await doc!.getPage(pageNumber)
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const base = page.getViewport({ scale: 1 })
      const dpr = window.devicePixelRatio || 1
      const fitWidth = size.width / base.width
      // „Ganze Seite sichtbar": passt in Breite UND Höhe. Weiter raus geht nicht.
      const fitPage = Math.min(fitWidth, size.height / base.height)
      const minZoom = fitPage / fitWidth
      minZoomRef.current = minZoom
      // Nach einem Resize kann der Zoom unter die Grenze rutschen → anheben.
      if (renderZoom < minZoom) {
        setRenderZoom(minZoom)
        if (zoomRef.current < minZoom) setZoom(minZoom)
        return
      }
      if (zoomRef.current < minZoom) setZoom(minZoom)

      // CSS-Maße der Seite (bei Zoom 1) für Sizer/Canvas im JSX bereitstellen.
      setPageBox({ w: size.width, h: base.height * fitWidth })

      // Bitmap-Auflösung: an Zoom UND Geräte-Pixeldichte angepasst → scharf.
      const viewport = page.getViewport({ scale: fitWidth * renderZoom * dpr })

      // Zuerst offscreen rendern, damit das sichtbare Bild nie kurz leer ist.
      const off = document.createElement('canvas')
      off.width = viewport.width
      off.height = viewport.height
      const offCtx = off.getContext('2d')
      if (!offCtx) return

      renderTask = page.render({ canvasContext: offCtx, viewport })
      try {
        await renderTask.promise
      } catch {
        // Abbruch (RenderingCancelledException) oder Fehler: sichtbares Bild lassen.
        return
      }
      if (cancelled) return

      // Sichtbares Canvas in einem synchronen Schritt umstellen und befüllen.
      canvas.width = viewport.width
      canvas.height = viewport.height
      ctx.drawImage(off, 0, 0)
    }

    render().catch(() => {
      if (!cancelled) onError('Die Seite konnte nicht dargestellt werden.')
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNumber, size, renderZoom])

  // „Zum Mauszeiger zoomen": nach jeder (Live-)Zoomänderung die Scrollposition so
  // verschieben, dass der gemerkte Fixpunkt wieder unter der Maus liegt.
  useLayoutEffect(() => {
    const focus = pendingFocusRef.current
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!focus || !container || !canvas) return
    pendingFocusRef.current = null
    const rect = canvas.getBoundingClientRect()
    container.scrollLeft += rect.left + focus.fx * rect.width - focus.clientX
    container.scrollTop += rect.top + focus.fy * rect.height - focus.clientY
  }, [zoom])

  return (
    <div className="pdf-canvas-wrap" ref={containerRef}>
      {doc ? (
        <div className="pdf-sizer" style={{ width: pageBox.w * zoom, height: pageBox.h * zoom }}>
          <canvas
            ref={canvasRef}
            style={{
              width: pageBox.w * renderZoom,
              height: pageBox.h * renderZoom,
              // Live-Skalierung relativ zum gerenderten Bitmap (im Ruhezustand 1).
              transform: `scale(${zoom / renderZoom})`,
              transformOrigin: '0 0'
            }}
          />
        </div>
      ) : (
        <p className="muted">Lade PDF…</p>
      )}
    </div>
  )
}
