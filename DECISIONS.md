# KITeacher – Entscheidungen & Notizen

Kurzes Gedächtnis für bewusste Design-Entscheidungen und Abweichungen – das
**Warum** hinter dem Code, das weder in `CLAUDE.md` (schlankes „Was & Wie") noch
im Code selbst steht. Kein Fahrplan, keine Fortschrittsliste: hier landet nur,
was man später nachschlagen will, um eine Entscheidung nicht erneut aufzurollen.

Projektbeschreibung & Architektur: siehe [CLAUDE.md](CLAUDE.md).

## Notizen / Abweichungen

- **API-Key-Ablage:** Verschlüsselt via `safeStorage` in `apikey.bin` (Schlüssel im
  OS-Keychain). Bewusst getrennt von `settings.json` (Modell/Niveau) und ohne
  IPC-Rückkanal – der Key verlässt den Main-Prozess nie im Klartext; die UI kennt nur
  das `hasApiKey`-Flag. Ist `safeStorage` nicht verfügbar, schlägt das Speichern bewusst
  fehl (keine Klartext-Fallback-Ablage).
- **Verbindungstest:** `models.retrieve(model)` statt einer Chat-Anfrage – prüft Key
  **und** Modellverfügbarkeit, ohne Tokens zu verbrauchen.
- **AIProvider:** `testConnection`, `explainPage` (Vision) und `chat` (Vision +
  Verlauf) im Interface `main/ai/aiProvider.ts`. Die Fehlerübersetzung (SDK →
  deutsche Meldung) liegt gemeinsam in `main/ai/errors.ts`.

- **Fehlerbehandlung (`describeAiError`):** Übersetzt die Anthropic-SDK-Fehler in
  deutsche, handlungsleitende Meldungen: ungültiger Key (401), keine Berechtigung
  (403), Modell nicht verfügbar (404), Rate-Limit (429), keine Verbindung/Timeout,
  **Guthaben aufgebraucht** (400 mit Stichwort „credit balance" – am Fehlertext
  erkannt, nicht am Status, damit es robust bleibt) und ein generischer Fallback.
  Der „kein Key"-Fall wird **vor** dem KI-Aufruf abgefangen (`NO_API_KEY_MESSAGE`).

- **Fehler-`kind`:** `ExplanationResult`/`ChatResult` liefern bei Misserfolg neben
  der Meldung ein `kind` (`'no-key' | 'ai'`). Nur so kann die UI den behebbaren Fall
  „kein API-Key" gezielt behandeln (Link in die Einstellungen) statt nur generisch
  „erneut versuchen". Die Handler setzen das `kind` an der Quelle (no-key vor dem
  KI-Aufruf, sonst `'ai'` im catch); die Renderer-Hooks (`useExplanation`,
  `useChat`) reichen es bis in die `ChatPane`. Den „Einstellungen"-Link komponiert
  die UI selbst (`NoApiKeyMessage`) – sie **parst** die Backend-Meldung bewusst
  nicht, damit eine Umformulierung dort den Link nicht stillschweigend entfernt.

- **Einstellungen aus dem Projekt:** Aus einem geöffneten Projekt kann man bei
  fehlendem Key direkt in die Einstellungen wechseln und kehrt danach an dieselbe
  Seite zurück – die App-Navigation (`App.tsx`) merkt sich die Herkunft samt
  aktueller Seite (`onOpenSettings(page)`), weil die `ProjectView` beim Wechsel
  ausgehängt wird und ihren `currentPage`-State sonst verlöre.

- **PDF-Fehlerbanner:** Der `PdfViewer` meldet Lade-/Renderfehler über `onError`
  und ruft `onError(null)` nach erfolgreichem Render – so bleibt ein altes Banner
  nach dem Weiterblättern nicht stehen.

- **Chat-Kontext:** Der Chat schickt bei jeder Rückfrage das Seitenbild und – als
  erster Turn – den gecachten Erklärtext mit (ein kurzer Bestätigungs-Turn der KI
  hält den anschließenden echten Verlauf sauber). Der Renderer rendert das Bild mit
  pdf.js (wie bei der Erklärung). Token-Optimierung (z. B. Prompt-Caching, Bild nur
  einmal) ist bewusst noch offen. Gleichzeitige Anfragen pro Seite werden im
  Main-Prozess abgewiesen (`projectId:pageNumber`), Frage + Antwort erst nach Erfolg
  gespeichert – nie verwaiste Fragen, keine doppelten Kosten.

