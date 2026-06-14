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
import { anthropicProvider } from '../ai/anthropicProvider'
import { describeAiError } from '../ai/errors'

/** Aktuellen Stand für den Renderer zusammenstellen (ohne den Key selbst). */
function currentState(): SettingsState {
  return { ...settingsStore.getSettings(), hasApiKey: settingsStore.hasApiKey() }
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
        return { ok: false, message: describeAiError(error) }
      }
    }
  )
}
