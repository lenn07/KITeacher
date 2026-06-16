/**
 * Lädt und verwaltet die seitenbezogenen Notizen (Logseq-artiger Outliner).
 *
 * Notizen sind eine geordnete Liste von Blöcken pro Seite. Anders als beim Chat
 * ist der Renderer hier die Quelle der Wahrheit: Die Blöcke werden lokal
 * bearbeitet und – verzögert (debounced) – als komplette Liste persistiert
 * (`notes.save` ersetzt den Stand der Seite). Beim Seitenwechsel werden noch
 * ausstehende Änderungen der verlassenen Seite vorher sofort geschrieben, damit
 * nichts verloren geht.
 *
 * Die Block-`id`s sind rein clientseitig (stabil über das Bearbeiten hinweg),
 * deshalb wird nach dem Speichern nicht neu eingelesen – das würde nur die
 * Fokus-/Cursor-Verfolgung im Editor stören.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteBlockInput } from '@shared/domain'

/** Ein Notiz-Block im Editor (clientseitige, stabile `id`). */
export interface EditorBlock {
  id: string
  content: string
  indent: number
}

let blockCounter = 0

/** Erzeugt einen neuen Block mit eindeutiger, clientseitiger `id`. */
export function createEditorBlock(content = '', indent = 0): EditorBlock {
  blockCounter += 1
  return { id: `b${blockCounter}`, content, indent }
}

/** Eine frische, leere Notiz besteht aus einem einzelnen leeren Block. */
function emptyDoc(): EditorBlock[] {
  return [createEditorBlock()]
}

/** Verzögerung, bevor Tippänderungen persistiert werden (sammelt Tastendrücke). */
const SAVE_DELAY = 600

interface UseNotesArgs {
  projectId: number
  pageNumber: number
}

export interface UseNotesResult {
  blocks: EditorBlock[]
  /** Ersetzt die Blockliste und speichert sie verzögert persistent. */
  setBlocks: (next: EditorBlock[]) => void
  /** `false`, solange die Notizen der aktuellen Seite noch geladen werden. */
  loaded: boolean
}

export function useNotes({ projectId, pageNumber }: UseNotesArgs): UseNotesResult {
  const [blocks, setBlocksState] = useState<EditorBlock[]>(emptyDoc)
  const [loaded, setLoaded] = useState(false)

  // Speicher-Ziel und letzter Stand als Ref: So schreibt das Flushen beim
  // Seitenwechsel garantiert den (alten) Stand der verlassenen Seite.
  const targetRef = useRef({ projectId, pageNumber })
  const latestRef = useRef<EditorBlock[]>(blocks)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Verhindert, dass eine spät eintreffende Liste einer alten Seite die
  // inzwischen geöffnete überschreibt.
  const requestRef = useRef(0)

  const persist = useCallback(
    (target: { projectId: number; pageNumber: number }, items: EditorBlock[]) => {
      const payload: NoteBlockInput[] = items.map((b, i) => ({
        position: i,
        indent: b.indent,
        content: b.content
      }))
      window.api.notes.save(target.projectId, target.pageNumber, payload).catch(() => {
        /* Nicht kritisch: Notizen bleiben lokal im UI erhalten. */
      })
    },
    []
  )

  // Ausstehende (debounced) Änderung sofort schreiben – beim Seitenwechsel/Unmount.
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      persist(targetRef.current, latestRef.current)
    }
  }, [persist])

  // Notizen der aktuellen Seite laden; vorher den alten Stand sichern.
  useEffect(() => {
    targetRef.current = { projectId, pageNumber }
    const token = ++requestRef.current
    setLoaded(false)

    window.api.notes
      .list(projectId, pageNumber)
      .then((rows) => {
        if (requestRef.current !== token) return
        const doc =
          rows.length > 0
            ? rows.map((r) => createEditorBlock(r.content, r.indent))
            : emptyDoc()
        setBlocksState(doc)
        latestRef.current = doc
        setLoaded(true)
      })
      .catch(() => {
        if (requestRef.current !== token) return
        const doc = emptyDoc()
        setBlocksState(doc)
        latestRef.current = doc
        setLoaded(true)
      })

    // Cleanup läuft vor dem nächsten Effekt (und beim Unmount): noch
    // ausstehende Änderungen der verlassenen Seite sofort persistieren.
    return () => flush()
  }, [projectId, pageNumber, flush])

  const setBlocks = useCallback(
    (next: EditorBlock[]) => {
      setBlocksState(next)
      latestRef.current = next
      if (timerRef.current) clearTimeout(timerRef.current)
      const target = targetRef.current
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        persist(target, next)
      }, SAVE_DELAY)
    },
    [persist]
  )

  return { blocks, setBlocks, loaded }
}