- **Seitenbild für Vision:** Das Bild rendert der Renderer mit pdf.js
  (`features/reader/pdfImage.ts`, Ziel-Breite ~1568 px, PNG/Base64) – getrennt vom
  zoomabhängigen Anzeige-Renderer. Geladene PDF-Dokumente werden dort pro Projekt
  gecacht (eigener Handle, beim Schließen via `releaseDocument` freigegeben); der
  Anzeige-Viewer lädt sein Dokument weiterhin selbst. Bewusste, kleine Duplizierung
  zugunsten klarer Trennung – Speicher unkritisch für die lokale App.

- **Manuelles Erklären:** Eine noch nicht erklärte Seite wird NIE automatisch
  generiert – weder beim Öffnen noch im Voraus. Der Renderer prüft beim Öffnen nur
  den Cache und zeigt sonst einen „Seite erklären"-Knopf (Zustand `idle` in
  `useExplanation`). Erst der Knopf (bzw. „Neu erklären") löst den Vision-Aufruf
  aus. So entstehen ausschließlich Kosten, die man selbst auslöst. Ein früheres
  Prefetching der Folgeseite samt Einstellungs-Schalter wurde dafür entfernt
  (`AppSettings` ohne `prefetchEnabled`).

- **Caching:** Der teure Vision-Aufruf passiert nur bei Cache-Miss (oder `force`
  über „Neu erklären"); beim Wiederöffnen liefert `pages:get` den gespeicherten
  Text. Zusätzlich dedupliziert der Main-Prozess gleichzeitige Anfragen pro Seite
  (`projectId:pageNumber`): Läuft schon eine Erzeugung, hängt sich jeder weitere
  Aufruf an deren Ergebnis an – dieselbe Seite kann so unter keinen Umständen
  doppelt abgerechnet werden (z. B. bei schnellem Doppelklick auf „Erklären"). Das
  Ergebnis wird im Main-Prozess gespeichert, bevor der Renderer es anzeigt – ein
  zwischenzeitlicher Seitenwechsel verwirft also nur die Anzeige, nicht die Kosten.

- **Seitenzahl beim Import:** Wird mit `0` angelegt; die echte Seitenzahl ermittelt
  der PDF-Viewer beim ersten Öffnen via pdf.js und trägt sie persistent nach. Die
  Übersicht blendet die Angabe aus, solange sie `0` ist (z. B. vor dem ersten Öffnen).

- **Ordner (verschachtelbar):** Eigene Tabelle `folders` mit selbst-referenziellem
  `parent_id` (Migration v3); `projects` bekommt `folder_id`. Beide FKs `NULL =
  Wurzelebene` und `ON DELETE CASCADE`. Bewusst eine separate Tabelle statt eines
  Materialized-Path-Strings: rekursive CTEs (`collectDescendantPdfPaths`,
  `isDescendantOrSelf`) bleiben einfach und der referenzielle Integritätsschutz
  greift. Bestehende Projekte (vor v3) haben `folder_id = NULL` und liegen auf der
  Wurzel – keine Datenmigration nötig.
  - **Löschen** kaskadiert in der DB; die PDF-Dateien räumt der Handler **vorher**
    explizit weg (`folderRepository.collectDescendantPdfPaths` → `rmSync`), weil
    `ON DELETE CASCADE` nur DB-Zeilen entfernt, nicht die Dateien im `pdfs/`-Ordner.
    Gleiches Muster wie beim Projekt-Löschen.
  - **Verschieben** mit Zyklus-Schutz: `foldersMove` lehnt ein Ziel ab, das der
    Ordner selbst oder einer seiner Nachfahren ist (`isDescendantOrSelf`), sonst
    würde der Teilbaum von der Hierarchie abgehängt. Die UI blendet ungültige Ziele
    im `FolderPicker` zusätzlich aus.
  - **Navigation** ist reiner Renderer-State im `ProjectMenu` (Breadcrumb-Pfad);
    `currentFolderId` steuert das Laden. Das Öffnen eines Projekts bleibt
    unverändert (`App.tsx` kennt keine Ordner).

- **Notizen (Logseq-artig):** Eigene Tabelle `note_blocks` (Migration v4) mit
  `page_id` (FK `ON DELETE CASCADE`), `position`, `indent`, `content` (roher
  Markdown). Notizen hängen an der Seite (`pages`) wie der Chat – dieselbe
  On-Demand-Anlage der Seite (`getOrCreate`), kein KI-Aufruf. Bewusste
  Entwurfsentscheidungen:
  - **Renderer ist die Quelle der Wahrheit:** Der Editor hält die Blockliste mit
    eigenen, stabilen Client-`id`s und speichert verzögert (debounced) die
    **komplette** Liste; der Handler ersetzt die Blöcke der Seite in einer
    Transaktion (`replaceForPage`). Einfacher und robuster als pro-Block-CRUD bei
    der überschaubaren Blockzahl pro Seite. Nach dem Speichern wird **nicht** neu
    eingelesen – das würde nur die Fokus-/Cursor-Verfolgung stören (DB-`id`s sind
    im UI irrelevant).
  - **Flush beim Seitenwechsel:** `useNotes` schreibt im Effekt-Cleanup noch
    ausstehende Änderungen der verlassenen Seite sofort (Ziel + letzter Stand via
    Ref), bevor die neue Seite geladen wird – sonst gingen die letzten ~600 ms
    Tippen verloren.
  - **Umschalter statt Drittspalte:** Die Notizen **ersetzen** die rechte Spalte
    (KI-Chat) per Knopf oben rechts, statt eine dritte Spalte zu öffnen – hält das
    Split-Screen-Layout ruhig. Der Zustand (`rightPanel: 'ai' | 'notes'`) ist
    reiner Renderer-State in `ProjectView`; beide Hooks (`useChat`, `useNotes`)
    laufen weiter, damit kein Stand beim Umschalten verloren geht.
  - **Geteilte Markdown-Darstellung:** Gerenderte Blöcke nutzen dieselbe
    `chat-markdown`-CSS + `MarkdownView` (KaTeX) wie die KI-Texte – ein Stil,
    inkl. Mathe, ohne Duplizierung.

- **Zuletzt gelesene Seite:** Pro Projekt wird die zuletzt geöffnete Seite
  gespeichert (`projects.last_page`, Migration v2, Default `1`). Beim Wiederöffnen
  startet man dort statt auf Seite 1. Der Renderer merkt jede Seitennavigation per
  `projects:setLastPage`; übersteigt der gemerkte Wert die (ggf. korrigierte)
  Seitenzahl, klemmt der Viewer beim Laden auf die letzte gültige Seite.

- **pdf.js-Worker:** `pdfjs-dist` lagert das Parsen in einen Web-Worker aus. Dessen
  URL kommt über Vites `?url`-Import (`pdf.worker.min.mjs?url`) → eigener Asset-Chunk,
  funktioniert in Dev und Build. Dafür `vite/client`-Typen via `src/renderer/src/env.d.ts`.

- **Build:** electron-vite gewählt (saubere Main/Preload/Renderer-Trennung, typsicher).
  Main/Preload werden als CommonJS gebaut (kein `"type": "module"`), um den
  ESM↔CJS-Interop-Crash in Electrons gebündeltem Node 20 zu vermeiden.
- **Native Bindung:** `better-sqlite3` muss gegen Electrons ABI gebaut werden.
  Das erledigt der `postinstall`-Hook (`electron-rebuild`); nach Electron-Updates
  ggf. `npx electron-rebuild -f -w better-sqlite3`. Der System-Node (hier v26) ist
  irrelevant – das Modul wird nie gegen ihn geladen, nur gegen Electron.
- **Umgebungs-Hinweis:** In der VSCode-Integration ist `ELECTRON_RUN_AS_NODE=1`
  gesetzt → `npm run dev` startet dann keine GUI. Lokal mit
  `env -u ELECTRON_RUN_AS_NODE npm run dev` bzw. in einem normalen Terminal starten.
