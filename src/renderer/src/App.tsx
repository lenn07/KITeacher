import { useState } from 'react'
import type { Project } from '@shared/domain'
import { ProjectMenu } from './features/projects/ProjectMenu'
import { ProjectView } from './features/projects/ProjectView'

/**
 * Wurzel der UI. Verwaltet die einfache Navigation zwischen der
 * Projekt-Übersicht (Etappe 3) und einem geöffneten Projekt. Der eigentliche
 * Split-Screen mit PDF-Viewer folgt in Etappe 4; bis dahin zeigt die
 * Projekt-Ansicht einen Platzhalter.
 */
function App(): React.JSX.Element {
  const [openProject, setOpenProject] = useState<Project | null>(null)

  if (openProject) {
    return <ProjectView project={openProject} onBack={() => setOpenProject(null)} />
  }

  return <ProjectMenu onOpen={setOpenProject} />
}

export default App
