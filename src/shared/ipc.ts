/**
 * Zentraler, typisierter IPC-Vertrag zwischen Main- und Renderer-Prozess.
 *
 * Hier wird festgelegt, welche Funktionen der Renderer über die Preload-Bridge
 * aufrufen darf. Main und Renderer teilen sich diese Typen, damit beide Seiten
 * garantiert zusammenpassen. Neue Features ergänzen hier ihre Kanäle.
 */
import type {
  ChatMessage,
  ChatResult,
  ExplanationResult,
  Folder,
  GenerateExplanationInput,
  NoteBlock,
  NoteBlockInput,
  Page,
  Project,
  SendChatMessageInput
} from './domain'
import type { AppSettings, ConnectionTestResult, SettingsState } from './settings'

/** Kanal-Namen an einer Stelle, um Tippfehler zwischen Main/Preload zu vermeiden. */
export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  foldersList: 'folders:list',
  foldersListAll: 'folders:listAll',
  foldersCreate: 'folders:create',
  foldersRename: 'folders:rename',
  foldersMove: 'folders:move',
  foldersDelete: 'folders:delete',
  projectsList: 'projects:list',
  projectsImport: 'projects:import',
  projectsRename: 'projects:rename',
  projectsMove: 'projects:move',
  projectsDelete: 'projects:delete',
  projectsGet: 'projects:get',
  projectsReadPdf: 'projects:readPdf',
  projectsSetPageCount: 'projects:setPageCount',
  projectsSetLastPage: 'projects:setLastPage',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsSetApiKey: 'settings:setApiKey',
  settingsClearApiKey: 'settings:clearApiKey',
  settingsTestConnection: 'settings:testConnection',
  pagesGet: 'pages:get',
  pagesGenerateExplanation: 'pages:generateExplanation',
  chatList: 'chat:list',
  chatSend: 'chat:send',
  chatClear: 'chat:clear',
  notesList: 'notes:list',
  notesSave: 'notes:save'
} as const

/**
 * API rund um Ordner (verschachtelbares Gruppieren von Projekten).
 *
 * Ein Ordner kann in einem Ordner liegen (`parentId`); `null` steht für die
 * Wurzelebene. Das Löschen entfernt rekursiv Unterordner, Projekte und deren
 * PDF-Dateien.
 */
export interface FoldersApi {
  /** Direkte Unterordner eines Ordners (`null` = Wurzelebene), alphabetisch. */
  list: (parentId: number | null) => Promise<Folder[]>
  /** Alle Ordner flach (für die Zielauswahl beim Verschieben). */
  listAll: () => Promise<Folder[]>
  /** Legt einen Ordner an und liefert ihn zurück. */
  create: (name: string, parentId: number | null) => Promise<Folder>
  /** Benennt einen Ordner um und liefert den aktualisierten Stand. */
  rename: (id: number, name: string) => Promise<Folder | null>
  /**
   * Verschiebt einen Ordner unter einen neuen Elternordner (`null` = Wurzel).
   * Wirft, wenn das Ziel der Ordner selbst oder einer seiner Nachfahren ist.
   */
  move: (id: number, parentId: number | null) => Promise<Folder | null>
  /**
   * Löscht einen Ordner samt allen Unterordnern, Projekten und deren
   * PDF-Dateien (DB per CASCADE, Dateien vom Handler).
   */
  delete: (id: number) => Promise<void>
}

