/**
 * Öffnet die SQLite-Datenbank und hält die Singleton-Verbindung.
 *
 * Verantwortlich für Verbindungsaufbau, sinnvolle PRAGMAs und das Einspielen
 * der Migrationen. Repositories bekommen die offene Verbindung über `getDb()`.
 */
import Database from 'better-sqlite3'
import { databasePath, ensureStorageDirs } from '../storage/paths'
import { migrations, latestSchemaVersion } from './migrations'

let db: Database.Database | null = null

/**
 * Initialisiert die Datenbank: legt Ordner an, öffnet die Datei, setzt PRAGMAs
 * und führt ausstehende Migrationen aus. Einmal beim App-Start aufrufen.
 */
export function initDatabase(): Database.Database {
  if (db) return db

  ensureStorageDirs()

  const connection = new Database(databasePath())
  // WAL: bessere Nebenläufigkeit/Robustheit; foreign_keys: CASCADE-Löschen aktiv.
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')

  runMigrations(connection)

  db = connection
  return db
}

/** Liefert die offene Verbindung; wirft, wenn vor `initDatabase()` aufgerufen. */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Datenbank nicht initialisiert – zuerst initDatabase() aufrufen.')
  }
  return db
}

/** Schließt die Verbindung sauber (beim App-Beenden). */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Spielt alle Migrationen ein, deren Version über der gespeicherten
 * `user_version` liegt – jede in ihrer eigenen Transaktion.
 */
function runMigrations(connection: Database.Database): void {
  const current = connection.pragma('user_version', { simple: true }) as number
  if (current >= latestSchemaVersion) return

  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    const apply = connection.transaction(() => {
      migration.up(connection)
      // user_version akzeptiert keine Parameterbindung → Wert direkt einsetzen.
      connection.pragma(`user_version = ${migration.version}`)
    })
    apply()
  }
}
