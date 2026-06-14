/**
 * Registriert die IPC-Handler für die Projekt-Verwaltung.
 *
 * Hält die Schichten getrennt: die Handler übersetzen nur zwischen IPC und dem
 * Repository bzw. der Import-Logik – keine Geschäftslogik im Main-Einstieg.
 * Vertrag siehe `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { rmSync } from 'fs'
import { IpcChannels } from '@shared/ipc'
import { projectRepository } from '../db/repositories'
import { importPdfProject } from './projectImport'

export function registerProjectHandlers(): void {
  ipcMain.handle(IpcChannels.projectsList, () => projectRepository.list())

  ipcMain.handle(IpcChannels.projectsImport, () => importPdfProject())

  ipcMain.handle(IpcChannels.projectsGet, (_event, id: number) =>
    projectRepository.getById(id)
  )

  ipcMain.handle(IpcChannels.projectsRename, (_event, id: number, name: string) => {
    projectRepository.rename(id, name.trim())
    return projectRepository.getById(id)
  })

  ipcMain.handle(IpcChannels.projectsDelete, (_event, id: number) => {
    // Erst die PDF-Kopie löschen, dann den DB-Eintrag (Seiten/Chats per CASCADE).
    const project = projectRepository.getById(id)
    if (project) {
      rmSync(project.pdfPath, { force: true })
      projectRepository.delete(id)
    }
  })
}
