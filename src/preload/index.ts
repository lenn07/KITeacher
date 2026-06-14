import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels, type KiTeacherApi } from '@shared/ipc'

// Implementierung der App-API, die dem Renderer kontrolliert freigegeben wird.
const api: KiTeacherApi = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannels.appGetVersion)
}

// Nur über contextBridge freigeben, niemals direkten Node-/ipcRenderer-Zugriff
// im Renderer erlauben (contextIsolation ist aktiv).
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore – Fallback nur falls contextIsolation deaktiviert wäre.
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
