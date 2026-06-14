/**
 * Zentraler, typisierter IPC-Vertrag zwischen Main- und Renderer-Prozess.
 *
 * Hier wird festgelegt, welche Funktionen der Renderer über die Preload-Bridge
 * aufrufen darf. Main und Renderer teilen sich diese Typen, damit beide Seiten
 * garantiert zusammenpassen. Neue Features ergänzen hier ihre Kanäle.
 */
import type { Project } from './domain'

/** Kanal-Namen an einer Stelle, um Tippfehler zwischen Main/Preload zu vermeiden. */
export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  projectsList: 'projects:list',
  projectsImport: 'projects:import',
  projectsRename: 'projects:rename',
  projectsDelete: 'projects:delete',
  projectsGet: 'projects:get',
  projectsReadPdf: 'projects:readPdf',
  projectsSetPageCount: 'projects:setPageCount'
} as const

/** API rund um Projekte (Übersicht, Import, Umbenennen, Öffnen, Löschen). */
export interface ProjectsApi {
  /** Alle Projekte, neueste zuerst (für die Übersicht). */
  list: () => Promise<Project[]>
  /**
   * Öffnet einen Datei-Dialog zum PDF-Import, kopiert die Datei in den
   * App-Datenordner und legt ein Projekt an. `null`, wenn der Nutzer abbricht.
   */
  import: () => Promise<Project | null>
  /** Benennt ein Projekt um und liefert den aktualisierten Stand. */
  rename: (id: number, name: string) => Promise<Project | null>
  /** Löscht ein Projekt samt PDF-Datei (Seiten/Chats per CASCADE). */
  delete: (id: number) => Promise<void>
  /** Einzelnes Projekt oder `null` (z. B. zum Öffnen). */
  getById: (id: number) => Promise<Project | null>
  /**
   * Liefert die Roh-Bytes der PDF-Kopie eines Projekts. Der Renderer hat keinen
   * Datei-Zugriff – pdf.js bekommt die Bytes über diese Bridge.
   */
  readPdf: (id: number) => Promise<Uint8Array>
  /**
   * Trägt die tatsächliche Seitenzahl nach (beim Import noch 0). Wird vom
   * PDF-Viewer aufgerufen, sobald pdf.js das Dokument geladen hat.
   */
  setPageCount: (id: number, pageCount: number) => Promise<void>
}

/**
 * Die API, die im Renderer unter `window.api` zur Verfügung steht.
 * Wird vom Preload-Skript implementiert und hier nur typisiert.
 */
export interface KiTeacherApi {
  /** Liefert die App-Version (Smoke-Test für die IPC-Bridge). */
  getAppVersion: () => Promise<string>
  /** Projekt-Verwaltung (siehe ProjectsApi). */
  projects: ProjectsApi
}
