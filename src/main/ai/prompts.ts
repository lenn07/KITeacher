/**
 * Zentrale Prompt-Konfiguration für die KI-Erklärungen (Etappe 6).
 *
 * Bewusst an EINER Stelle ausgelagert (Architektur-Prinzip aus CLAUDE.md):
 * Prompts sind hier editierbar, ohne im Code verstreut zu sein. Der System-Prompt
 * legt Rolle, Sprache und didaktischen Stil fest; das Erklär-Niveau aus den
 * Einstellungen wählt eine passende Tiefe.
 */
import type { ExplanationLevel } from '@shared/settings'

/** Niveau-spezifische Zusatzanweisung an den didaktischen Stil. */
const LEVEL_GUIDANCE: Record<ExplanationLevel, string> = {
  einfach:
    'Erkläre für absolute Einsteiger: kurze Sätze, Alltagssprache, keine Fachbegriffe ' +
    'ohne sofortige Erklärung. Nutze anschauliche Vergleiche und gehe in kleinen Schritten vor.',
  standard:
    'Erkläre klar und verständlich auf solidem Grundniveau. Fachbegriffe darfst du ' +
    'verwenden, erkläre sie aber beim ersten Auftreten kurz.',
  detailliert:
    'Erkläre gründlich und mit Hintergründen: Zusammenhänge, das „Warum" hinter den ' +
    'Aussagen und – wo sinnvoll – Beispiele. Bleibe trotzdem verständlich und strukturiert.'
}

/** Baut den System-Prompt für die Seiten-Erklärung passend zum Niveau. */
export function buildExplanationSystemPrompt(level: ExplanationLevel): string {
  return [
    'Du bist ein geduldiger Lehrer, der den Inhalt einer einzelnen Lehrbuch-/Skript-Seite erklärt.',
    'Du bekommst die Seite als Bild. Erkläre, was auf der Seite steht, sodass es die lernende',
    'Person wirklich versteht – nicht nur eine Zusammenfassung, sondern eine echte Erklärung.',
    '',
    LEVEL_GUIDANCE[level],
    '',
    'Beziehe Diagramme, Formeln, Abbildungen und das Layout mit ein, wenn sie wichtig sind.',
    'Wenn die Seite kaum Inhalt hat (z. B. Deckblatt oder Inhaltsverzeichnis), sage das kurz.',
    'Antworte ausschließlich auf Deutsch. Strukturiere längere Erklärungen mit Absätzen,',
    'gerne mit Markdown (Zwischenüberschriften, Aufzählungen, Tabellen, **Hervorhebungen**).',
    'Mathematische Formeln IMMER als LaTeX setzen – im Fließtext mit einfachen',
    'Dollarzeichen ($E = mc^2$), abgesetzte Formeln mit doppelten ($$\\int_0^1 x\\,dx$$).',
    'Verwende dafür ausschließlich $-Begrenzer, nicht \\( \\) oder \\[ \\].',
    'Beginne direkt mit der Erklärung, ohne Floskeln wie „Auf dieser Seite…".'
  ].join('\n')
}

/** Nutzer-Nachricht, die das Seitenbild begleitet. */
export const EXPLANATION_USER_PROMPT = 'Erkläre diese Seite.'

/** Obergrenze der Antwort-Tokens für eine Seiten-Erklärung. */
export const EXPLANATION_MAX_TOKENS = 2000
