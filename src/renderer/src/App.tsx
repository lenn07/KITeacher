import { useState } from 'react'
import type { Project } from '@shared/domain'
import { ProjectMenu } from './features/projects/ProjectMenu'
import { ProjectView } from './features/projects/ProjectView'
import { SettingsView } from './features/settings/SettingsView'

/**
 * Wurzel der UI. Verwaltet die einfache Navigation zwischen Projekt-Übersicht
 * (Etappe 3), einem geöffneten Projekt (Split-Screen, Etappe 4) und den
 * Einstellungen (Etappe 5).
 */
type View = { kind: 'menu' } | { kind: 'project'; project: Project } | { kind: 'settings' }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ kind: 'menu' })

  if (view.kind === 'project') {
    return <ProjectView project={view.project} onBack={() => setView({ kind: 'menu' })} />
  }

  if (view.kind === 'settings') {
    return <SettingsView onBack={() => setView({ kind: 'menu' })} />
  }

  return (
    <ProjectMenu
      onOpen={(project) => setView({ kind: 'project', project })}
      onOpenSettings={() => setView({ kind: 'settings' })}
    />
  )
}

export default App