/** API rund um Projekte (Übersicht, Import, Umbenennen, Öffnen, Löschen). */
export interface ProjectsApi {
  /** Projekte eines Ordners (`null` = Wurzelebene), neueste zuerst. */
  list: (folderId: number | null) => Promise<Project[]>
  /**
   * Öffnet einen Datei-Dialog zum PDF-Import, kopiert die Datei in den
   * App-Datenordner und legt ein Projekt im angegebenen Ordner an (`null` =
   * Wurzelebene). `null`, wenn der Nutzer abbricht.
   */
  import: (folderId: number | null) => Promise<Project | null>
  /** Benennt ein Projekt um und liefert den aktualisierten Stand. */
  rename: (id: number, name: string) => Promise<Project | null>
  /** Verschiebt ein Projekt in einen Ordner (`null` = Wurzelebene). */
  move: (id: number, folderId: number | null) => Promise<Project | null>
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
  /**
   * Merkt sich die zuletzt geöffnete Seite, damit man beim Wiederöffnen des
   * Projekts dort weitermacht statt auf Seite 1.
   */
  setLastPage: (id: number, lastPage: number) => Promise<void>
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
 * API rund um Seiten und ihren KI-Erklärtext (Etappe 6).
 *
 * Erklärungen werden on-demand erzeugt und lokal gecacht. Der teure Vision-Aufruf
 * passiert nur, wenn noch kein Text vorliegt – sonst wird der gespeicherte
 * geliefert (Token-Sparen). Das Seitenbild rendert der Renderer mit pdf.js.
 */
export interface PagesApi {
  /** Gecachte Seite oder `null`, ohne KI-Aufruf (zum Prüfen, ob Text vorliegt). */
  get: (projectId: number, pageNumber: number) => Promise<Page | null>
  /**
   * Liefert den (gecachten) Erklärtext oder erzeugt ihn aus dem Seitenbild.
   * Gibt bei Fehlern (kein Key, API-Problem) ein Ergebnis mit deutscher
   * Begründung zurück, statt zu werfen.
   */
  generateExplanation: (input: GenerateExplanationInput) => Promise<ExplanationResult>
}

/**
 * API rund um den seitenbezogenen Chat (Etappe 7).
 *
 * Rückfragen an die KI mit Seitenbild + Erklärtext als Kontext. Der Verlauf wird
 * pro Seite gespeichert und beim Öffnen der Seite wieder geladen.
 */
export interface ChatApi {
  /** Gespeicherter Verlauf einer Seite (leer, falls noch keiner existiert). */
  list: (projectId: number, pageNumber: number) => Promise<ChatMessage[]>
  /**
   * Schickt eine Rückfrage an die KI (mit Bild + Erklärtext als Kontext) und
   * liefert den vollständigen aktualisierten Verlauf. Bei Fehlern (kein Key,
   * API-Problem) ein Ergebnis mit deutscher Begründung statt zu werfen; in dem
   * Fall wird nichts gespeichert.
   */
  send: (input: SendChatMessageInput) => Promise<ChatResult>
  /** Löscht den gesamten Verlauf einer Seite. */
  clear: (projectId: number, pageNumber: number) => Promise<void>
}

/**
 * API rund um die seitenbezogenen Notizen (Logseq-artiger Outliner).
 *
 * Notizen sind eine geordnete Liste von Blöcken pro Seite, rein lokal (kein
 * KI-Aufruf). Der Renderer hält den Bearbeitungsstand und schickt beim Speichern
 * die komplette Block-Liste, die der Main-Prozess für die Seite ersetzt.
 */
export interface NotesApi {
  /** Gespeicherte Notiz-Blöcke einer Seite (leer, falls noch keine existieren). */
  list: (projectId: number, pageNumber: number) => Promise<NoteBlock[]>
  /**
   * Ersetzt die Notiz-Blöcke einer Seite durch die übergebene Liste und liefert
   * den gespeicherten Stand zurück (mit von der DB vergebenen `id`s).
   */
  save: (
    projectId: number,
    pageNumber: number,
    blocks: NoteBlockInput[]
  ) => Promise<NoteBlock[]>
}

/**
 * Die API, die im Renderer unter `window.api` zur Verfügung steht.
 * Wird vom Preload-Skript implementiert und hier nur typisiert.
 */
export interface KiTeacherApi {
  /** Liefert die App-Version (Smoke-Test für die IPC-Bridge). */
  getAppVersion: () => Promise<string>
  /** Ordner-Verwaltung (siehe FoldersApi). */
  folders: FoldersApi
  /** Projekt-Verwaltung (siehe ProjectsApi). */
  projects: ProjectsApi
  /** Einstellungen & API-Key (siehe SettingsApi). */
  settings: SettingsApi
  /** Seiten-Erklärungen mit Caching (siehe PagesApi). */
  pages: PagesApi
  /** Seitenbezogener Chat (siehe ChatApi). */
  chat: ChatApi
  /** Seitenbezogene Notizen (siehe NotesApi). */
  notes: NotesApi
}
