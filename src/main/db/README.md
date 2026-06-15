# Datenzugriff (SQLite)

Die lokale Persistenz der App. Läuft ausschließlich im **Main-Prozess** – der
Renderer kommt nie direkt an die DB, sondern später über typisierte IPC-Kanäle.

## Aufbau

| Datei                    | Aufgabe                                                       |
|--------------------------|---------------------------------------------------------------|
| `database.ts`            | Öffnet die SQLite-Datei, setzt PRAGMAs, führt Migrationen aus. |
| `migrations.ts`          | Versionierte Schema-Migrationen (`PRAGMA user_version`).       |
| `repositories/`          | Repository-Pattern: je eine Datei pro Aggregat.               |

Speicherorte liegen im App-Datenordner (`src/main/storage/paths.ts`):
`kiteacher.db` und der Ordner `pdfs/`.

## Datenmodell

`Folder` → (`Folder` | `Project`) → `Page` → `ChatMessage` (siehe
`src/shared/domain.ts`). Ordner sind verschachtelbar (`folders.parent_id`,
selbst-referenziell); `projects.folder_id` ordnet ein Projekt einem Ordner zu –
`null` jeweils = Wurzelebene. Löschen kaskadiert (`ON DELETE CASCADE`),
`foreign_keys` ist aktiv. PDF-Dateien werden beim Löschen separat im Handler
entfernt (Cascade räumt nur DB-Zeilen).

## Migrationen erweitern

Neue Schema-Änderungen **immer** als neue Migration mit nächsthöherer `version`
in `migrations.ts` anhängen – bestehende Migrationen nie nachträglich ändern.
Beim Start spielt der Runner alle Versionen oberhalb der gespeicherten
`user_version` der Reihe nach in je eigener Transaktion ein.

## Native Bindung

`better-sqlite3` ist ein natives Modul und muss gegen Electrons ABI gebaut
werden. Das erledigt der `postinstall`-Hook (`electron-rebuild`); nach einem
Electron-Update ggf. `npx electron-rebuild -f -w better-sqlite3` ausführen.
