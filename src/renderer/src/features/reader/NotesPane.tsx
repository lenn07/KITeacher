/**
 * Notizen-Panel der rechten Spalte (Logseq-artiger Outliner).
 *
 * Statt der KI-Erklärung kann rechts ein Notizblock zur aktuellen Folie
 * eingeblendet werden (Umschalter im Kopf der Projektansicht). Die Notiz ist
 * eine Liste von Blöcken, jeder Block roher Markdown (Überschriften `#`, Listen,
 * Mathe `$…$`/`$$…$$`, …). Ein Block wird beim Anklicken zum Bearbeiten ein
 * Textfeld, sonst wird er als Markdown gerendert (geteilte Darstellung mit den
 * KI-Texten über `chat-markdown` + `MarkdownView`).
 *
 * Tastatur (an Logseq angelehnt):
 *  - Enter: neuen Block anlegen (am Cursor aufgeteilt), Shift+Enter: Zeilenumbruch
 *  - Tab / Shift+Tab: Block ein-/ausrücken (Verschachtelung)
 *  - Backspace am Blockanfang: mit dem vorherigen Block verschmelzen
 *  - Pfeil hoch/runter am Blockrand: in den Nachbarblock springen
 *  - Escape: Bearbeitung verlassen
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { MarkdownView } from './MarkdownView'
import { createEditorBlock, type EditorBlock, type UseNotesResult } from './useNotes'

/** Textfeld an seinen Inhalt anpassen (keine innere Scrollleiste). */
function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Schrittweite einer Einrückungsebene (muss zu `.note-guide` im CSS passen). */
const INDENT_STEP_REM = 1.5

/**
 * Ob der Block-Inhalt eine Markdown-Trennlinie ist (`---`, `***`, `___`). Solche
 * Blöcke werden als `<hr>` gerendert und bekommen wie in Logseq keinen
 * Aufzählungspunkt.
 */
function isHorizontalRule(content: string): boolean {
  const t = content.trim().replace(/\s+/g, '')
  return /^(-{3,}|\*{3,}|_{3,})$/.test(t)
}

