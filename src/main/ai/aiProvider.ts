/**
 * KI hinter einem Interface (Architektur-Prinzip aus CLAUDE.md).
 *
 * Die App-Logik spricht ausschließlich gegen dieses Interface, nie direkt
 * gegen ein SDK. So lässt sich später ein anderes Modell, ein anderer Provider
 * oder ein lokales LLM einsetzen, ohne die übrigen Schichten anzufassen.
 *
 * In Etappe 5 braucht das Interface nur den Verbindungstest; die Methoden für
 * Seiten-Erklärung und Chat kommen in Etappe 6 dazu.
 */

/** Zugangsdaten für einen einzelnen KI-Aufruf. */
export interface AIProviderConfig {
  apiKey: string
  model: string
}

export interface AIProvider {
  /**
   * Prüft, ob mit den gegebenen Zugangsdaten eine Verbindung möglich ist.
   * Wirft bei Misserfolg (z. B. ungültiger Key); die Übersetzung in eine
   * menschenlesbare Meldung passiert in der aufrufenden Schicht.
   */
  testConnection(config: AIProviderConfig): Promise<void>
}
