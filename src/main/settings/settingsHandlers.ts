/**
 * Registriert die IPC-Handler für Einstellungen und API-Key (Etappe 5).
 *
 * Hält die Schichten getrennt: die Handler übersetzen nur zwischen IPC und dem
 * Settings-Store bzw. dem KI-Provider. Vertrag siehe `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AppSettings, ConnectionTestResult, SettingsState } from '@shared/settings'
import { settingsStore } from './settingsStore'
import { Anthropic, anthropicProvider } from '../ai/anthropicProvider'

/** Aktuellen Stand für den Renderer zusammenstellen (ohne den Key selbst). */
function currentState(): SettingsState {
  return { ...settingsStore.getSettings(), hasApiKey: settingsStore.hasApiKey() }
}

/** Provider-/SDK-Fehler in eine verständliche deutsche Meldung übersetzen. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Der API-Key ist ungültig. Bitte prüfe deine Eingabe.'
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
  return 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.'
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.settingsGet, () => currentState())

  ipcMain.handle(IpcChannels.settingsSave, (_event, partial: Partial<AppSettings>) => {
    settingsStore.saveSettings(partial)
    return currentState()
  })

  ipcMain.handle(IpcChannels.settingsSetApiKey, (_event, apiKey: string) => {
    settingsStore.setApiKey(apiKey)
  })

  ipcMain.handle(IpcChannels.settingsClearApiKey, () => {
    settingsStore.clearApiKey()
  })

  ipcMain.handle(
    IpcChannels.settingsTestConnection,
    async (_event, model: string, apiKey?: string): Promise<ConnectionTestResult> => {
      const key = apiKey?.trim() || settingsStore.getApiKey()
      if (!key) {
        return { ok: false, message: 'Es ist kein API-Key hinterlegt.' }
      }
      try {
        await anthropicProvider.testConnection({ apiKey: key, model })
        return { ok: true }
      } catch (error) {
        return { ok: false, message: describeError(error) }
      }
    }
  )
}
