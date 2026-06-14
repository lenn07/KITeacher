/**
 * Zentrale Stelle für alle Pfade im App-Datenordner.
 *
 * Electron legt pro App einen `userData`-Ordner an (OS-abhängig, z. B. unter
 * macOS `~/Library/Application Support/KITeacher`). Dort liegen die SQLite-DB
 * und die importierten PDFs – sauber getrennt vom Projektcode.
 */
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

/** Wurzel des App-Datenordners (von Electron verwaltet). */
export function userDataDir(): string {
  return app.getPath('userData')
}

/** Dateipfad der SQLite-Datenbank. */
export function databasePath(): string {
  return join(userDataDir(), 'kiteacher.db')
}

/** Ordner, in dem die importierten PDFs abgelegt werden. */
export function pdfStorageDir(): string {
  return join(userDataDir(), 'pdfs')
}

/**
 * Stellt sicher, dass alle benötigten Ordner existieren. Wird einmal beim
 * App-Start aufgerufen, bevor die DB geöffnet wird.
 */
export function ensureStorageDirs(): void {
  mkdirSync(userDataDir(), { recursive: true })
  mkdirSync(pdfStorageDir(), { recursive: true })
}
