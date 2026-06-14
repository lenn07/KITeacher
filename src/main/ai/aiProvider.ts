/**
 * KI hinter einem Interface (Architektur-Prinzip aus CLAUDE.md).
 *
 * Die App-Logik spricht ausschließlich gegen dieses Interface, nie direkt
 * gegen ein SDK. So lässt sich später ein anderes Modell, ein anderer Provider
 * oder ein lokales LLM einsetzen, ohne die übrigen Schichten anzufassen.
 *
 * Etappe 5 brachte den Verbindungstest, Etappe 6 die Seiten-Erklärung (Vision);
 * der Chat kommt in Etappe 7 dazu.
 */
import type { ChatRole, PageImage } from '@shared/domain'
import type { ExplanationLevel } from '@shared/settings'

/** Zugangsdaten für einen einzelnen KI-Aufruf. */
export interface AIProviderConfig {
  apiKey: string
  model: string
}

/** Eingabe für die Seiten-Erklärung: das Seitenbild und das gewünschte Niveau. */
export interface ExplainPageOptions {
  image: PageImage
  level: ExplanationLevel
}

/** Eine Nachricht im Chat-Verlauf, wie sie der Provider erwartet (ohne DB-Felder). */
export interface ChatTurn {
  role: ChatRole
  content: string
}

/**
 * Eingabe für eine Chat-Rückfrage: Seitenbild und Erklärtext als Kontext, das
 * Niveau für den Stil und der bisherige Verlauf inklusive der aktuellen Frage
 * (letzte Nachricht, Rolle `user`).
 */
export interface ChatOptions {
  image: PageImage
  /** Gecachter Erklärtext der Seite oder `null`, falls noch nicht erzeugt. */
  explanation: string | null
  level: ExplanationLevel
  history: ChatTurn[]
}

export interface AIProvider {
  /**
   * Prüft, ob mit den gegebenen Zugangsdaten eine Verbindung möglich ist.
   * Wirft bei Misserfolg (z. B. ungültiger Key); die Übersetzung in eine
   * menschenlesbare Meldung passiert in der aufrufenden Schicht.
   */
  testConnection(config: AIProviderConfig): Promise<void>

  /**
   * Erzeugt aus dem Seitenbild einen didaktischen Erklärtext (Vision). Wirft bei
   * Misserfolg; die aufrufende Schicht übersetzt den Fehler und cacht das Ergebnis.
   */
  explainPage(config: AIProviderConfig, options: ExplainPageOptions): Promise<string>

  /**
   * Beantwortet eine Rückfrage zur Seite mit Bild + Erklärtext + Verlauf als
   * Kontext (Vision). Liefert den reinen Antworttext. Wirft bei Misserfolg; die
   * aufrufende Schicht übersetzt den Fehler und speichert das Ergebnis.
   */
  chat(config: AIProviderConfig, options: ChatOptions): Promise<string>
}
