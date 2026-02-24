import { useEffect, useState } from 'react'
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
import { loadProjectFromFolder } from '@/db/projectSerializer'
import { getFileWriter, createElectronWriter } from '@/db/fileWriter'
import { saveNowToFolder } from '@/lib/folderSaveScheduler'

export default function App() {
  const { theme, language } = useEditorStore()
  const { i18n } = useTranslation()
  const [ready, setReady] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)

  const currentProject = useProjectStore(s => s.currentProject)

  // Initialize DB + auto-load/create project on startup
  // Primary load: folder (storyflow.json) → fallback: IndexedDB (backup)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const adapter = getAdapter()
        await adapter.init()
        // Purge expired trash items
        const purged = await adapter.purgeExpiredTrash()
        if (purged > 0) console.log(`[Trash] Purged ${purged} expired items`)
        // Load built-in + custom node definitions
        await initNodeRegistry()
        const { loadProjects, selectProject, loadFromFolder } = useProjectStore.getState()
        await loadProjects()
        const projects = useProjectStore.getState().projects
        if (projects.length > 0) {
          const project = projects[0]

          // ── File-system-first loading ──
          // If the project has a folder path, load from storyflow.json (primary source)
          // and sync into SQLite, then select.
          const writer = getFileWriter(project)
            ?? (project.folderPath ? createElectronWriter(project.folderPath) : null)

          if (writer?.isAvailable()) {
            try {
              const result = await loadProjectFromFolder(writer)
              if (result.success && result.data) {
                console.log('[Startup] Loading project from folder (primary source)')
                await loadFromFolder(result.data, project.folderPath, project.usesFolderStorage)
              } else {
                // Folder read failed — fall back to SQLite/IndexedDB data
                console.warn('[Startup] Folder load failed, using IndexedDB data:', result.error)
                await selectProject(project.id)
              }
            } catch (err) {
              console.warn('[Startup] Folder sync error, using IndexedDB data:', err)
              await selectProject(project.id)
            }
          } else {
            // No folder configured — load from SQLite/IndexedDB (backup)
            await selectProject(project.id)
          }
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

  // Folder save is now triggered automatically on every data change via
  // _markDirty() → scheduleFolderSave() in the SQLite adapter.
  // This lifecycle handler ensures a final save when the page becomes hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveNowToFolder()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
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
