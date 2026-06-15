import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels, type KiTeacherApi } from '@shared/ipc'

// Implementierung der App-API, die dem Renderer kontrolliert freigegeben wird.
const api: KiTeacherApi = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannels.appGetVersion),
  folders: {
    list: (parentId) => ipcRenderer.invoke(IpcChannels.foldersList, parentId),
    listAll: () => ipcRenderer.invoke(IpcChannels.foldersListAll),
    create: (name, parentId) => ipcRenderer.invoke(IpcChannels.foldersCreate, name, parentId),
    rename: (id, name) => ipcRenderer.invoke(IpcChannels.foldersRename, id, name),
    move: (id, parentId) => ipcRenderer.invoke(IpcChannels.foldersMove, id, parentId),
    delete: (id) => ipcRenderer.invoke(IpcChannels.foldersDelete, id)
  },
  projects: {
    list: (folderId) => ipcRenderer.invoke(IpcChannels.projectsList, folderId),
    import: (folderId) => ipcRenderer.invoke(IpcChannels.projectsImport, folderId),
    rename: (id, name) => ipcRenderer.invoke(IpcChannels.projectsRename, id, name),
    move: (id, folderId) => ipcRenderer.invoke(IpcChannels.projectsMove, id, folderId),
    delete: (id) => ipcRenderer.invoke(IpcChannels.projectsDelete, id),
    getById: (id) => ipcRenderer.invoke(IpcChannels.projectsGet, id),
    readPdf: (id) => ipcRenderer.invoke(IpcChannels.projectsReadPdf, id),
    setPageCount: (id, pageCount) =>
      ipcRenderer.invoke(IpcChannels.projectsSetPageCount, id, pageCount),
    setLastPage: (id, lastPage) =>
      ipcRenderer.invoke(IpcChannels.projectsSetLastPage, id, lastPage)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    save: (settings) => ipcRenderer.invoke(IpcChannels.settingsSave, settings),
    setApiKey: (apiKey) => ipcRenderer.invoke(IpcChannels.settingsSetApiKey, apiKey),
    clearApiKey: () => ipcRenderer.invoke(IpcChannels.settingsClearApiKey),
    testConnection: (model, apiKey) =>
      ipcRenderer.invoke(IpcChannels.settingsTestConnection, model, apiKey)
  },
  pages: {
    get: (projectId, pageNumber) =>
      ipcRenderer.invoke(IpcChannels.pagesGet, projectId, pageNumber),
    generateExplanation: (input) =>
      ipcRenderer.invoke(IpcChannels.pagesGenerateExplanation, input)
  },
  chat: {
    list: (projectId, pageNumber) =>
      ipcRenderer.invoke(IpcChannels.chatList, projectId, pageNumber),
    send: (input) => ipcRenderer.invoke(IpcChannels.chatSend, input),
    clear: (projectId, pageNumber) =>
      ipcRenderer.invoke(IpcChannels.chatClear, projectId, pageNumber)
  }
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
