/**
 * Projekt-Übersicht als Ordner-Browser.
 *
 * Zeigt den Inhalt des aktuellen Ordners: zuerst die Unterordner, dann die
 * Projekte. Über die Breadcrumb-Leiste navigiert man zurück Richtung Wurzel.
 * Aktionen: Ordner anlegen, PDF in den aktuellen Ordner importieren, Ordner und
 * Projekte umbenennen / verschieben / löschen. Sämtlicher Datenzugriff läuft
 * über `window.api` – die UI kennt keine Datenbank, nur die typisierte Bridge.
 */
import { useEffect, useState } from 'react'
import type { Folder, Project } from '@shared/domain'
import { FolderPicker } from './FolderPicker'

interface ProjectMenuProps {
  onOpen: (project: Project) => void
  onOpenSettings: () => void
}

/** Ein Schritt im Breadcrumb-Pfad (leerer Pfad = Wurzelebene). */
interface Crumb {
  id: number
  name: string
}

/** Welches Element gerade verschoben wird (für den Zielordner-Dialog). */
type MoveTarget =
  | { kind: 'project'; project: Project }
  | { kind: 'folder'; folder: Folder }

/** Erstellungsdatum kompakt und lesbar darstellen. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ProjectMenu({ onOpen, onOpenSettings }: ProjectMenuProps): React.JSX.Element {
  const [path, setPath] = useState<Crumb[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  // Umbenennen: id mit Typ-Präfix, damit Ordner- und Projekt-ids nicht kollidieren.
  const [editing, setEditing] = useState<{ kind: 'folder' | 'project'; id: number } | null>(null)
  const [draftName, setDraftName] = useState('')
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)

  const currentFolderId = path.length > 0 ? path[path.length - 1].id : null

  async function reload(): Promise<void> {
    const [nextFolders, nextProjects] = await Promise.all([
      window.api.folders.list(currentFolderId),
      window.api.projects.list(currentFolderId)
    ])
    setFolders(nextFolders)
    setProjects(nextProjects)
  }

  useEffect(() => {
    setLoading(true)
    reload()
      .catch(() => setError('Inhalt konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
    // currentFolderId steuert, welcher Ordner geladen wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId])

  function openFolder(folder: Folder): void {
    setError(null)
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  function navigateTo(index: number): void {
    // index = -1 → Wurzel; sonst bis einschließlich des angeklickten Crumbs.
    setError(null)
    setPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)))
  }

  async function handleImport(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const created = await window.api.projects.import(currentFolderId)
      if (created) await reload()
    } catch {
      setError('Der Import ist fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCreateFolder(): Promise<void> {
    const name = newFolderName.trim()
    setCreatingFolder(false)
    setNewFolderName('')
    if (!name) return
    try {
      await window.api.folders.create(name, currentFolderId)
      await reload()
    } catch {
      setError('Ordner konnte nicht angelegt werden.')
    }
  }

  function startRename(kind: 'folder' | 'project', id: number, name: string): void {
    setEditing({ kind, id })
    setDraftName(name)
  }

  async function confirmRename(): Promise<void> {
    if (!editing) return
    const { kind, id } = editing
    const name = draftName.trim()
    setEditing(null)
    if (!name) return
    try {
      if (kind === 'folder') await window.api.folders.rename(id, name)
      else await window.api.projects.rename(id, name)
      await reload()
    } catch {
      setError('Umbenennen ist fehlgeschlagen.')
    }
  }

  async function handleDeleteFolder(folder: Folder): Promise<void> {
    if (
      !window.confirm(
        `Ordner „${folder.name}" wirklich löschen? Alle enthaltenen Unterordner und ` +
          `Projekte (inkl. PDFs) werden mitgelöscht. Das kann nicht rückgängig gemacht werden.`
      )
    ) {
      return
    }
    try {
      await window.api.folders.delete(folder.id)
      await reload()
    } catch {
      setError('Löschen ist fehlgeschlagen.')
    }
  }

  async function handleDeleteProject(project: Project): Promise<void> {
    if (
      !window.confirm(`„${project.name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)
    ) {
      return
    }
    try {
      await window.api.projects.delete(project.id)
      await reload()
    } catch {
      setError('Löschen ist fehlgeschlagen.')
    }
  }

  async function handleMove(folderId: number | null): Promise<void> {
    if (!moveTarget) return
    const target = moveTarget
    setMoveTarget(null)
    try {
      if (target.kind === 'project') {
        await window.api.projects.move(target.project.id, folderId)
      } else {
        await window.api.folders.move(target.folder.id, folderId)
      }
      await reload()
    } catch {
      setError('Verschieben ist fehlgeschlagen.')
    }
  }

  const isEmpty = folders.length === 0 && projects.length === 0

  return (
    <main className="menu">
      <header className="menu-header">
        <div>
          <h1>KITeacher</h1>
          <p className="subtitle">Deine Projekte</p>
        </div>
        <div className="menu-header-actions">
          <button className="btn ghost" onClick={onOpenSettings}>
            ⚙ Einstellungen
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setCreatingFolder(true)
              setNewFolderName('')
            }}
          >
            + Neuer Ordner
          </button>
          <button className="btn primary" onClick={handleImport} disabled={busy}>
            {busy ? 'Importiere…' : '+ PDF importieren'}
          </button>
        </div>
      </header>

      <nav className="breadcrumb">
        <button className="crumb" onClick={() => navigateTo(-1)} disabled={path.length === 0}>
          Start
        </button>
        {path.map((crumb, index) => (
          <span key={crumb.id} className="crumb-group">
            <span className="crumb-sep">›</span>
            <button
              className="crumb"
              onClick={() => navigateTo(index)}
              disabled={index === path.length - 1}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}

      {creatingFolder && (
        <input
          className="rename-input new-folder-input"
          value={newFolderName}
          autoFocus
          placeholder="Ordnername"
          onChange={(e) => setNewFolderName(e.target.value)}
          onBlur={confirmCreateFolder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmCreateFolder()
            if (e.key === 'Escape') {
              setCreatingFolder(false)
              setNewFolderName('')
            }
          }}
        />
      )}

      {loading ? (
        <p className="muted">Lade Inhalt…</p>
      ) : isEmpty && !creatingFolder ? (
        <div className="empty">
          <p>Dieser Ordner ist leer.</p>
          <p className="muted">Importiere ein PDF oder lege einen Ordner an.</p>
        </div>
      ) : (
        <ul className="project-list">
          {folders.map((folder) => (
            <li key={`f${folder.id}`} className="project-item">
              {editing?.kind === 'folder' && editing.id === folder.id ? (
                <input
                  className="rename-input"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <button
                  className="project-main"
                  onClick={() => openFolder(folder)}
                  title="Ordner öffnen"
                >
                  <span className="project-name">📁 {folder.name}</span>
                  <span className="project-meta">Ordner · {formatDate(folder.createdAt)}</span>
                </button>
              )}

              <div className="project-actions">
                <button className="btn ghost" onClick={() => openFolder(folder)}>
                  Öffnen
                </button>
                <button
                  className="btn ghost"
                  onClick={() => startRename('folder', folder.id, folder.name)}
                >
                  Umbenennen
                </button>
                <button
                  className="btn ghost"
                  onClick={() => setMoveTarget({ kind: 'folder', folder })}
                >
                  Verschieben
                </button>
                <button className="btn ghost danger" onClick={() => handleDeleteFolder(folder)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}

          {projects.map((project) => (
            <li key={`p${project.id}`} className="project-item">
              {editing?.kind === 'project' && editing.id === project.id ? (
                <input
                  className="rename-input"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <button className="project-main" onClick={() => onOpen(project)} title="Projekt öffnen">
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
                <button
                  className="btn ghost"
                  onClick={() => startRename('project', project.id, project.name)}
                >
                  Umbenennen
                </button>
                <button
                  className="btn ghost"
                  onClick={() => setMoveTarget({ kind: 'project', project })}
                >
                  Verschieben
                </button>
                <button className="btn ghost danger" onClick={() => handleDeleteProject(project)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {moveTarget && (
        <FolderPicker
          title={
            moveTarget.kind === 'project'
              ? `„${moveTarget.project.name}" verschieben`
              : `„${moveTarget.folder.name}" verschieben`
          }
          currentParentId={
            moveTarget.kind === 'project'
              ? moveTarget.project.folderId
              : moveTarget.folder.parentId
          }
          excludeSubtreeOf={moveTarget.kind === 'folder' ? moveTarget.folder.id : undefined}
          onPick={handleMove}
          onCancel={() => setMoveTarget(null)}
        />
      )}
    </main>
  )
}
