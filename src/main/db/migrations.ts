/**
 * Versionierte Schema-Migrationen.
 *
 * Jede Migration hat eine fortlaufende `version`. Beim Start vergleicht der
 * Runner (siehe database.ts) die in der DB gespeicherte `PRAGMA user_version`
 * mit der höchsten bekannten Migration und spielt alle fehlenden der Reihe
 * nach in einer Transaktion ein. So bleiben bestehende Projekte erhalten und
 * Schema-Änderungen sind nachvollziehbar.
 *
 * Neue Änderungen NIE in bestehende Migrationen schreiben, sondern immer eine
 * neue mit nächsthöherer Version anhängen.
 */
import type { Database } from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: Database) => void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initiales-schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE projects (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL,
          pdf_path    TEXT    NOT NULL,
          page_count  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE pages (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          page_number  INTEGER NOT NULL,
          explanation  TEXT,
          generated_at TEXT,
          UNIQUE (project_id, page_number)
        );

        CREATE TABLE chat_messages (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
          role        TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
          content     TEXT    NOT NULL,
          created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX idx_pages_project       ON pages(project_id);
        CREATE INDEX idx_chat_messages_page  ON chat_messages(page_id);
      `)
    }
  },
  {
    version: 2,
    name: 'projekt-zuletzt-gelesene-seite',
    up: (db) => {
      // Merkt sich pro Projekt die zuletzt geöffnete Seite, damit man beim
      // Wiederöffnen dort weitermacht statt auf Seite 1. Bestand: Default 1.
      db.exec(`ALTER TABLE projects ADD COLUMN last_page INTEGER NOT NULL DEFAULT 1;`)
    }
  }
]

/** Höchste bekannte Schema-Version (Ziel des Migrations-Runners). */
export const latestSchemaVersion = migrations.reduce(
  (max, m) => Math.max(max, m.version),
  0
)
