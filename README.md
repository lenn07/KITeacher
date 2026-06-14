# KITeacher

Lokale Desktop-App, die PDFs in seitenweise, verständliche KI-Erklärungen verwandelt.
Split-Screen: links das PDF, rechts ein KI-Erklärtext zur aktuellen Seite + Chat für
Rückfragen. Alles läuft lokal, kein Login – jeder Nutzer hinterlegt seinen eigenen
Claude API-Key.

Mehr zum *Was & Wie*: [CLAUDE.md](CLAUDE.md) · Fortschritt: [ROADMAP.md](ROADMAP.md).

## Tech-Stack

Electron + React + TypeScript, gebaut mit [electron-vite](https://electron-vite.org).
Quellstruktur & Schichten-Trennung: siehe [src/README.md](src/README.md).

## Voraussetzungen

- Node.js ≥ 20
- npm

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # App im Entwicklungsmodus starten (Hot Reload)
npm run build    # Typecheck + Produktions-Build nach out/
npm run typecheck
```

> **Hinweis (VSCode-Terminal):** Ist `ELECTRON_RUN_AS_NODE=1` gesetzt, startet keine
> GUI. Dann mit `env -u ELECTRON_RUN_AS_NODE npm run dev` starten oder ein normales
> Terminal verwenden.
