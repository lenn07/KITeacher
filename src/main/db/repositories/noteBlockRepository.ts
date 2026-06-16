/**
 * Datenzugriff für die seitenbezogenen Notiz-Blöcke (Logseq-artiger Outliner).
 *
 * Notizen einer Seite sind eine geordnete Liste von Blöcken. Der Renderer hält
 * den Bearbeitungsstand und ist die Quelle der Wahrheit für Reihenfolge und
 * Verschachtelung – deshalb wird beim Speichern die komplette Liste in einer
 * Transaktion ersetzt (alte Blöcke löschen, neue einfügen) statt einzeln zu
 * pflegen. Bei der überschaubaren Block-Zahl pro Seite ist das einfach und robust.
 */
import type { NoteBlock, NoteBlockInput } from '@shared/domain'
import { getDb } from '../database'

interface NoteBlockRow {
  id: number
  page_id: number
  position: number
  indent: number
  content: string
}

function toNoteBlock(row: NoteBlockRow): NoteBlock {
  return {
    id: row.id,
    pageId: row.page_id,
    position: row.position,
    indent: row.indent,
    content: row.content
  }
}

export const noteBlockRepository = {
  /** Notiz-Blöcke einer Seite, in Reihenfolge (`position`). */
  listByPage(pageId: number): NoteBlock[] {
    const rows = getDb()
      .prepare('SELECT * FROM note_blocks WHERE page_id = ? ORDER BY position ASC')
      .all(pageId) as NoteBlockRow[]
    return rows.map(toNoteBlock)
  },

  /**
   * Ersetzt alle Blöcke einer Seite durch die übergebene Liste (in einer
   * Transaktion) und liefert den gespeicherten Stand. Die `position` wird aus
   * der Eingabe übernommen, damit Renderer und DB dieselbe Reihenfolge teilen.
   */
  replaceForPage(pageId: number, blocks: NoteBlockInput[]): NoteBlock[] {
    const db = getDb()
    const replace = db.transaction((items: NoteBlockInput[]) => {
      db.prepare('DELETE FROM note_blocks WHERE page_id = ?').run(pageId)
      const insert = db.prepare(
        'INSERT INTO note_blocks (page_id, position, indent, content) VALUES (?, ?, ?, ?)'
      )
      for (const block of items) {
        insert.run(pageId, block.position, block.indent, block.content)
      }
    })
    replace(blocks)
    return this.listByPage(pageId)
  }
}
