/**
 * Zentraler, typisierter IPC-Vertrag zwischen Main- und Renderer-Prozess.
 *
 * Hier wird festgelegt, welche Funktionen der Renderer über die Preload-Bridge
 * aufrufen darf. Main und Renderer teilen sich diese Typen, damit beide Seiten
 * garantiert zusammenpassen. Neue Features ergänzen hier ihre Kanäle.
 */

/** Kanal-Namen an einer Stelle, um Tippfehler zwischen Main/Preload zu vermeiden. */
export const IpcChannels = {
  appGetVersion: 'app:getVersion'
} as const

/**
 * Die API, die im Renderer unter `window.api` zur Verfügung steht.
 * Wird vom Preload-Skript implementiert und hier nur typisiert.
 */
export interface KiTeacherApi {
  /** Liefert die App-Version (Smoke-Test für die IPC-Bridge). */
  getAppVersion: () => Promise<string>
}
