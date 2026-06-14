/**
 * Zentrale Einstellungs-Typen und -Defaults (Etappe 5).
 *
 * Diese Typen werden von Main (Settings-Store, KI-Service) und Renderer
 * (Einstellungen-UI) gemeinsam genutzt. Der API-Key ist hier bewusst NICHT
 * enthalten: er verlässt den Main-Prozess nie im Klartext. Die UI erfährt nur
 * über `hasApiKey`, ob ein Key hinterlegt ist.
 */

/** Wie ausführlich die KI eine Seite erklären soll. */
export type ExplanationLevel = 'einfach' | 'standard' | 'detailliert'

/** Nicht-geheime Einstellungen (in `settings.json` im App-Datenordner). */
export interface AppSettings {
  /** Claude-Modell-ID für Erklärungen und Chat. */
  model: string
  /** Erklär-Niveau (didaktische Tiefe). */
  explanationLevel: ExplanationLevel
  /** Nächste Seite im Hintergrund vorausladen (Token-Komfort vs. -Sparen). */
  prefetchEnabled: boolean
}

/**
 * Stand, den der Renderer von den Einstellungen sieht: die offenen
 * Einstellungen plus die Information, ob ein API-Key gespeichert ist.
 */
export interface SettingsState extends AppSettings {
  hasApiKey: boolean
}

/** Standardwerte für ein frisches Profil. */
export const DEFAULT_SETTINGS: AppSettings = {
  model: 'claude-opus-4-8',
  explanationLevel: 'standard',
  prefetchEnabled: true
}

/** Auswahl der Modelle in der UI (kuratiert, an einer Stelle pflegbar). */
export interface ModelOption {
  id: string
  label: string
  hint: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', hint: 'Höchste Qualität' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', hint: 'Ausgewogen' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'Schnell & günstig' }
]

/** Beschriftungen der Erklär-Niveaus in der UI. */
export const EXPLANATION_LEVEL_OPTIONS: { id: ExplanationLevel; label: string }[] = [
  { id: 'einfach', label: 'Einfach (für Einsteiger)' },
  { id: 'standard', label: 'Standard' },
  { id: 'detailliert', label: 'Detailliert (mit Hintergründen)' }
]

/**
 * Ergebnis eines Verbindungstests. Bei Misserfolg eine menschenlesbare,
 * deutsche Begründung – kein roher Fehler-Stack.
 */
export type ConnectionTestResult = { ok: true } | { ok: false; message: string }
