/**
 * Registriert die IPC-Handler für die Ordner-Verwaltung.
 *
 * Hält die Schichten getrennt: die Handler übersetzen nur zwischen IPC und dem
 * Repository – keine Geschäftslogik im Main-Einstieg. Vertrag siehe
 * `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { rmSync } from 'fs'
import { IpcChannels } from '@shared/ipc'
import { folderRepository } from '../db/repositories'

export function registerFolderHandlers(): void {
  ipcMain.handle(IpcChannels.foldersList, (_event, parentId: number | null) =>
    folderRepository.listByParent(parentId)
  )

  ipcMain.handle(IpcChannels.foldersListAll, () => folderRepository.listAll())

  ipcMain.handle(
    IpcChannels.foldersCreate,
    (_event, name: string, parentId: number | null) =>
      folderRepository.create({ name: name.trim(), parentId })
  )

  ipcMain.handle(IpcChannels.foldersRename, (_event, id: number, name: string) => {
    folderRepository.rename(id, name.trim())
    return folderRepository.getById(id)
  })

  ipcMain.handle(
    IpcChannels.foldersMove,
    (_event, id: number, parentId: number | null) => {
      // Zyklus-Schutz: ein Ordner darf nicht in sich selbst oder einen seiner
      // Nachfahren wandern – sonst würde der Teilbaum von der Hierarchie abgehängt.
      if (parentId !== null && folderRepository.isDescendantOrSelf(id, parentId)) {
        throw new Error('Ein Ordner kann nicht in sich selbst verschoben werden.')
      }
      folderRepository.move(id, parentId)
      return folderRepository.getById(id)
    }
  )

  ipcMain.handle(IpcChannels.foldersDelete, (_event, id: number) => {
    // Erst die PDF-Dateien aller Projekte im Teilbaum löschen, dann den Ordner –
    // dessen Unterordner, Projekte, Seiten und Chats verschwinden per CASCADE.
    for (const pdfPath of folderRepository.collectDescendantPdfPaths(id)) {
      rmSync(pdfPath, { force: true })
    }
    folderRepository.delete(id)
  })
}
