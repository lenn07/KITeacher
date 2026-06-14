import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc'
import { initDatabase, closeDatabase } from './db/database'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'KITeacher',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // Renderer bleibt vom Node-Zugriff getrennt – Kommunikation nur über die
      // typisierte Preload-Bridge (siehe src/preload/index.ts).
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Im Dev-Modus die Vite-Dev-URL laden, sonst das gebaute HTML.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.kiteacher.app')

  // Lokale Persistenz vorbereiten: Ordner anlegen, DB öffnen, Migrationen einspielen.
  initDatabase()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC-Handler: an einer Stelle registriert, Vertrag siehe src/shared/ipc.ts.
  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// DB-Verbindung sauber schließen, bevor die App beendet wird.
app.on('will-quit', () => {
  closeDatabase()
})
