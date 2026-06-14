/**
 * Zentraler, typisierter IPC-Vertrag zwischen Main- und Renderer-Prozess.
 *
 * Hier wird festgelegt, welche Funktionen der Renderer über die Preload-Bridge
 * aufrufen darf. Main und Renderer teilen sich diese Typen, damit beide Seiten
 * garantiert zusammenpassen. Neue Features ergänzen hier ihre Kanäle.
 */
import type { Project } from './domain'
import type { AppSettings, ConnectionTestResult, SettingsState } from './settings'

/** Kanal-Namen an einer Stelle, um Tippfehler zwischen Main/Preload zu vermeiden. */
export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  projectsList: 'projects:list',
  projectsImport: 'projects:import',
  projectsRename: 'projects:rename',
  projectsDelete: 'projects:delete',
  projectsGet: 'projects:get',
  projectsReadPdf: 'projects:readPdf',
  projectsSetPageCount: 'projects:setPageCount',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsSetApiKey: 'settings:setApiKey',
  settingsClearApiKey: 'settings:clearApiKey',
  settingsTestConnection: 'settings:testConnection'
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
 * API rund um Einstellungen und API-Key (Etappe 5).
 *
 * Der API-Key wird im OS-Keychain (`safeStorage`) gespeichert und verlässt den
 * Main-Prozess nie im Klartext – darum gibt es kein `getApiKey`. Die UI fragt
 * nur über `get().hasApiKey` ab, ob ein Key hinterlegt ist.
 */
export interface SettingsApi {
  /** Aktuelle Einstellungen inkl. `hasApiKey`-Flag. */
  get: () => Promise<SettingsState>
  /** Speichert (teilweise) geänderte Einstellungen und liefert den neuen Stand. */
  save: (settings: Partial<AppSettings>) => Promise<SettingsState>
  /** Hinterlegt den API-Key sicher im Keychain. */
  setApiKey: (apiKey: string) => Promise<void>
  /** Entfernt den gespeicherten API-Key. */
  clearApiKey: () => Promise<void>
  /**
   * Prüft die Verbindung zur Claude-API. Mit `apiKey` wird ein noch nicht
   * gespeicherter Key getestet, sonst der hinterlegte. Liefert ein Ergebnis
   * mit deutscher Begründung statt zu werfen.
   */
  testConnection: (model: string, apiKey?: string) => Promise<ConnectionTestResult>
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
  /** Einstellungen & API-Key (siehe SettingsApi). */
  settings: SettingsApi
}
