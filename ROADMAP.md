# KITeacher – Roadmap

Lebender Fortschritts-Tracker. Wird nach jeder Etappe aktualisiert.
Projektbeschreibung & Architektur: siehe [CLAUDE.md](CLAUDE.md).

Status-Legende: ⬜ offen · 🟡 läuft · ✅ fertig

## Etappen

1. ✅ **Grundgerüst** – Electron + React + Vite + TypeScript (electron-vite), App startet.
   Schichten-Ordner (`main` / `preload` / `renderer` / `shared`), typisierte IPC-Bridge
   (`window.api`), contextIsolation aktiv. Build & Typecheck grün.
2. ✅ **Lokale Persistenz** – SQLite via `better-sqlite3`, versionierte Migrationen
   (`PRAGMA user_version`), App-Datenordner (DB + `pdfs/`). Datenzugriff über
   Repository-Pattern (`Project`/`Page`/`ChatMessage`), Domänentypen in `shared`.
   DB wird beim App-Start initialisiert. Build, Typecheck & DB-Smoke-Test grün.
3. ✅ **Projekt-Menü** – Übersicht (neueste zuerst), PDF-Import via Datei-Dialog
   (Kopie nach `pdfs/`, Anzeigename = Dateiname), Umbenennen (inline), Öffnen
   (Platzhalter-Ansicht bis Etappe 4), Löschen (mit Bestätigung + PDF-Datei).
   IPC-Kanäle `projects:*`, Feature-Ordner `main/projects/` & `renderer/.../features/projects/`.
   Build & Typecheck grün.
4. ✅ **Split-Screen + PDF-Viewer** – Split-Screen (links PDF, rechts Erklär-Platz),
   PDF-Anzeige via `pdf.js` auf Canvas (an Containerbreite skaliert, Geräte-Pixeldichte),
   Seiten-Navigation (vor/zurück), Zoom per Pinch-Geste (Trackpad) bzw. Strg/Cmd+Scrollrad
   (0,25×–5×, neu gerendert → bleibt scharf). PDF-Bytes über IPC (`projects:readPdf`), kein
   Datei-Zugriff im Renderer. Echte Seitenzahl wird beim Laden ermittelt und – falls
   beim Import noch 0 – persistent nachgetragen (`projects:setPageCount`).
   Feature-Ordner `renderer/.../features/reader/`. Build & Typecheck grün.
5. ✅ **Einstellungen + API-Key** – Einstellungsansicht (über die Übersicht erreichbar):
   API-Key-Eingabe mit sicherer Speicherung im OS-Keychain (`safeStorage`, nie Klartext,
   getrennt von `settings.json`), Verbindungstest gegen die Claude-API (`models.retrieve`,
   tokensparend), Modellwahl und Erklär-Niveau. KI hinter dem
   `AIProvider`-Interface (`AnthropicProvider`). IPC-Kanäle `settings:*`, Feature-Ordner
   `main/settings/`, `main/ai/` & `renderer/.../features/settings/`. Build & Typecheck grün.
   (Der ursprüngliche Prefetch-Schalter wurde in Etappe 7 entfernt – siehe dort.)
6. ✅ **KI-Erklärung (Vision)** – Aktuelle Seite wird im Renderer mit pdf.js zu einem
   PNG gerendert und über IPC (`pages:generateExplanation`) an Claude (Vision) geschickt →
   didaktischer Erklärtext rechts. On-Demand + Caching: Text wird lokal gespeichert
   (`pages`-Tabelle), beim Wiederöffnen kein neuer Request (`pages:get` prüft den Cache).
   „Neu erklären"-Button umgeht den Cache. Prompts zentral in
   `main/ai/prompts.ts` (Niveau-abhängig), `AIProvider.explainPage` im Interface.
   (Das anfängliche Auto-Generieren beim Öffnen und das Prefetching wurden in
   Etappe 7 durch manuelles Erklären per Knopf ersetzt – siehe dort.)
   Feature-Ordner `main/pages/` & Renderer `features/reader/` (Pane + Hook + Bild-Renderer).
   Build & Typecheck grün.
7. ✅ **Chat pro Seite** – Die ganze rechte Spalte ist EIN durchgehender Chat: Die
   KI-Erklärung der Seite ist die erste Nachricht, darunter reihen sich Rückfragen
   und Antworten ein (Bubbles, KI-Texte als Markdown/KaTeX über den gemeinsamen
   `MarkdownView`). Rückfragen gehen mit Seitenbild + Erklärtext als Kontext an die
   KI (Vision); Enter sendet / Shift+Enter neue Zeile, „Neu erklären" an der ersten
   Blase, „Rückfragen löschen" im Kopf. Die Erklärung bleibt technisch getrennt
   gecacht (`pages`-Tabelle), die Rückfragen liegen in `chat_messages` und werden
   beim Öffnen der Seite geladen. Frage und Antwort werden erst nach erfolgreicher
   KI-Antwort gespeichert – bei Fehler (kein Key / API-Problem) bleibt der Verlauf
   unverändert. `AIProvider.chat` im Interface, Prompts zentral in
   `main/ai/prompts.ts`. IPC-Kanäle `chat:*`, Feature-Ordner `main/chat/` & Renderer
   `features/reader/` (Pane + Hook + `MarkdownView`).
   **Außerdem:** Erklärungen werden nicht mehr automatisch erzeugt (weder beim
   Öffnen noch im Voraus) – nur noch per „Seite erklären"-Knopf. Das Prefetching
   und der zugehörige Einstellungs-Schalter wurden komplett entfernt
   (`AppSettings` ohne `prefetchEnabled`). Build & Typecheck grün.
