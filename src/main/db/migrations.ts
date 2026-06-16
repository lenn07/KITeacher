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
  },
  {
    version: 3,
    name: 'ordner-fuer-projekte',
    up: (db) => {
      // Verschachtelbare Ordner: `parent_id` referenziert die eigene Tabelle
      // (NULL = Wurzel). Projekte bekommen `folder_id` (NULL = Wurzel). Beide
      // FKs mit ON DELETE CASCADE – das Löschen eines Ordners entfernt rekursiv
      // Unterordner und Projekte (foreign_keys ist aktiv, siehe database.ts).
      // Bestehende Projekte haben folder_id = NULL und bleiben auf der Wurzel.
      db.exec(`
        CREATE TABLE folders (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL,
          parent_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
          created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        ALTER TABLE projects
          ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE;

        CREATE INDEX idx_folders_parent  ON folders(parent_id);
        CREATE INDEX idx_projects_folder ON projects(folder_id);
      `)
    }
  },
  {
    version: 4,
    name: 'notizen-bloecke-pro-seite',
    up: (db) => {
      // Logseq-artige Notizen pro Seite: jede Notiz ist eine Liste von Blöcken
      // (Outliner). `position` legt die Reihenfolge fest, `indent` die
      // Verschachtelungstiefe (0 = oberste Ebene). `content` ist roher Markdown
      // (inkl. Mathe), der im UI gerendert wird. FK an die Seite mit ON DELETE
      // CASCADE – Notizen verschwinden mit Projekt/Ordner.
      db.exec(`
        CREATE TABLE note_blocks (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
          position   INTEGER NOT NULL,
          indent     INTEGER NOT NULL DEFAULT 0,
          content    TEXT    NOT NULL DEFAULT '',
          created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX idx_note_blocks_page ON note_blocks(page_id);
      `)
    }
  }
]

/** Höchste bekannte Schema-Version (Ziel des Migrations-Runners). */
export const latestSchemaVersion = migrations.reduce(
  (max, m) => Math.max(max, m.version),
  0
)
