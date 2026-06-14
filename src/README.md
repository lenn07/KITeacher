# Quellstruktur

Die Schichten-Trennung aus [CLAUDE.md](../CLAUDE.md) spiegelt sich in den Ordnern:

| Ordner          | Prozess  | Aufgabe                                                        |
|-----------------|----------|----------------------------------------------------------------|
| `main/`         | Main     | Electron-Lebenszyklus, Fenster, Persistenz (`db/`, `storage/`), später KI-Service. |
| `preload/`      | Bridge   | Gibt dem Renderer nur die typisierte `window.api` frei.         |
| `renderer/`     | Renderer | React-UI (`src/` darin). Kein direkter Node-Zugriff.            |
| `shared/`       | beide    | Zentrale Typen (`domain.ts`) & der IPC-Vertrag (`ipc.ts`).      |

Die lokale Persistenz (SQLite + Migrationen + App-Datenordner) ist in
[main/db/README.md](main/db/README.md) beschrieben.

**Kommunikation:** Renderer → `window.api` (Preload) → `ipcMain`-Handler (Main).
Neue Funktionen ergänzen ihren Kanal in `shared/ipc.ts`, die Implementierung im
Preload und den Handler im Main – so bleiben beide Seiten typsicher gekoppelt.
