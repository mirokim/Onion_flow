import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastContainer } from '@/components/common/Toast'
import { UndoToast } from '@/components/common/UndoToast'
import { ProjectDialog } from '@/components/common/ProjectDialog'
import { getAdapter } from '@/db/storageAdapter'
import { initNodeRegistry } from '@nodes/index'
import { saveProjectToFolder } from '@/db/projectSerializer'

const AUTO_SAVE_INTERVAL = 60_000 // 60 seconds

export default function App() {
  const { theme, language } = useEditorStore()
  const { i18n } = useTranslation()
  const [ready, setReady] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)

  const currentProject = useProjectStore(s => s.currentProject)

  // Initialize DB + auto-load/create project on startup
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const adapter = getAdapter()
        await adapter.init()
        // Load built-in + custom node definitions
        await initNodeRegistry()
        const { loadProjects, selectProject } = useProjectStore.getState()
        await loadProjects()
        const projects = useProjectStore.getState().projects
        if (projects.length > 0) {
          await selectProject(projects[0].id)
        } else {
          // No projects — show dialog
          if (!cancelled) setShowProjectDialog(true)
        }
      } catch (err) {
        console.error('App initialization failed:', err)
      }
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Auto-save to folder every 60 seconds (if project has folderPath)
  useEffect(() => {
    const interval = setInterval(async () => {
      const project = useProjectStore.getState().currentProject
      if (!project?.folderPath) return

      const { chapters } = useProjectStore.getState()
      const { useCanvasStore } = await import('@/stores/canvasStore')
      const { nodes, wires } = useCanvasStore.getState()
      const { useWikiStore } = await import('@/stores/wikiStore')
      const { entries } = useWikiStore.getState()

      const projectNodes = nodes.filter(n => n.projectId === project.id)
      const projectWires = wires.filter(w => w.projectId === project.id)
      const projectEntries = entries.filter(e => e.projectId === project.id)

      await saveProjectToFolder(
        project.folderPath!,
        project,
        chapters,
        projectNodes,
        projectWires,
        projectEntries,
      )
    }, AUTO_SAVE_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync language store → i18n
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary text-text-muted text-sm">
        Loading...
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell />
      <ToastContainer />
      <UndoToast />
      <ProjectDialog
        open={showProjectDialog || !currentProject}
        onClose={() => setShowProjectDialog(false)}
      />
    </ErrorBoundary>
  )
}
