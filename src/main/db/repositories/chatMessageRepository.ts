/**
 * Datenzugriff für den seitenbezogenen Chat-Verlauf.
 */
import type { ChatMessage, NewChatMessage } from '@shared/domain'
import { getDb } from '../database'

interface ChatMessageRow {
  id: number
  page_id: number
  role: ChatMessage['role']
  content: string
  created_at: string
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    pageId: row.page_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }
}

export const chatMessageRepository = {
  /** Hängt eine Nachricht an den Verlauf einer Seite an. */
  add(input: NewChatMessage): ChatMessage {
    const result = getDb()
      .prepare('INSERT INTO chat_messages (page_id, role, content) VALUES (?, ?, ?)')
      .run(input.pageId, input.role, input.content)
    const row = getDb()
      .prepare('SELECT * FROM chat_messages WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ChatMessageRow
    return toChatMessage(row)
  },

  /** Verlauf einer Seite in zeitlicher Reihenfolge. */
  listByPage(pageId: number): ChatMessage[] {
    const rows = getDb()
      .prepare('SELECT * FROM chat_messages WHERE page_id = ? ORDER BY id ASC')
      .all(pageId) as ChatMessageRow[]
    return rows.map(toChatMessage)
  },

  /** Löscht den gesamten Verlauf einer Seite. */
  clearByPage(pageId: number): void {
    getDb().prepare('DELETE FROM chat_messages WHERE page_id = ?').run(pageId)
  }
}
