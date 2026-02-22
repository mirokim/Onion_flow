/**
 * ProjectDialog - Project management dialog.
 * Create new project (with folder selection), open existing project folder,
 * and view recent projects.
 */
import { useState } from 'react'
import { FolderOpen, Plus, X, Folder } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { loadProjectFromFolder } from '@/db/projectSerializer'
import { toast } from './Toast'
import { cn } from '@/lib/utils'

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
    if (!api) return
    const folder = await api.selectFolder()
    if (folder) setSelectedFolderPath(folder)
  }

  const handleCreateProject = async () => {
    if (!newTitle.trim()) {
      toast.warning('프로젝트 이름을 입력하세요.')
      return
    }

    // Use local variable to avoid race condition with async setState
    let folderPath = selectedFolderPath
    if (api && !folderPath) {
      folderPath = await api.selectFolder()
      if (!folderPath) return // User cancelled
      setSelectedFolderPath(folderPath)
    }

    const project = await createProject(newTitle.trim())

    // Update project with folder path if Electron
    if (folderPath && api) {
      const projectFolderPath = `${folderPath}/${newTitle.trim()}`
      await api.createFolder(projectFolderPath)

      // Store the folder path
      const { updateProject } = useProjectStore.getState()
      await updateProject(project.id, { folderPath: projectFolderPath } as any)

      toast.success(`프로젝트가 ${projectFolderPath}에 생성되었습니다.`)
    }

    setNewTitle('')
    setSelectedFolderPath(null)
    setMode('main')
    onClose()
  }

  const handleOpenFolder = async () => {
    if (!api) {
      toast.warning('폴더 열기는 데스크톱 앱에서만 가능합니다.')
      return
    }

    const folderPath = await api.selectFolder()
    if (!folderPath) return

    const result = await loadProjectFromFolder(folderPath)
    if (!result.success || !result.project) {
      toast.error(`프로젝트를 열 수 없습니다: ${result.error}`)
      return
    }

    // Check if this project already exists locally
    const existingProject = projects.find(p => p.id === result.project!.id)
    if (existingProject) {
      await selectProject(existingProject.id)
      toast.info('기존 프로젝트가 선택되었습니다.')
    } else {
      // Create new project from folder data
      const project = await createProject(result.project.title || 'Imported Project')
      const { updateProject } = useProjectStore.getState()
      await updateProject(project.id, { folderPath } as any)
      toast.success('프로젝트를 불러왔습니다.')
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

              {api && (
                <button
                  onClick={handleOpenFolder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bg-hover border border-border text-text-primary text-xs font-semibold hover:bg-bg-secondary transition"
                >
                  <FolderOpen className="w-4 h-4" />
                  폴더 열기
                </button>
              )}
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
                        {(p as any).folderPath && (
                          <div className="text-[10px] text-text-muted truncate">
                            {truncatePath((p as any).folderPath)}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
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

            {api && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  저장 위치
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
              </div>
            )}

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
