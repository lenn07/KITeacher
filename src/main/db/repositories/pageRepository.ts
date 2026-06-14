/**
 * Datenzugriff für Seiten samt zwischengespeichertem KI-Erklärtext.
 *
 * Seiten werden on-demand angelegt: erst wenn eine Seite geöffnet wird, gibt es
 * eine Zeile. `getOrCreate` stellt sicher, dass genau eine Zeile pro
 * (Projekt, Seitennummer) existiert.
 */
import type { Page } from '@shared/domain'
import { getDb } from '../database'

interface PageRow {
  id: number
  project_id: number
  page_number: number
  explanation: string | null
  generated_at: string | null
}

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    projectId: row.project_id,
    pageNumber: row.page_number,
    explanation: row.explanation,
    generatedAt: row.generated_at
  }
}

export const pageRepository = {
  /** Seite eines Projekts oder `null`, falls noch nicht angelegt. */
  getByNumber(projectId: number, pageNumber: number): Page | null {
    const row = getDb()
      .prepare('SELECT * FROM pages WHERE project_id = ? AND page_number = ?')
      .get(projectId, pageNumber) as PageRow | undefined
    return row ? toPage(row) : null
  },

  /** Liefert die Seite und legt sie bei Bedarf (ohne Erklärtext) an. */
  getOrCreate(projectId: number, pageNumber: number): Page {
    const existing = this.getByNumber(projectId, pageNumber)
    if (existing) return existing

    getDb()
      .prepare('INSERT INTO pages (project_id, page_number) VALUES (?, ?)')
      .run(projectId, pageNumber)
    return this.getByNumber(projectId, pageNumber)!
  },

  /** Alle bisher angelegten Seiten eines Projekts, nach Seitennummer sortiert. */
  listByProject(projectId: number): Page[] {
    const rows = getDb()
      .prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY page_number ASC')
      .all(projectId) as PageRow[]
    return rows.map(toPage)
  },

  /**
   * Speichert den erzeugten Erklärtext einer Seite (legt sie bei Bedarf an) und
   * setzt den Generierungs-Zeitstempel. Liefert die aktualisierte Seite.
   */
  saveExplanation(projectId: number, pageNumber: number, explanation: string): Page {
    const page = this.getOrCreate(projectId, pageNumber)
    getDb()
      .prepare(
        `UPDATE pages
         SET explanation = ?, generated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(explanation, page.id)
    return this.getByNumber(projectId, pageNumber)!
  }
}
