/**
 * Rechte Spalte des Split-Screens: die KI-Erklärung zur aktuellen Seite (Etappe 6).
 *
 * Zeigt Lade-, Fehler- und Fertig-Zustand. Der Erklärtext kommt als Markdown von
 * Claude und wird vollständig gerendert: GitHub-Markdown (Überschriften, Listen,
 * Tabellen, Code, `---`, …) via `remark-gfm` und Mathe-Formeln (`$…$`, `$$…$$`,
 * `\frac{}{}` usw.) via `remark-math` + KaTeX. KaTeX bringt seine Schriften
 * gebündelt mit – funktioniert offline, passt zum lokalen Charakter der App.
 */
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { ExplanationState } from './useExplanation'

interface ExplanationPaneProps {
  state: ExplanationState
  onRegenerate: () => void
}

export function ExplanationPane({ state, onRegenerate }: ExplanationPaneProps): React.JSX.Element {
  if (state.status === 'loading') {
    return (
      <div className="explain-status">
        <span className="spinner" aria-hidden="true" />
        <p className="muted">KI erklärt die Seite…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="explain-status">
        <p className="error">{state.message}</p>
        <button className="btn ghost" onClick={onRegenerate}>
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <div className="explain-content">
      <div className="explain-text">
        <Markdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {state.text}
        </Markdown>
      </div>
      <div className="explain-actions">
        <button className="btn ghost" onClick={onRegenerate}>
          ↻ Neu erklären
        </button>
      </div>
    </div>
  )
}
