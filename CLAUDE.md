# KITeacher

Lokale Desktop-App, die PDFs in seitenweise, verständliche KI-Erklärungen verwandelt.
Split-Screen: links das PDF, rechts ein KI-Erklärtext zur aktuellen Seite + ein Chat
für Rückfragen. Alles läuft lokal, kein Login. Jeder Nutzer hinterlegt seinen eigenen
Claude API-Key.

> **Hinweis für neue Chats:** Diese Datei beschreibt *was* die App ist und *wie* sie
> gebaut wird. Bewusste Design-Entscheidungen und Abweichungen (das *Warum*) stehen
> in [DECISIONS.md](DECISIONS.md).

## Kernfunktionen

- **Projekt-Menü:** Ordner-Browser über alle Projekte (umbenennbarer Name, Standard =
  PDF-Dateiname). Öffnen / umbenennen / verschieben / löschen. Frühere Projekte
  jederzeit wieder aufrufbar.
- **Ordner:** Verschachtelbare Ordner zum Gruppieren von PDFs (Ordner in Ordner).
  PDFs werden in den aktuellen Ordner importiert; Navigation per Breadcrumb. Das
  Löschen eines Ordners entfernt rekursiv Unterordner, Projekte und deren PDFs.
- **Split-Screen:** links PDF mit Vor/Zurück-Navigation, rechts Erklärtext zur aktuellen Seite.
- **KI-Erklärung:** aktuelle Seite wird als **Bild** an Claude (Vision) geschickt → didaktischer
  Erklärtext. So werden auch Diagramme, Formeln und Layout erfasst.
- **On-Demand + Caching:** Text wird nur auf Knopfdruck erzeugt (kein automatisches
  Generieren beim Öffnen oder im Voraus) und lokal gespeichert. Beim Wiederöffnen
  kein erneuter Request (Token-Sparen).
- **Chat pro Seite:** Rückfragen an die KI mit Seitenbild + Erklärtext als Kontext.
  Verlauf wird pro Seite gespeichert.
- **Einstellungen:** API-Key (sicher), Modellwahl, Erklär-Niveau.

## Tech-Stack

| Bereich   | Wahl                                                      |
|-----------|-----------------------------------------------------------|
| Framework | Electron + React + TypeScript + Vite                      |
| PDF       | `pdf.js` (Anzeige + Seite→Bild für Vision)                |
| KI        | `@anthropic-ai/sdk`, Vision, Modell konfigurierbar        |
| Speicher  | SQLite (Projekte/Seiten/Texte/Chats) + PDFs im App-Datenordner |
| Sicherheit| API-Key im OS-Keychain via Electron `safeStorage`, nie Klartext |

## Datenmodell

- `Folder` (id, name, parent_id, erstellt_am) – `parent_id` = übergeordneter Ordner, `null` = Wurzel
- `Project` (id, name, folder_id, pdf_pfad, seitenanzahl, erstellt_am) – `folder_id` `null` = Wurzel
- `Page` (id, project_id, seitennummer, erklärtext, generiert_am)
- `ChatMessage` (id, page_id, rolle, inhalt, zeitstempel)

Beziehung: `Folder` → (`Folder` | `Project`) → `Page` → `ChatMessage`.

## Architektur-Prinzipien (wichtig: auf Weiterentwickelbarkeit ausgelegt)

- **Schichten-Trennung:** UI (React) ↔ App-Logik ↔ Datenzugriff (Repository-Pattern)
  ↔ KI-Service. Jede Schicht für sich austauschbar.
- **KI hinter einem Interface:** ein `AIProvider`-Interface, damit später ein anderes
  Modell / Provider / lokales LLM ohne Umbau eingesetzt werden kann.
- **Datenbank über Migrationen:** Schema-Änderungen versioniert, bestehende Projekte
  bleiben erhalten.
- **Electron sauber getrennt:** Main-Prozess (Dateien/DB/KI) vs. Renderer (UI) über
  klar definierte, typisierte IPC-Schnittstellen. Kein direkter Node-Zugriff im Renderer.
- **TypeScript durchgängig**, zentrale Typen, Konfig/Prompts an einer Stelle ausgelagert
  (Prompts editierbar, nicht im Code verstreut).
- **Modulare Feature-Ordner** mit kurzer Doku, damit man schnell reinkommt.

## Konventionen

- Sprache der App und der KI-Erklärtexte: **Deutsch**.
- Erklär-Stil: didaktisch / „erkläre es einfach", Niveau in Einstellungen anpassbar.
- Diese Datei (`CLAUDE.md`) schlank und stabil halten (das „Was & Wie").
  Begründungen einzelner Entscheidungen gehören in `DECISIONS.md`.
