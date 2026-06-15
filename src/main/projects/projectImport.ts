/**
 * PDF-Import: Datei-Dialog → Kopie in den App-Datenordner → Projekt anlegen.
 *
 * Die Original-PDF des Nutzers bleibt unangetastet; die App arbeitet immer mit
 * einer eigenen Kopie unter `pdfs/`. Der Dateiname dort ist eine zufällige UUID,
 * um Kollisionen und Probleme mit Sonderzeichen zu vermeiden. Der Anzeigename
 * des Projekts ist standardmäßig der ursprüngliche Dateiname (ohne Endung).
 *
 * Die Seitenzahl ist hier noch unbekannt (0) – sie wird erst in Etappe 4
 * (PDF-Viewer mit pdf.js) ermittelt und nachgetragen.
 */
import { dialog } from 'electron'
import { basename, extname, join } from 'path'
import { copyFileSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project } from '@shared/domain'
import { pdfStorageDir } from '../storage/paths'
import { projectRepository } from '../db/repositories'

export async function importPdfProject(
  folderId: number | null
): Promise<Project | null> {
  const result = await dialog.showOpenDialog({
    title: 'PDF auswählen',
    buttonLabel: 'Importieren',
    properties: ['openFile'],
    filters: [{ name: 'PDF-Dokumente', extensions: ['pdf'] }]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const sourcePath = result.filePaths[0]
  const targetPath = join(pdfStorageDir(), `${randomUUID()}.pdf`)
  copyFileSync(sourcePath, targetPath)

  const name = basename(sourcePath, extname(sourcePath))
  return projectRepository.create({ name, folderId, pdfPath: targetPath, pageCount: 0 })
}
