/**
 * Registriert die IPC-Handler für die seitenbezogenen Notizen (Logseq-artig).
 *
 * Rein lokal, kein KI-Aufruf: Notizen sind eine geordnete Liste von Blöcken pro
 * Seite. Der Renderer hält den Bearbeitungsstand und schickt beim Speichern die
 * komplette Liste, die hier für die Seite ersetzt wird.
 *
 * Hält die Schichten getrennt: Der Handler übersetzt nur zwischen IPC und
 * Repository (die Seite wird – wie beim Chat – bei Bedarf angelegt). Vertrag
 * siehe `shared/ipc.ts`.
 */
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { NoteBlock, NoteBlockInput } from '@shared/domain'
import { noteBlockRepository, pageRepository } from '../db/repositories'

export function registerNotesHandlers(): void {
  // Reiner Lese-Blick: Notizen einer Seite oder leer, ohne die Seite anzulegen.
  ipcMain.handle(
    IpcChannels.notesList,
    (_event, projectId: number, pageNumber: number): NoteBlock[] => {
      const page = pageRepository.getByNumber(projectId, pageNumber)
      return page ? noteBlockRepository.listByPage(page.id) : []
    }
  )

  ipcMain.handle(
    IpcChannels.notesSave,
    (
      _event,
      projectId: number,
      pageNumber: number,
      blocks: NoteBlockInput[]
    ): NoteBlock[] => {
      // Seite (und damit ihre id) sicherstellen, falls erstmals Notizen entstehen.
      const page = pageRepository.getOrCreate(projectId, pageNumber)
      return noteBlockRepository.replaceForPage(page.id, blocks)
    }
  )
}
