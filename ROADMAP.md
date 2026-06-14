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
   tokensparend), Modellwahl, Erklär-Niveau und Prefetch-Schalter. KI hinter dem
   `AIProvider`-Interface (`AnthropicProvider`). IPC-Kanäle `settings:*`, Feature-Ordner
   `main/settings/`, `main/ai/` & `renderer/.../features/settings/`. Build & Typecheck grün.
6. ✅ **KI-Erklärung (Vision)** – Aktuelle Seite wird im Renderer mit pdf.js zu einem
   PNG gerendert und über IPC (`pages:generateExplanation`) an Claude (Vision) geschickt →
   didaktischer Erklärtext rechts. On-Demand + Caching: Text wird lokal gespeichert
   (`pages`-Tabelle), beim Wiederöffnen kein neuer Request (`pages:get` prüft den Cache).
   Prefetching der Folgeseite (n+1) im Hintergrund, entprellt/abbrechbar, in den
   Einstellungen abschaltbar. „Neu erklären"-Button umgeht den Cache. Prompts zentral in
   `main/ai/prompts.ts` (Niveau-abhängig), `AIProvider.explainPage` im Interface.
   Feature-Ordner `main/pages/` & Renderer `features/reader/` (Pane + Hook + Bild-Renderer).
   Build & Typecheck grün.
7. ✅ **Chat pro Seite** – Die ganze rechte Spalte ist EIN durchgehender Chat: Die
   KI-Erklärung der Seite ist die erste Nachricht, darunter reihen sich Rückfragen
   und Antworten ein (Bubbles, KI-Texte als Markdown/KaTeX über den gemeinsamen
   `MarkdownView`). Rückfragen gehen mit Seitenbild + Erklärtext als Kontext an die
   KI (Vision); Enter sendet / Shift+Enter neue Zeile, „Neu erklären" an der ersten
   Blase, „Rückfragen löschen" im Kopf. Die Erklärung bleibt technisch getrennt
   gecacht (`pages`-Tabelle, On-Demand/Prefetch unverändert), die Rückfragen liegen
   in `chat_messages` und werden beim Öffnen der Seite geladen. Frage und Antwort
   werden erst nach erfolgreicher KI-Antwort gespeichert – bei Fehler (kein Key /
   API-Problem) bleibt der Verlauf unverändert. `AIProvider.chat` im Interface,
   Prompts zentral in `main/ai/prompts.ts`. IPC-Kanäle `chat:*`, Feature-Ordner
   `main/chat/` & Renderer `features/reader/` (Pane + Hook + `MarkdownView`).
   Build & Typecheck grün.
8. ⬜ **Feinschliff** – Ladezustände, Fehlerbehandlung (kein Key / API-Fehler), UI-Politur.

## Notizen / Abweichungen

- **API-Key-Ablage:** Verschlüsselt via `safeStorage` in `apikey.bin` (Schlüssel im
  OS-Keychain). Bewusst getrennt von `settings.json` (Modell/Niveau/Prefetch) und ohne
  IPC-Rückkanal – der Key verlässt den Main-Prozess nie im Klartext; die UI kennt nur
  das `hasApiKey`-Flag. Ist `safeStorage` nicht verfügbar, schlägt das Speichern bewusst
  fehl (keine Klartext-Fallback-Ablage).
- **Verbindungstest:** `models.retrieve(model)` statt einer Chat-Anfrage – prüft Key
  **und** Modellverfügbarkeit, ohne Tokens zu verbrauchen.
- **AIProvider:** `testConnection` (Etappe 5), `explainPage` (Etappe 6, Vision)
  und `chat` (Etappe 7, Vision + Verlauf) im Interface `main/ai/aiProvider.ts`. Die
  Fehlerübersetzung (SDK → deutsche Meldung) liegt gemeinsam in `main/ai/errors.ts`.

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

- **Caching/Prefetch:** Der teure Vision-Aufruf passiert nur bei Cache-Miss (oder
  `force` über „Neu erklären"). Prefetch der Seite n+1 ist im Renderer entprellt
  (600 ms) und bricht bei schnellem Durchklicken ab. Zusätzlich dedupliziert der
  Main-Prozess gleichzeitige Anfragen pro Seite (`projectId:pageNumber`): Läuft
  schon eine Erzeugung, hängt sich jeder weitere Aufruf an deren Ergebnis an –
  dieselbe Seite kann so unter keinen Umständen doppelt abgerechnet werden (auch
  nicht im Prefetch-Rennen zwischen Hintergrundladen und Aufschlagen der Seite).


- **Seitenzahl beim Import:** Wird mit `0` angelegt; die echte Seitenzahl ermittelt
  der PDF-Viewer (Etappe 4) beim ersten Öffnen via pdf.js und trägt sie persistent
  nach. Die Übersicht blendet die Angabe aus, solange sie `0` ist (z. B. vor dem
  ersten Öffnen).

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
