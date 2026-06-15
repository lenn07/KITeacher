/**
 * Zentrale Domänentypen der App (Datenmodell aus CLAUDE.md).
 *
 * Diese Typen werden von Main (Repositories) und Renderer (UI) gemeinsam
 * genutzt, damit beide Seiten dieselbe Vorstellung der Daten haben. Die
 * Spaltennamen der Datenbank sind snake_case, hier in der TS-Welt camelCase –
 * die Übersetzung passiert ausschließlich in den Repositories.
 *
 * Beziehung: Folder → (Folder | Project) → Page → ChatMessage.
 */

/**
 * Ein verschachtelbarer Ordner zum Gruppieren von Projekten. Ordner können in
 * Ordnern liegen (`parentId`); `null` bedeutet Wurzelebene.
 */
export interface Folder {
  id: number
  /** Anzeigename des Ordners. */
  name: string
  /** Übergeordneter Ordner, `null` = Wurzelebene. */
  parentId: number | null
  /** ISO-8601-Zeitstempel der Erstellung. */
  createdAt: string
}

/** Ein importiertes PDF samt Metadaten. */
export interface Project {
  id: number
  /** Anzeigename, Standard = PDF-Dateiname, vom Nutzer umbenennbar. */
  name: string
  /** Ordner, in dem das Projekt liegt; `null` = Wurzelebene. */
  folderId: number | null
  /** Pfad zur PDF-Kopie im App-Datenordner. */
  pdfPath: string
  /** Anzahl Seiten des PDFs (0 bis bekannt). */
  pageCount: number
  /** Zuletzt geöffnete Seite (1-basiert); beim Wiederöffnen startet man hier. */
  lastPage: number
  /** ISO-8601-Zeitstempel der Erstellung. */
  createdAt: string
}

/** Eine einzelne PDF-Seite mit – sobald erzeugt – ihrem KI-Erklärtext. */
export interface Page {
  id: number
  projectId: number
  /** 1-basierte Seitennummer im PDF. */
  pageNumber: number
  /** KI-Erklärtext, `null` solange noch nicht generiert (On-Demand-Caching). */
  explanation: string | null
  /** ISO-8601-Zeitstempel der Texterzeugung, `null` solange nicht generiert. */
  generatedAt: string | null
}

/**
 * Ein Notiz-Block einer Seite (Logseq-artiger Outliner).
 *
 * Notizen pro Seite sind eine geordnete Liste solcher Blöcke. `position` legt
 * die Reihenfolge fest, `indent` die Verschachtelungstiefe (0 = oberste Ebene),
 * `content` ist roher Markdown (inkl. Mathe), der im UI gerendert wird.
 */
export interface NoteBlock {
  id: number
  pageId: number
  /** Reihenfolge innerhalb der Seite (0-basiert). */
  position: number
  /** Verschachtelungstiefe (0 = oberste Ebene). */
  indent: number
  /** Roher Markdown-Inhalt des Blocks. */
  content: string
}

/** Rolle einer Chat-Nachricht im seitenbezogenen Verlauf. */
export type ChatRole = 'user' | 'assistant'

/** Eine Nachricht im Chat-Verlauf einer Seite. */
export interface ChatMessage {
  id: number
  pageId: number
  role: ChatRole
  content: string
  /** ISO-8601-Zeitstempel. */
  createdAt: string
}

// --- Eingabetypen (ohne von der DB vergebene Felder) ---------------------

/** Daten zum Anlegen eines Ordners. */
export interface NewFolder {
  name: string
  /** Übergeordneter Ordner, `null` = Wurzelebene. */
  parentId: number | null
}

/** Daten zum Anlegen eines Projekts. */
export interface NewProject {
  name: string
  /** Ordner, in dem das Projekt liegt; `null` = Wurzelebene. */
  folderId: number | null
  pdfPath: string
  pageCount: number
}

/** Daten zum Anlegen einer Chat-Nachricht. */
export interface NewChatMessage {
  pageId: number
  role: ChatRole
  content: string
}

/**
 * Ein einzelner Notiz-Block beim Speichern (ohne von der DB vergebene Felder).
 * Die Notizen einer Seite werden als komplette Liste übergeben und ersetzt –
 * der Renderer ist die Quelle der Wahrheit für Reihenfolge und Verschachtelung.
 */
export interface NoteBlockInput {
  position: number
  indent: number
  content: string
}

// --- KI-Erklärung (Etappe 6) ---------------------------------------------

/**
 * Art eines fehlgeschlagenen KI-Aufrufs (Etappe 8). Trennt den behebbaren
 * Sonderfall „kein API-Key" von allgemeinen API-/Netzfehlern, damit die UI im
 * ersten Fall direkt zu den Einstellungen führen kann statt nur „erneut
 * versuchen" anzubieten.
 */
export type AiFailureKind = 'no-key' | 'ai'

/** Unterstützte Bildformate für die Vision-Anfrage. */
export type ImageMediaType = 'image/png' | 'image/jpeg'

/**
 * Eine als Base64-Bild gerenderte PDF-Seite. Der Renderer erzeugt sie mit
 * pdf.js und reicht sie über IPC an den Main-Prozess, der das Bild an Claude
 * (Vision) schickt – so werden auch Diagramme, Formeln und Layout erfasst.
 */
export interface PageImage {
  base64: string
  mediaType: ImageMediaType
}

/** Eingabe zum Erzeugen (oder gecacht Abrufen) eines Erklärtexts zu einer Seite. */
export interface GenerateExplanationInput {
  projectId: number
  pageNumber: number
  /** Seite als Bild (vom Renderer mit pdf.js gerendert). */
  image: PageImage
  /** Cache umgehen und neu generieren (z. B. „neu erklären"-Button). */
  force?: boolean
}

/**
 * Ergebnis einer Erklär-Anfrage. Wie beim Verbindungstest wird bei Misserfolg
 * eine deutsche Meldung zurückgegeben statt zu werfen (kein Key, API-Fehler),
 * damit die UI sie direkt anzeigen kann.
 */
export type ExplanationResult =
  | { ok: true; page: Page }
  | { ok: false; message: string; kind: AiFailureKind }

// --- Chat pro Seite (Etappe 7) -------------------------------------------

/**
 * Eingabe für eine Rückfrage im seitenbezogenen Chat. Die KI bekommt das
 * Seitenbild und den (gecachten) Erklärtext als Kontext – das Bild rendert der
 * Renderer mit pdf.js, den Erklärtext liest der Main-Prozess aus der DB.
 */
export interface SendChatMessageInput {
  projectId: number
  pageNumber: number
  /** Die Rückfrage der lernenden Person. */
  message: string
  /** Seite als Bild (vom Renderer mit pdf.js gerendert), als Vision-Kontext. */
  image: PageImage
}

/**
 * Ergebnis einer Chat-Anfrage. Bei Erfolg der vollständige, aktualisierte
 * Verlauf der Seite (inkl. neuer Frage + Antwort); bei Misserfolg eine deutsche
 * Meldung statt eines geworfenen Fehlers (kein Key, API-Problem). Bei Fehlern
 * wird nichts gespeichert – der Verlauf bleibt unverändert.
 */
export type ChatResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; message: string; kind: AiFailureKind }
