import { useState } from 'react'
import type { Project } from '@shared/domain'
import { ProjectMenu } from './features/projects/ProjectMenu'
import { ProjectView } from './features/projects/ProjectView'
import { SettingsView } from './features/settings/SettingsView'

/**
 * Wurzel der UI. Verwaltet die einfache Navigation zwischen Projekt-Übersicht
 * (Etappe 3), einem geöffneten Projekt (Split-Screen, Etappe 4) und den
 * Einstellungen (Etappe 5).
 *
 * Die Einstellungen merken sich, woher man kam (`from`), damit das Zurück dorthin
 * führt – z. B. wenn man bei fehlendem API-Key aus einem geöffneten Projekt in die
 * Einstellungen wechselt und danach an derselben Seite weiterarbeiten will (Etappe 8).
 */
type Origin = { kind: 'menu' } | { kind: 'project'; project: Project }
type View = Origin | { kind: 'settings'; from: Origin }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ kind: 'menu' })

  if (view.kind === 'project') {
    const origin = view
    return (
      <ProjectView
        project={view.project}
        onBack={() => setView({ kind: 'menu' })}
        // Aktuelle Seite in die Herkunft übernehmen, damit das Zurück aus den
        // Einstellungen wieder bei genau dieser Seite landet (nicht bei lastPage
        // aus dem Menü, das die zwischenzeitliche Navigation nicht kennt).
        onOpenSettings={(page) =>
          setView({
            kind: 'settings',
            from: { ...origin, project: { ...origin.project, lastPage: page } }
          })
        }
      />
    )
  }

  if (view.kind === 'settings') {
    return <SettingsView onBack={() => setView(view.from)} />
  }

  return (
    <ProjectMenu
      onOpen={(project) => setView({ kind: 'project', project })}
      onOpenSettings={() => setView({ kind: 'settings', from: { kind: 'menu' } })}
    />
  )
}

export default App
