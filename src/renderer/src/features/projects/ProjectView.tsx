/**
 * Geöffnetes Projekt – Platzhalter für Etappe 3.
 *
 * Der Split-Screen mit PDF-Viewer (links) und KI-Erklärung (rechts) entsteht in
 * den Etappen 4–7. Hier wird vorerst nur bestätigt, dass ein Projekt geöffnet
 * wurde, samt Weg zurück zur Übersicht.
 */
import type { Project } from '@shared/domain'

interface ProjectViewProps {
  project: Project
  onBack: () => void
}

export function ProjectView({ project, onBack }: ProjectViewProps): React.JSX.Element {
  return (
    <main className="project-view">
      <header className="view-header">
        <button className="btn ghost" onClick={onBack}>
          ← Übersicht
        </button>
        <h2>{project.name}</h2>
      </header>
      <div className="view-body">
        <p className="muted">
          Split-Screen mit PDF-Viewer und KI-Erklärung folgt in den nächsten Etappen.
        </p>
      </div>
    </main>
  )
}
