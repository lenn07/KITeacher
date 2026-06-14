/**
 * Projekt-Übersicht (Etappe 3).
 *
 * Listet alle Projekte (neueste zuerst) und bietet Import, Öffnen, Umbenennen
 * und Löschen. Sämtlicher Datenzugriff läuft über `window.api.projects` – die
 * UI kennt keine Datenbank, nur die typisierte Bridge.
 */
import { useEffect, useState } from 'react'
import type { Project } from '@shared/domain'

interface ProjectMenuProps {
  onOpen: (project: Project) => void
}

/** Erstellungsdatum kompakt und lesbar darstellen. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ProjectMenu({ onOpen }: ProjectMenuProps): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftName, setDraftName] = useState('')

  async function reload(): Promise<void> {
    setProjects(await window.api.projects.list())
  }

  useEffect(() => {
    reload()
      .catch(() => setError('Projekte konnten nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleImport(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const created = await window.api.projects.import()
      if (created) await reload()
    } catch {
      setError('Der Import ist fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  function startRename(project: Project): void {
    setEditingId(project.id)
    setDraftName(project.name)
  }

  async function confirmRename(id: number): Promise<void> {
    const name = draftName.trim()
    setEditingId(null)
    if (!name) return
    try {
      await window.api.projects.rename(id, name)
      await reload()
    } catch {
      setError('Umbenennen ist fehlgeschlagen.')
    }
  }

  async function handleDelete(project: Project): Promise<void> {
    if (!window.confirm(`„${project.name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) {
      return
    }
    try {
      await window.api.projects.delete(project.id)
      await reload()
    } catch {
      setError('Löschen ist fehlgeschlagen.')
    }
  }

  return (
    <main className="menu">
      <header className="menu-header">
        <div>
          <h1>KITeacher</h1>
          <p className="subtitle">Deine Projekte</p>
        </div>
        <button className="btn primary" onClick={handleImport} disabled={busy}>
          {busy ? 'Importiere…' : '+ PDF importieren'}
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">Lade Projekte…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          <p>Noch keine Projekte.</p>
          <p className="muted">Importiere ein PDF, um loszulegen.</p>
        </div>
      ) : (
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id} className="project-item">
              {editingId === project.id ? (
                <input
                  className="rename-input"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => confirmRename(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename(project.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <button
                  className="project-main"
                  onClick={() => onOpen(project)}
                  title="Projekt öffnen"
                >
                  <span className="project-name">{project.name}</span>
                  <span className="project-meta">
                    {project.pageCount > 0 ? `${project.pageCount} Seiten · ` : ''}
                    {formatDate(project.createdAt)}
                  </span>
                </button>
              )}

              <div className="project-actions">
                <button className="btn ghost" onClick={() => onOpen(project)}>
                  Öffnen
                </button>
                <button className="btn ghost" onClick={() => startRename(project)}>
                  Umbenennen
                </button>
                <button className="btn ghost danger" onClick={() => handleDelete(project)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
