/**
 * Registriert die IPC-Handler für Seiten-Erklärungen (Etappe 6).
 *
 * Kern der On-Demand-/Caching-Logik: Der teure Vision-Aufruf passiert nur, wenn
 * für die Seite noch kein Text gespeichert ist (oder `force` gesetzt ist). Sonst
 * wird der gecachte Text geliefert – das spart Tokens beim Wiederöffnen.
 *
 * Doppelte Kosten ausgeschlossen: Läuft für eine Seite bereits eine Erzeugung,
 * hängt sich jeder weitere Aufruf (schnelles Doppelklicken, „Neu erklären") an
 * dasselbe Ergebnis an, statt eine zweite API-Anfrage zu starten.
 *
 * Hält die Schichten getrennt: Der Handler übersetzt nur zwischen IPC,
 * Repository, Settings-Store und KI-Provider. Vertrag siehe `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ExplanationResult, GenerateExplanationInput } from '@shared/domain'
import { pageRepository } from '../db/repositories'
import { settingsStore } from '../settings/settingsStore'
import { anthropicProvider } from '../ai/anthropicProvider'
import { describeAiError } from '../ai/errors'

/**
 * Gerade laufende Erzeugungen, je Seite (`projectId:pageNumber`). Verhindert,
 * dass zwei gleichzeitige Aufrufe für dieselbe Seite zwei API-Anfragen auslösen
 * – der zweite bekommt die Promise des ersten und damit dessen Ergebnis.
 */
const inFlight = new Map<string, Promise<ExplanationResult>>()

/** Erzeugt den Erklärtext einer Seite und cacht ihn (ein einzelner API-Aufruf). */
async function generateAndCache(input: GenerateExplanationInput): Promise<ExplanationResult> {
  const { projectId, pageNumber, image } = input

  const apiKey = settingsStore.getApiKey()
  if (!apiKey) {
    return {
      ok: false,
      message: 'Es ist kein API-Key hinterlegt. Bitte in den Einstellungen eintragen.'
    }
  }

  const { model, explanationLevel } = settingsStore.getSettings()
  try {
    const explanation = await anthropicProvider.explainPage(
      { apiKey, model },
      { image, level: explanationLevel }
    )
    const page = pageRepository.saveExplanation(projectId, pageNumber, explanation)
    return { ok: true, page }
  } catch (error) {
    return { ok: false, message: describeAiError(error) }
  }
}

export function registerPageHandlers(): void {
  // Reiner Cache-Blick: liefert die Seite (mit/ohne Erklärtext) oder null. Kein KI-Aufruf.
  ipcMain.handle(IpcChannels.pagesGet, (_event, projectId: number, pageNumber: number) =>
    pageRepository.getByNumber(projectId, pageNumber)
  )

  ipcMain.handle(
    IpcChannels.pagesGenerateExplanation,
    (_event, input: GenerateExplanationInput): Promise<ExplanationResult> => {
      const { projectId, pageNumber, force } = input

      // Cache-Treffer: gespeicherten Text liefern, ohne Tokens zu verbrauchen.
      if (!force) {
        const cached = pageRepository.getByNumber(projectId, pageNumber)
        if (cached?.explanation) return Promise.resolve({ ok: true, page: cached })
      }

      // Läuft schon eine Erzeugung für diese Seite? Dann daran anhängen statt
      // ein zweites Mal an die API zu gehen (auch bei `force` – das Ergebnis ist
      // ohnehin frisch generiert). So entstehen nie doppelte Kosten.
      const key = `${projectId}:${pageNumber}`
      const running = inFlight.get(key)
      if (running) return running

      const promise = generateAndCache(input).finally(() => inFlight.delete(key))
      inFlight.set(key, promise)
      return promise
    }
  )
}