8. ✅ **Feinschliff** – Fehlerbehandlung verfeinert: fehlgeschlagene KI-Aufrufe
   tragen jetzt einen `kind` (`'no-key' | 'ai'`, `shared/domain.ts`). Der
   Sonderfall „kein API-Key" wird dadurch vom allgemeinen API-Fehler getrennt:
   Statt nur „Erneut versuchen" bietet die UI einen Knopf „Zu den Einstellungen"
   – sowohl an der Erklärungs-Fehlerblase als auch unter einer gescheiterten
   Rückfrage. Dafür kann man aus einem geöffneten Projekt in die Einstellungen
   wechseln und kehrt danach an dieselbe Seite zurück (App-Navigation merkt sich
   die Herkunft, `App.tsx`). „Kein-Key"-Meldung zentral in `main/ai/errors.ts`
   (`NO_API_KEY_MESSAGE`, vorher in beiden Handlern dupliziert). UI-Politur:
   ungenutztes `.explain-*`-CSS (Rest aus Etappe 6, durch den Chat ersetzt) und
   doppelte `.spinner`/`@keyframes spin` entfernt. Build & Typecheck grün.

## Notizen / Abweichungen

- **API-Key-Ablage:** Verschlüsselt via `safeStorage` in `apikey.bin` (Schlüssel im
  OS-Keychain). Bewusst getrennt von `settings.json` (Modell/Niveau) und ohne
  IPC-Rückkanal – der Key verlässt den Main-Prozess nie im Klartext; die UI kennt nur
  das `hasApiKey`-Flag. Ist `safeStorage` nicht verfügbar, schlägt das Speichern bewusst
  fehl (keine Klartext-Fallback-Ablage).
- **Verbindungstest:** `models.retrieve(model)` statt einer Chat-Anfrage – prüft Key
  **und** Modellverfügbarkeit, ohne Tokens zu verbrauchen.
- **AIProvider:** `testConnection` (Etappe 5), `explainPage` (Etappe 6, Vision)
  und `chat` (Etappe 7, Vision + Verlauf) im Interface `main/ai/aiProvider.ts`. Die
  Fehlerübersetzung (SDK → deutsche Meldung) liegt gemeinsam in `main/ai/errors.ts`.

- **Fehler-`kind` (Etappe 8):** `ExplanationResult`/`ChatResult` liefern bei
  Misserfolg neben der Meldung ein `kind` (`'no-key' | 'ai'`). Nur so kann die UI
  den behebbaren Fall „kein API-Key" gezielt behandeln (Knopf in die
  Einstellungen) statt nur generisch „erneut versuchen". Die Handler setzen das
  `kind` an der Quelle (no-key vor dem KI-Aufruf, sonst `'ai'` im catch); die
  Renderer-Hooks (`useExplanation`, `useChat`) reichen es bis in die `ChatPane`.

- **Chat-Kontext:** Der Chat schickt bei jeder Rückfrage das Seitenbild und – als
  erster Turn – den gecachten Erklärtext mit (ein kurzer Bestätigungs-Turn der KI
  hält den anschließenden echten Verlauf sauber). Der Renderer rendert das Bild mit
  pdf.js (wie bei der Erklärung). Token-Optimierung (z. B. Prompt-Caching, Bild nur
  einmal) ist bewusst dem Feinschliff (Etappe 8) vorbehalten. Gleichzeitige Anfragen
  pro Seite werden im Main-Prozess abgewiesen (`projectId:pageNumber`), Frage + Antwort
  erst nach Erfolg gespeichert – nie verwaiste Fragen, keine doppelten Kosten.

- **Seitenbild für Vision:** Das Bild rendert der Renderer mit pdf.js
  (`features/reader/pdfImage.ts`, Ziel-Breite ~1568 px, PNG/Base64) – getrennt vom
  zoomabhängigen Anzeige-Renderer. Geladene PDF-Dokumente werden dort pro Projekt
  gecacht (eigener Handle, beim Schließen via `releaseDocument` freigegeben); der
  Anzeige-Viewer lädt sein Dokument weiterhin selbst. Bewusste, kleine Duplizierung
  zugunsten klarer Trennung – Speicher unkritisch für die lokale App.

- **Manuelles Erklären (Etappe 7):** Eine noch nicht erklärte Seite wird NIE
  automatisch generiert – weder beim Öffnen noch im Voraus. Der Renderer prüft beim
  Öffnen nur den Cache und zeigt sonst einen „Seite erklären"-Knopf (Zustand `idle`
  in `useExplanation`). Erst der Knopf (bzw. „Neu erklären") löst den Vision-Aufruf
  aus. So entstehen ausschließlich Kosten, die man selbst auslöst. Das frühere
  Prefetching der Folgeseite samt Einstellungs-Schalter wurde dafür entfernt.

- **Caching:** Der teure Vision-Aufruf passiert nur bei Cache-Miss (oder `force`
  über „Neu erklären"); beim Wiederöffnen liefert `pages:get` den gespeicherten
  Text. Zusätzlich dedupliziert der Main-Prozess gleichzeitige Anfragen pro Seite
  (`projectId:pageNumber`): Läuft schon eine Erzeugung, hängt sich jeder weitere
  Aufruf an deren Ergebnis an – dieselbe Seite kann so unter keinen Umständen
  doppelt abgerechnet werden (z. B. bei schnellem Doppelklick auf „Erklären").


- **Seitenzahl beim Import:** Wird mit `0` angelegt; die echte Seitenzahl ermittelt
  der PDF-Viewer (Etappe 4) beim ersten Öffnen via pdf.js und trägt sie persistent
  nach. Die Übersicht blendet die Angabe aus, solange sie `0` ist (z. B. vor dem
  ersten Öffnen).

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
