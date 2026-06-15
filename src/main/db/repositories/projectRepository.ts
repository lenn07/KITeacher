/**
 * Datenzugriff für Projekte. Kapselt SQL und die Übersetzung zwischen den
 * snake_case-Spalten der DB und den camelCase-Domänentypen.
 */
import type { Project, NewProject } from '@shared/domain'
import { getDb } from '../database'

/** Rohzeile, wie sie aus der DB kommt (snake_case). */
interface ProjectRow {
  id: number
  name: string
  folder_id: number | null
  pdf_path: string
  page_count: number
  last_page: number
  created_at: string
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    pdfPath: row.pdf_path,
    pageCount: row.page_count,
    lastPage: row.last_page,
    createdAt: row.created_at
  }
}

export const projectRepository = {
  /** Legt ein Projekt an und liefert es inklusive vergebener id zurück. */
  create(input: NewProject): Project {
    const result = getDb()
      .prepare(
        'INSERT INTO projects (name, folder_id, pdf_path, page_count) VALUES (?, ?, ?, ?)'
      )
      .run(input.name, input.folderId, input.pdfPath, input.pageCount)
    return this.getById(Number(result.lastInsertRowid))!
  },

  /**
   * Projekte eines Ordners (neueste zuerst). `null` liefert die Projekte der
   * Wurzelebene. SQLite-`IS` deckt sowohl NULL als auch konkrete Werte ab.
   */
  listByFolder(folderId: number | null): Project[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM projects WHERE folder_id IS ? ORDER BY created_at DESC, id DESC'
      )
      .all(folderId) as ProjectRow[]
    return rows.map(toProject)
  },

  /** Einzelnes Projekt oder `null`, falls nicht vorhanden. */
  getById(id: number): Project | null {
    const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | ProjectRow
      | undefined
    return row ? toProject(row) : null
  },

  /** Benennt ein Projekt um. */
  rename(id: number, name: string): void {
    getDb().prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id)
  },

  /** Trägt die tatsächliche Seitenzahl nach (beim Import noch 0). */
  setPageCount(id: number, pageCount: number): void {
    getDb().prepare('UPDATE projects SET page_count = ? WHERE id = ?').run(pageCount, id)
  },

  /** Merkt sich die zuletzt geöffnete Seite eines Projekts. */
  setLastPage(id: number, lastPage: number): void {
    getDb().prepare('UPDATE projects SET last_page = ? WHERE id = ?').run(lastPage, id)
  },

  /** Verschiebt ein Projekt in einen anderen Ordner (`null` = Wurzelebene). */
  move(id: number, folderId: number | null): void {
    getDb().prepare('UPDATE projects SET folder_id = ? WHERE id = ?').run(folderId, id)
  },

  /** Löscht ein Projekt; Seiten und Chats verschwinden per ON DELETE CASCADE. */
  delete(id: number): void {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}