export function NotesPane({ notes }: { notes: UseNotesResult }): React.JSX.Element {
  const { blocks, setBlocks } = notes
  // Welcher Block wird gerade bearbeitet (Textfeld) statt gerendert?
  const [activeId, setActiveId] = useState<string | null>(null)
  // Eingeklappte Blöcke (deren Unterblöcke verborgen sind). Reiner Ansichts-State
  // per Client-`id` – wird nicht persistiert (die `id`s sind ohnehin nur lokal).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  // Überfahrene Einrückungs-Linie, identifiziert über ihren Elternblock – damit
  // der ganze Strich (alle Abschnitte) gehighlightet wird, nicht nur eine Zeile.
  const [hoveredLine, setHoveredLine] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // Gewünschte Cursor-Position nach dem Fokuswechsel: Zahl, oder -1 = ans Ende.
  const caretRef = useRef<number | null>(null)

  // Fokus und Cursor setzen, sobald ein Block aktiv wird.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!activeId || !el) return
    el.focus()
    autoGrow(el)
    const want = caretRef.current
    if (want != null) {
      const pos = want < 0 ? el.value.length : Math.min(want, el.value.length)
      el.setSelectionRange(pos, pos)
    }
    caretRef.current = null
  }, [activeId])

  function updateContent(id: string, content: string): void {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  /** Enter: Block am Cursor aufteilen, der Rest wandert in einen neuen Block darunter. */
  function splitBlock(id: string, caret: number): void {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const block = blocks[idx]
    const tail = createEditorBlock(block.content.slice(caret), block.indent)
    const next = [...blocks]
    next[idx] = { ...block, content: block.content.slice(0, caret) }
    next.splice(idx + 1, 0, tail)
    setBlocks(next)
    caretRef.current = 0
    setActiveId(tail.id)
  }

  /** Backspace am Anfang: mit dem vorherigen Block verschmelzen. */
  function mergeIntoPrevious(id: string): boolean {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx <= 0) return false
    const prev = blocks[idx - 1]
    const caret = prev.content.length
    const next = [...blocks]
    next[idx - 1] = { ...prev, content: prev.content + blocks[idx].content }
    next.splice(idx, 1)
    setBlocks(next)
    caretRef.current = caret
    setActiveId(prev.id)
    return true
  }

  /** Block ein-/ausrücken; einrücken höchstens eine Ebene tiefer als der Vorgänger. */
  function changeIndent(id: string, delta: number): void {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    let indent = blocks[idx].indent + delta
    if (indent < 0) indent = 0
    if (delta > 0) {
      const max = idx > 0 ? blocks[idx - 1].indent + 1 : 0
      if (indent > max) indent = max
    }
    if (indent === blocks[idx].indent) return
    setBlocks(blocks.map((b, i) => (i === idx ? { ...b, indent } : b)))
  }

  /** In den Nachbarblock springen (dir -1 hoch, +1 runter); caret -1 = ans Ende. */
  function focusSibling(id: string, dir: -1 | 1, caret: number): boolean {
    const idx = blocks.findIndex((b) => b.id === id)
    const target = blocks[idx + dir]
    if (!target) return false
    caretRef.current = caret
    setActiveId(target.id)
    return true
  }

  /** Klick auf den Punkt: diesen Block (seinen Unterbaum) ein-/ausklappen. */
  function toggleBlock(id: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setActiveId(null)
  }

  /** Index des Elternblocks (nächster Block oberhalb mit genau Einrückung `level`). */
  function parentIndexAt(index: number, level: number): number {
    for (let p = index; p >= 0; p--) if (blocks[p].indent === level) return p
    return -1
  }

  /**
   * Klick auf eine Einrückungs-Linie der Ebene `level` (auf der Zeile `index`):
   * alle direkten Unterblöcke des zugehörigen Elternblocks gleichzeitig ein-/
   * ausklappen. Sind schon alle eingeklappt, wird ausgeklappt – sonst eingeklappt.
   */
  function toggleGuide(index: number, level: number): void {
    const parent = parentIndexAt(index, level)
    if (parent < 0) return

    // Direkte Kinder (Einrückung level+1) innerhalb des Elternteilbaums, die
    // selbst Unterblöcke haben (nur die lassen sich klappen).
    const childIds: string[] = []
    for (let j = parent + 1; j < blocks.length && blocks[j].indent > level; j++) {
      if (blocks[j].indent !== level + 1) continue
      const hasChildren = j + 1 < blocks.length && blocks[j + 1].indent > blocks[j].indent
      if (hasChildren) childIds.push(blocks[j].id)
    }
    if (childIds.length === 0) return

    setCollapsed((prev) => {
      const next = new Set(prev)
      const allCollapsed = childIds.every((id) => next.has(id))
      for (const id of childIds) {
        if (allCollapsed) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setActiveId(null)
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    block: EditorBlock
  ): void {
    const el = event.currentTarget
    const { selectionStart, selectionEnd, value } = el
    const atStart = selectionStart === 0 && selectionEnd === 0
    const atEnd = selectionStart === value.length && selectionEnd === value.length

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      // Logseq-Verhalten: Enter auf einem leeren, eingerückten Block rückt ihn
      // aus, statt einen neuen Block anzulegen. Am Ende eines inneren Blocks legt
      // der erste Enter einen leeren Block darunter an, der zweite hebt ihn so auf
      // die obere Ebene.
      if (block.content.length === 0 && block.indent > 0) {
        changeIndent(block.id, -1)
      } else {
        splitBlock(block.id, selectionStart)
      }
    } else if (event.key === 'Tab') {
      event.preventDefault()
      changeIndent(block.id, event.shiftKey ? -1 : 1)
    } else if (event.key === 'Backspace' && atStart) {
      if (mergeIntoPrevious(block.id)) event.preventDefault()
    } else if (event.key === 'ArrowUp' && atStart) {
      if (focusSibling(block.id, -1, -1)) event.preventDefault()
    } else if (event.key === 'ArrowDown' && atEnd) {
      if (focusSibling(block.id, 1, 0)) event.preventDefault()
    } else if (event.key === 'Escape') {
      el.blur()
      setActiveId(null)
    }
  }

  // Sichtbare Zeilen aus dem Klapp-Zustand ableiten: Unter einem eingeklappten
  // Block werden alle tiefer eingerückten Folgeblöcke übersprungen. `hasChildren`
  // ergibt sich aus der flachen Liste (nächster Block tiefer eingerückt).
  const visibleRows: {
    block: EditorBlock
    index: number
    hasChildren: boolean
    isCollapsed: boolean
  }[] = []
  let hiddenBelowIndent = Infinity
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.indent > hiddenBelowIndent) continue
    hiddenBelowIndent = Infinity
    const hasChildren = i + 1 < blocks.length && blocks[i + 1].indent > block.indent
    const isCollapsed = hasChildren && collapsed.has(block.id)
    visibleRows.push({ block, index: i, hasChildren, isCollapsed })
    if (isCollapsed) hiddenBelowIndent = block.indent
  }

  return (
    <div className="notes">
      <div className="notes-header">
        <span className="chat-title">Notizen</span>
        <span className="notes-hint">Enter = neuer Block · Tab = einrücken</span>
      </div>

      <div className="notes-scroll">
        {visibleRows.map(({ block, index, hasChildren, isCollapsed }) => {
          const active = block.id === activeId
          const hasContent = block.content.trim().length > 0
          const isHr = isHorizontalRule(block.content)
          return (
            <div
              key={block.id}
              className="note-block"
              style={{ paddingLeft: `${block.indent * INDENT_STEP_REM}rem` }}
            >
              {/* Eine vertikale Führungslinie je Vorfahr-Ebene; über die Zeilen
                  hinweg ergeben sie durchgehende Einrückungs-Linien (wie Logseq).
                  Klick auf eine Linie klappt alle Unterblöcke des Elternteils. */}
              {Array.from({ length: block.indent }, (_, lvl) => {
                // Eltern-`id` = Linien-Kennung; alle Abschnitte derselben Linie
                // teilen sie und werden so gemeinsam gehighlightet.
                const parent = parentIndexAt(index, lvl)
                const lineId = parent >= 0 ? blocks[parent].id : null
                return (
                  <span
                    key={lvl}
                    className={`note-guide${lineId && lineId === hoveredLine ? ' note-guide-hover' : ''}`}
                    style={{ left: `calc(${lvl * INDENT_STEP_REM}rem + 3px)` }}
                    onMouseEnter={() => setHoveredLine(lineId)}
                    onMouseLeave={() => setHoveredLine(null)}
                    onClick={() => toggleGuide(index, lvl)}
                    aria-hidden="true"
                  />
                )
              })}
              <span
                className={
                  'note-bullet' +
                  // Leere Blöcke und Trennlinien (`---`) zeigen keinen Punkt.
                  (isHr || !hasContent ? ' note-bullet-hidden' : '') +
                  (hasChildren ? ' note-bullet-parent' : '') +
                  (isCollapsed ? ' note-bullet-collapsed' : '')
                }
                onClick={hasChildren ? () => toggleBlock(block.id) : undefined}
                aria-hidden="true"
              />
              {active ? (
                <textarea
                  ref={textareaRef}
                  className="note-input"
                  value={block.content}
                  rows={1}
                  onChange={(event) => {
                    updateContent(block.id, event.target.value)
                    autoGrow(event.currentTarget)
                  }}
                  onKeyDown={(event) => handleKeyDown(event, block)}
                  // Beim Verlassen rendern – außer der Fokus ist schon zu einem
                  // anderen Block gewandert (dann hat der die Hoheit).
                  onBlur={() => setActiveId((cur) => (cur === block.id ? null : cur))}
                />
              ) : (
                <div
                  className={`note-rendered chat-markdown${hasContent ? '' : ' note-empty'}`}
                  onClick={() => {
                    caretRef.current = -1
                    setActiveId(block.id)
                  }}
                >
                  {hasContent ? <MarkdownView>{block.content}</MarkdownView> : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
