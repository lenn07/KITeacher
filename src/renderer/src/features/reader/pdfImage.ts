/**
 * Rendert eine PDF-Seite zu einem Base64-Bild für die Vision-Anfrage (Etappe 6).
 *
 * Getrennt vom Anzeige-Renderer (`PdfViewer`): Der Viewer rendert zoomabhängig
 * fürs Auge, hier brauchen wir ein gleichmäßig aufgelöstes Bild für Claude.
 * Geladene Dokumente werden pro Projekt gecacht, damit nicht für jede Anfrage das
 * ganze PDF neu geparst wird (Erklärung und jede Chat-Rückfrage rendern ein Bild).
 *
 * Der Renderer hat keinen Datei-Zugriff: Die PDF-Bytes kommen über die Bridge
 * (`window.api.projects.readPdf`), genau wie im Anzeige-Viewer.
 */
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PageImage } from '@shared/domain'

// pdf.js lagert das Parsen in einen Web-Worker aus (idempotent, falls schon gesetzt).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Ziel-Breite des Seitenbilds in Pixeln. Claudes Vision arbeitet bis ~1568 px
 * Kantenlänge optimal – größer bringt keinen Mehrwert, kostet aber Tokens.
 */
const TARGET_WIDTH = 1568

/** Doppel-Lade-Schutz: pro Projekt genau eine Dokument-Promise vorhalten. */
const documents = new Map<number, Promise<PDFDocumentProxy>>()

function loadDocument(projectId: number): Promise<PDFDocumentProxy> {
  let doc = documents.get(projectId)
  if (!doc) {
    doc = window.api.projects
      .readPdf(projectId)
      .then((data) => pdfjs.getDocument({ data }).promise)
    documents.set(projectId, doc)
    // Bei Fehlschlag den Cache-Eintrag entfernen, damit ein erneuter Versuch lädt.
    doc.catch(() => documents.delete(projectId))
  }
  return doc
}

/** Rendert die angegebene Seite zu einem PNG-Base64-Bild für die KI. */
export async function renderPageImage(projectId: number, pageNumber: number): Promise<PageImage> {
  const doc = await loadDocument(projectId)
  const page = await doc.getPage(pageNumber)

  const base = page.getViewport({ scale: 1 })
  // Auf Ziel-Breite skalieren, aber Seiten nie hochskalieren (max. Faktor 1× Basis).
  const scale = Math.min(TARGET_WIDTH / base.width, 2)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.')

  await page.render({ canvasContext: ctx, viewport }).promise

  // toDataURL liefert „data:image/png;base64,XXXX" – nur den Base64-Teil weiterreichen.
  const base64 = canvas.toDataURL('image/png').split(',')[1]
  return { base64, mediaType: 'image/png' }
}

/** Gibt das gecachte Dokument eines Projekts frei (z. B. beim Schließen). */
export function releaseDocument(projectId: number): void {
  const doc = documents.get(projectId)
  if (!doc) return
  documents.delete(projectId)
  doc.then((d) => d.destroy()).catch(() => undefined)
}
