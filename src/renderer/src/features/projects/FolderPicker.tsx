/**
 * Modaler Zielordner-Wähler für das Verschieben von Projekten und Ordnern.
 *
 * Lädt alle Ordner flach (`folders.listAll`) und baut daraus einen eingerückten
 * Baum. Die Wurzelebene ist als eigenes Ziel wählbar. Beim Verschieben eines
 * Ordners werden der Ordner selbst und alle seine Nachfahren ausgeschlossen –
 * sonst entstünde ein Zyklus. Die aktuelle Position ist deaktiviert (kein No-Op).
 */
import { useEffect, useMemo, useState } from 'react'
import type { Folder } from '@shared/domain'

interface FolderPickerProps {
  /** Überschrift des Dialogs, z. B. „„Mathe" verschieben". */
  title: string
  /** Aktueller Ordner des Elements (`null` = Wurzel) – wird deaktiviert. */
  currentParentId: number | null
  /**
   * Beim Verschieben eines Ordners dessen id; der Ordner und sein Teilbaum
   * werden als Ziel ausgeschlossen. Bei Projekten `undefined`.
   */
  excludeSubtreeOf?: number
  onPick: (folderId: number | null) => void
  onCancel: () => void
}

interface TreeNode extends Folder {
  depth: number
}

/** Flache Ordnerliste in eine eingerückte Vorordnung (Tiefensuche) bringen. */
function flattenTree(folders: Folder[]): TreeNode[] {
  const byParent = new Map<number | null, Folder[]>()
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? []
    list.push(folder)
    byParent.set(folder.parentId, list)
  }
  const result: TreeNode[] = []
  const walk = (parentId: number | null, depth: number): void => {
    for (const folder of byParent.get(parentId) ?? []) {
      result.push({ ...folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}

/** Liefert die id-Menge eines Ordners samt aller Nachfahren. */
function collectSubtree(folders: Folder[], rootId: number): Set<number> {
  const byParent = new Map<number | null, Folder[]>()
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? []
    list.push(folder)
    byParent.set(folder.parentId, list)
  }
  const ids = new Set<number>([rootId])
  const walk = (id: number): void => {
    for (const child of byParent.get(id) ?? []) {
      ids.add(child.id)
      walk(child.id)
    }
  }
  walk(rootId)
  return ids
}

export function FolderPicker({
  title,
  currentParentId,
  excludeSubtreeOf,
  onPick,
  onCancel
}: FolderPickerProps): React.JSX.Element {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.folders
      .listAll()
      .then(setFolders)
      .finally(() => setLoading(false))
  }, [])

  const excluded = useMemo(
    () =>
      excludeSubtreeOf !== undefined
        ? collectSubtree(folders, excludeSubtreeOf)
        : new Set<number>(),
    [folders, excludeSubtreeOf]
  )

  const tree = useMemo(() => flattenTree(folders), [folders])

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {loading ? (
          <p className="muted">Lade Ordner…</p>
        ) : (
          <ul className="picker-list">
            <li>
              <button
                className="picker-item"
                disabled={currentParentId === null}
                onClick={() => onPick(null)}
              >
                🏠 Wurzelebene
              </button>
            </li>
            {tree.map((node) => {
              const isExcluded = excluded.has(node.id)
              return (
                <li key={node.id}>
                  <button
                    className="picker-item"
                    style={{ paddingLeft: `${0.6 + node.depth * 1.2}rem` }}
                    disabled={isExcluded || currentParentId === node.id}
                    onClick={() => onPick(node.id)}
                  >
                    📁 {node.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
