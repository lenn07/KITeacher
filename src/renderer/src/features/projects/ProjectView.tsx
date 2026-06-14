/**
 * Geöffnetes Projekt – Split-Screen (Etappe 4).
 *
 * Links der PDF-Viewer mit Seiten-Navigation (vor/zurück), rechts der Bereich
 * für die KI-Erklärung (Platzhalter bis Etappe 6). Die aktuelle Seite lebt hier,
 * damit später die rechte Spalte denselben Stand teilt. Die tatsächliche
 * Seitenzahl wird beim Laden des PDFs ermittelt und – falls beim Import noch 0 –
 * persistent nachgetragen.
 */
import { useState } from 'react'
import type { Project } from '@shared/domain'
import { PdfViewer } from '../reader/PdfViewer'

interface ProjectViewProps {
  project: Project
  onBack: () => void
}

export function ProjectView({ project, onBack }: ProjectViewProps): React.JSX.Element {
  const [pageCount, setPageCount] = useState(project.pageCount)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

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
          <p className="muted">
            KI-Erklärung zur aktuellen Seite folgt in Etappe 6.
          </p>
        </section>
      </div>
    </main>
  )
}
