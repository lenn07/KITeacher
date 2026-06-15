/**
 * Datenzugriff für Ordner. Kapselt SQL und die Übersetzung zwischen den
 * snake_case-Spalten der DB und den camelCase-Domänentypen.
 *
 * Ordner sind verschachtelbar: `parent_id` referenziert dieselbe Tabelle, `null`
 * steht für die Wurzelebene. Das Löschen läuft über `ON DELETE CASCADE` (siehe
 * Migration v3); die zugehörigen PDF-Dateien räumt der Handler vorher anhand von
 * `collectDescendantPdfPaths` weg.
 */
import type { Folder, NewFolder } from '@shared/domain'
import { getDb } from '../database'

/** Rohzeile, wie sie aus der DB kommt (snake_case). */
interface FolderRow {
  id: number
  name: string
  parent_id: number | null
  created_at: string
}

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at
  }
}

export const folderRepository = {
  /** Legt einen Ordner an und liefert ihn inklusive vergebener id zurück. */
  create(input: NewFolder): Folder {
    const result = getDb()
      .prepare('INSERT INTO folders (name, parent_id) VALUES (?, ?)')
      .run(input.name, input.parentId)
    return this.getById(Number(result.lastInsertRowid))!
  },

  /**
   * Direkte Unterordner eines Ordners, alphabetisch. `null` liefert die Ordner
   * der Wurzelebene. SQLite-`IS` deckt sowohl NULL als auch konkrete Werte ab.
   */
  listByParent(parentId: number | null): Folder[] {
    const rows = getDb()
      .prepare('SELECT * FROM folders WHERE parent_id IS ? ORDER BY name COLLATE NOCASE')
      .all(parentId) as FolderRow[]
    return rows.map(toFolder)
  },

  /** Alle Ordner (für die Zielauswahl beim Verschieben), alphabetisch. */
  listAll(): Folder[] {
    const rows = getDb()
      .prepare('SELECT * FROM folders ORDER BY name COLLATE NOCASE')
      .all() as FolderRow[]
    return rows.map(toFolder)
  },

  /** Einzelner Ordner oder `null`, falls nicht vorhanden. */
  getById(id: number): Folder | null {
    const row = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as
      | FolderRow
      | undefined
    return row ? toFolder(row) : null
  },

  /** Benennt einen Ordner um. */
  rename(id: number, name: string): void {
    getDb().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
  },

  /** Verschiebt einen Ordner unter einen neuen Elternordner (`null` = Wurzel). */
  move(id: number, parentId: number | null): void {
    getDb().prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parentId, id)
  },

  /**
   * Prüft, ob `candidateId` der Ordner `id` selbst oder einer seiner Nachfahren
   * ist. Damit verhindert der Handler beim Verschieben Zyklen (ein Ordner darf
   * nicht in sich selbst oder einen seiner Unterordner wandern).
   */
  isDescendantOrSelf(id: number, candidateId: number): boolean {
    const row = getDb()
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM folders WHERE id = ?
           UNION ALL
           SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id
         )
         SELECT 1 FROM sub WHERE id = ? LIMIT 1`
      )
      .get(id, candidateId)
    return row !== undefined
  },

  /**
   * PDF-Pfade aller Projekte im Teilbaum unter `id` (inkl. des Ordners selbst).
   * Vor dem Kaskaden-Löschen aufgerufen, um die PDF-Dateien zu entfernen.
   */
  collectDescendantPdfPaths(id: number): string[] {
    const rows = getDb()
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM folders WHERE id = ?
           UNION ALL
           SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id
         )
         SELECT pdf_path FROM projects WHERE folder_id IN (SELECT id FROM sub)`
      )
      .all(id) as { pdf_path: string }[]
    return rows.map((r) => r.pdf_path)
  },

  /** Löscht einen Ordner; Unterordner und Projekte verschwinden per CASCADE. */
  delete(id: number): void {
    getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
  }
}
