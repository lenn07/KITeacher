import { useEffect, useState } from 'react'

/**
 * Platzhalter-Oberfläche für das Grundgerüst (Etappe 1).
 * Zeigt, dass React rendert und die typisierte IPC-Bridge zum Main-Prozess
 * funktioniert (App-Version wird über window.api geladen).
 * Der eigentliche Split-Screen folgt in späteren Etappen.
 */
function App(): React.JSX.Element {
  const [version, setVersion] = useState<string>('…')

  useEffect(() => {
    window.api
      .getAppVersion()
      .then(setVersion)
      .catch(() => setVersion('unbekannt'))
  }, [])

  return (
    <main className="welcome">
      <h1>KITeacher</h1>
      <p>PDFs in seitenweise, verständliche KI-Erklärungen verwandeln.</p>
      <p className="version">Grundgerüst läuft · Version {version}</p>
    </main>
  )
}

export default App
