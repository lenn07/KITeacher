/**
 * Geöffnetes Projekt – Split-Screen (Etappe 4 + 6).
 *
 * Links der PDF-Viewer mit Seiten-Navigation (vor/zurück), rechts die KI-Erklärung
 * zur aktuellen Seite (gecacht, mit Prefetch der Folgeseite). Die aktuelle Seite
 * lebt hier, damit beide Spalten denselben Stand teilen. Die tatsächliche
 * Seitenzahl wird beim Laden des PDFs ermittelt und – falls beim Import noch 0 –
 * persistent nachgetragen.
 */
import { useEffect, useState } from 'react'
import type { Project } from '@shared/domain'
import { PdfViewer } from '../reader/PdfViewer'
import { ExplanationPane } from '../reader/ExplanationPane'
import { useExplanation } from '../reader/useExplanation'
import { releaseDocument } from '../reader/pdfImage'

interface ProjectViewProps {
  project: Project
  onBack: () => void
}

export function ProjectView({ project, onBack }: ProjectViewProps): React.JSX.Element {
  const [pageCount, setPageCount] = useState(project.pageCount)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  // Prefetch-Einstellung einmal laden; Modell/Niveau wertet der Main-Prozess aus.
  const [prefetchEnabled, setPrefetchEnabled] = useState(false)

  useEffect(() => {
    window.api.settings
      .get()
      .then((settings) => setPrefetchEnabled(settings.prefetchEnabled))
      .catch(() => {
        /* Ohne Einstellungen bleibt Prefetch aus – unkritisch. */
      })
  }, [])

  // Das für die Bild-Erzeugung gecachte PDF-Dokument beim Schließen freigeben.
  useEffect(() => {
    return () => releaseDocument(project.id)
  }, [project.id])

  const { state: explanationState, regenerate } = useExplanation({
    projectId: project.id,
    pageNumber: currentPage,
    pageCount,
    prefetchEnabled
  })

  function handleLoaded(numPages: number): void {
    setPageCount(numPages)
    setCurrentPage((page) => Math.min(page, numPages))
    // Seitenzahl nachtragen, falls sie beim Import noch unbekannt (0) oder veraltet war.
    if (numPages !== project.pageCount) {
      window.api.projects.setPageCount(project.id, numPages).catch(() => {
        /* Nicht kritisch: betrifft nur die Anzeige in der Übersicht. */
      })
    }
  }

  const canPrev = currentPage > 1
  const canNext = pageCount > 0 && currentPage < pageCount

  return (
    <main className="project-view">
      <header className="view-header">
        <button className="btn ghost" onClick={onBack}>
          ← Übersicht
        </button>
        <h2>{project.name}</h2>
      </header>

      {error && <p className="error reader-error">{error}</p>}

      <div className="reader">
        <section className="reader-pane pdf-pane">
          <PdfViewer
            projectId={project.id}
            pageNumber={currentPage}
            onLoaded={handleLoaded}
            onError={setError}
          />
          <nav className="pdf-nav">
            <button
              className="btn ghost"
              disabled={!canPrev}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ← Zurück
            </button>
            <span className="pdf-nav-status">
              {pageCount > 0 ? `Seite ${currentPage} / ${pageCount}` : 'Lade…'}
            </span>
            <button
              className="btn ghost"
              disabled={!canNext}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Weiter →
            </button>
          </nav>
        </section>

        <section className="reader-pane explain-pane">
          <ExplanationPane state={explanationState} onRegenerate={regenerate} />
        </section>
      </div>
    </main>
  )
}
