/**
 * Übersetzt Provider-/SDK-Fehler in verständliche, deutsche Meldungen.
 *
 * An einer Stelle, weil sowohl der Verbindungstest (Etappe 5) als auch die
 * Seiten-Erklärung (Etappe 6) dieselben Anthropic-Fehlerklassen behandeln.
 */
import { Anthropic } from './anthropicProvider'

/**
 * Meldung für den behebbaren Sonderfall „kein API-Key hinterlegt" (Etappe 8).
 * An einer Stelle, weil Seiten-Erklärung und Chat sie gleich verwenden; die UI
 * verknüpft sie mit `kind: 'no-key'` und einem Weg zu den Einstellungen.
 */
export const NO_API_KEY_MESSAGE =
  'Es ist kein API-Key hinterlegt. Bitte in den Einstellungen eintragen.'

export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Der API-Key ist ungültig. Bitte prüfe deine Eingabe in den Einstellungen.'
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'Der API-Key hat keine Berechtigung für dieses Modell.'
  }
  if (error instanceof Anthropic.NotFoundError) {
    return 'Das gewählte Modell ist mit diesem Key nicht verfügbar.'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Zu viele Anfragen – bitte kurz warten und erneut versuchen.'
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Keine Verbindung zur Claude-API. Ist das Internet erreichbar?'
  }
  return 'Die Anfrage an die KI ist fehlgeschlagen. Bitte später erneut versuchen.'
}
