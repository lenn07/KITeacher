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
3. ⬜ **Projekt-Menü** – Übersicht, PDF-Import, Umbenennen, Öffnen, Löschen.
4. ⬜ **Split-Screen + PDF-Viewer** – PDF links, Seiten-Navigation (vor/zurück).
5. ⬜ **Einstellungen + API-Key** – Eingabe, sichere Speicherung (Keychain), Verbindungstest.
6. ⬜ **KI-Erklärung (Vision)** – Seite→Bild→Claude, Erklärtext rechts, Caching + Prefetching.
7. ⬜ **Chat pro Seite** – Rückfragen mit Kontext, Verlauf gespeichert.
8. ⬜ **Feinschliff** – Ladezustände, Fehlerbehandlung (kein Key / API-Fehler), UI-Politur.

## Notizen / Abweichungen

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
