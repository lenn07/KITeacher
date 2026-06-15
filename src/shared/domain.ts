/**
 * Zentrale Domänentypen der App (Datenmodell aus CLAUDE.md).
 *
 * Diese Typen werden von Main (Repositories) und Renderer (UI) gemeinsam
 * genutzt, damit beide Seiten dieselbe Vorstellung der Daten haben. Die
 * Spaltennamen der Datenbank sind snake_case, hier in der TS-Welt camelCase –
 * die Übersetzung passiert ausschließlich in den Repositories.
 *
 * Beziehung: Project → Page → ChatMessage.
 */

/** Ein importiertes PDF samt Metadaten. */
export interface Project {
  id: number
  /** Anzeigename, Standard = PDF-Dateiname, vom Nutzer umbenennbar. */
  name: string
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

/** Daten zum Anlegen eines Projekts. */
export interface NewProject {
  name: string
  pdfPath: string
  pageCount: number
}

/** Daten zum Anlegen einer Chat-Nachricht. */
export interface NewChatMessage {
  pageId: number
  role: ChatRole
  content: string
}

// --- KI-Erklärung (Etappe 6) ---------------------------------------------

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
  | { ok: false; message: string }

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
  | { ok: false; message: string }
