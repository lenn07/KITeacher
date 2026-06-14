/**
 * Gemeinsamer Markdown-Renderer für KI-Texte (Erklärung wie Chat-Antworten).
 *
 * Rendert GitHub-Markdown (`remark-gfm`: Überschriften, Listen, Tabellen, Code,
 * `---`, …) und Mathe-Formeln (`$…$`, `$$…$$`) via `remark-math` + KaTeX. KaTeX
 * bringt seine Schriften gebündelt mit – funktioniert offline, passt zum lokalen
 * Charakter der App. An einer Stelle gebündelt, damit Erklärung und Chat dieselbe
 * Darstellung teilen.
 */
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export function MarkdownView({ children }: { children: string }): React.JSX.Element {
  return (
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </Markdown>
  )
}
