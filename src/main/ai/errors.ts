/**
 * Übersetzt Provider-/SDK-Fehler in verständliche, deutsche Meldungen.
 *
 * An einer Stelle, weil sowohl der Verbindungstest (Etappe 5) als auch die
 * Seiten-Erklärung (Etappe 6) dieselben Anthropic-Fehlerklassen behandeln.
 */
import { Anthropic } from './anthropicProvider'

/**
 * Kanonische Meldung für den behebbaren Sonderfall „kein API-Key hinterlegt"
 * (Etappe 8). An einer Stelle, weil Seiten-Erklärung und Chat sie gleich
 * verwenden. Die UI erkennt den Fall an `kind: 'no-key'` und rendert dafür eine
 * eigene Variante mit „Einstellungen" als Link – sie parst diesen Text NICHT,
 * sodass eine Umformulierung hier den Link nicht beeinflusst.
 */
export const NO_API_KEY_MESSAGE =
  'Es ist kein API-Key hinterlegt. Bitte in den Einstellungen eintragen.'

/**
 * Erkennt den Fall „Guthaben aufgebraucht". Anthropic liefert dafür keinen
 * eigenen HTTP-Status (kein 429-Rate-Limit), sondern einen 400er mit einer
 * englischen Meldung, die das Stichwort „credit balance" enthält. Wir suchen
 * daher im Fehlertext statt am Status, damit die Erkennung robust bleibt.
 */
function isOutOfCredit(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false
  const body =
    error.error && typeof error.error === 'object' ? JSON.stringify(error.error) : ''
  return `${error.message} ${body}`.toLowerCase().includes('credit balance')
}

export function describeAiError(error: unknown): string {
  if (isOutOfCredit(error)) {
    return 'Das Guthaben deines API-Keys ist aufgebraucht. Bitte lade in der Anthropic Console neues Guthaben auf (Plans & Billing).'
  }
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
