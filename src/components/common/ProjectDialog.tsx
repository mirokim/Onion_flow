/**
 * ProjectDialog - Project management dialog.
 * Create new project (with folder selection), open existing project folder,
 * and view recent projects. Supports both Electron and Web File System Access API.
 */
import { useState } from 'react'
import { FolderOpen, Plus, X, Folder } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { loadProjectFromFolder, saveProjectToFolder } from '@/db/projectSerializer'
import { createElectronWriter, createWebWriter, getFileWriter } from '@/db/fileWriter'
import { toast } from './Toast'
import { cn } from '@/lib/utils'
import { formatDateUTC } from '@/lib/dateUtils'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function ProjectDialog({ open, onClose }: ProjectDialogProps) {
  const [newTitle, setNewTitle] = useState('')
  const [mode, setMode] = useState<'main' | 'create'>('main')
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const { projects, createProject, selectProject } = useProjectStore()

  if (!open) return null

  const api = window.electronAPI

  const handleSelectFolder = async () => {
    if (api) {
      // Electron: native folder dialog
      const folder = await api.selectFolder()
      if (folder) setSelectedFolderPath(folder)
    } else if ('showDirectoryPicker' in window) {
      // Web: File System Access API (Chrome/Edge)
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        // Store handle on window for later use by auto-save
        ;(window as any).__onionFlowDirHandle = dirHandle
        setSelectedFolderPath(dirHandle.name)
      } catch {
        // User cancelled
      }
    } else {
      toast.warning('이 브라우저에서는 폴더 선택을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.')
    }
  }

  const handleCreateProject = async () => {
    if (!newTitle.trim()) {
      toast.warning('프로젝트 이름을 입력하세요.')
      return
    }

    const project = await createProject(newTitle.trim())
    const { updateProject } = useProjectStore.getState()

    if (selectedFolderPath) {
      if (api) {
        // Electron: create subfolder and store path
        const projectFolderPath = `${selectedFolderPath}/${newTitle.trim()}`
        await api.createFolder(projectFolderPath)
        await updateProject(project.id, { folderPath: projectFolderPath } as any)
        toast.success(`프로젝트가 ${projectFolderPath}에 생성되었습니다.`)

        // Initial save to folder
        const writer = createElectronWriter(projectFolderPath)
        await performInitialSave(writer, { ...project, folderPath: projectFolderPath })
      } else {
        // Web: mark as folder storage and perform initial save
        await updateProject(project.id, { usesFolderStorage: true } as any)
        const dirHandle = (window as any).__onionFlowDirHandle as FileSystemDirectoryHandle | undefined
        if (dirHandle) {
          // Create project subfolder
          const subDirHandle = await dirHandle.getDirectoryHandle(newTitle.trim(), { create: true })
          ;(window as any).__onionFlowDirHandle = subDirHandle
          const writer = createWebWriter(subDirHandle)
          await performInitialSave(writer, { ...project, usesFolderStorage: true })
          toast.success(`프로젝트 "${newTitle.trim()}"이(가) 생성되었습니다. 폴더에 저장됩니다.`)
        }
      }
    } else {
      toast.success(`프로젝트 "${newTitle.trim()}"이(가) 생성되었습니다.`)
    }

    setNewTitle('')
    setSelectedFolderPath(null)
    setMode('main')
    onClose()
  }

  /** Perform initial save of empty project to folder */
  const performInitialSave = async (writer: import('@/db/fileWriter').FileWriterHandle, project: any) => {
    try {
      const { chapters } = useProjectStore.getState()
      const { useCanvasStore } = await import('@/stores/canvasStore')
      const { nodes, wires } = useCanvasStore.getState()
      const { useWikiStore } = await import('@/stores/wikiStore')
      const { entries } = useWikiStore.getState()
      const { useWorldStore } = await import('@/stores/worldStore')
      const worldState = useWorldStore.getState()

      await saveProjectToFolder(writer, {
        project,
        chapters,
        canvasNodes: nodes.filter(n => n.projectId === project.id),
        canvasWires: wires.filter(w => w.projectId === project.id),
        wikiEntries: entries.filter(e => e.projectId === project.id),
        characters: worldState.characters,
        relations: worldState.relations,
        worldSettings: worldState.worldSettings,
        items: worldState.items,
        foreshadows: worldState.foreshadows,
        referenceData: worldState.referenceData,
      })
    } catch (err) {
      console.error('[InitialSave] Failed:', err)
    }
  }

  const handleOpenFolder = async () => {
    let writer: import('@/db/fileWriter').FileWriterHandle | null = null

    if (api) {
      // Electron: native folder dialog
      const folderPath = await api.selectFolder()
      if (!folderPath) return
      writer = createElectronWriter(folderPath)

      const result = await loadProjectFromFolder(writer)
      if (!result.success || !result.data) {
        toast.error(`프로젝트를 열 수 없습니다: ${result.error}`)
        return
      }

      // Check if this project already exists locally
      const existingProject = projects.find(p => p.id === result.data!.project.id)
      if (existingProject) {
        await selectProject(existingProject.id)
        toast.info('기존 프로젝트가 선택되었습니다.')
      } else {
        // Load all data from folder into stores
        const { loadFromFolder } = useProjectStore.getState()
        await loadFromFolder(result.data, folderPath)
        toast.success('프로젝트를 불러왔습니다.')
      }
    } else if ('showDirectoryPicker' in window) {
      // Web: File System Access API
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        writer = createWebWriter(dirHandle)

        const result = await loadProjectFromFolder(writer)
        if (!result.success || !result.data) {
          toast.error(`프로젝트를 열 수 없습니다: ${result.error}`)
          return
        }

        // Store dirHandle for auto-save
        ;(window as any).__onionFlowDirHandle = dirHandle

        // Check if this project already exists locally
        const existingProject = projects.find(p => p.id === result.data!.project.id)
        if (existingProject) {
          // Update usesFolderStorage flag and select
          const { updateProject } = useProjectStore.getState()
          await updateProject(existingProject.id, { usesFolderStorage: true } as any)
          await selectProject(existingProject.id)
          toast.info('기존 프로젝트가 선택되었습니다.')
        } else {
          // Load all data from folder into stores
          const { loadFromFolder } = useProjectStore.getState()
          await loadFromFolder(result.data, undefined, true)
          toast.success('프로젝트를 불러왔습니다.')
        }
      } catch {
        // User cancelled
        return
      }
    } else {
      toast.warning('이 브라우저에서는 폴더 열기를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.')
      return
    }

    onClose()
  }

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId)
    onClose()
  }

  const truncatePath = (p: string, maxLen = 40) => {
    if (p.length <= maxLen) return p
    return '...' + p.slice(p.length - maxLen)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface border border-border rounded-xl shadow-2xl w-[480px] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-text-primary">
            {mode === 'create' ? '새 프로젝트 생성' : '프로젝트 관리'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'main' && (
          <div className="p-5 space-y-4">
            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('create')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition"
              >
                <Plus className="w-4 h-4" />
                새 프로젝트
              </button>

              <button
                onClick={handleOpenFolder}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bg-hover border border-border text-text-primary text-xs font-semibold hover:bg-bg-secondary transition"
              >
                <FolderOpen className="w-4 h-4" />
                폴더 열기
              </button>
            </div>

            {/* Recent projects */}
            {projects.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">최근 프로젝트</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover transition text-left"
                    >
                      <Folder className="w-4 h-4 text-text-muted shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-text-primary truncate">
                          {p.title}
                        </div>
                        {p.folderPath && (
                          <div className="text-[10px] text-text-muted truncate">
                            {truncatePath(p.folderPath)}
                          </div>
                        )}
                        {!p.folderPath && p.usesFolderStorage && (
                          <div className="text-[10px] text-text-muted truncate">
                            폴더 저장 (재선택 필요)
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {formatDateUTC(p.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                프로젝트 이름
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="나의 소설"
                className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                저장 위치 <span className="text-text-muted font-normal">(선택사항)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-muted text-xs truncate min-h-[36px] flex items-center">
                  {selectedFolderPath
                    ? <span className="text-text-primary">{truncatePath(selectedFolderPath, 50)}</span>
                    : <span>폴더를 선택하세요...</span>
                  }
                </div>
                <button
                  onClick={handleSelectFolder}
                  className="shrink-0 px-3 py-2 rounded-lg bg-bg-hover border border-border text-text-primary text-xs font-medium hover:bg-bg-secondary transition"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              {selectedFolderPath && newTitle.trim() && (
                <p className="text-[10px] text-text-muted mt-1">
                  → {selectedFolderPath}/{newTitle.trim()}
                </p>
              )}
              {!selectedFolderPath && (
                <p className="text-[10px] text-text-muted mt-1">
                  미선택 시 브라우저 내장 저장소(IndexedDB)에만 저장됩니다.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('main')}
                className="flex-1 px-4 py-2 rounded-lg bg-bg-hover border border-border text-text-primary text-xs font-medium hover:bg-bg-secondary transition"
              >
                뒤로
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition"
              >
                생성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
