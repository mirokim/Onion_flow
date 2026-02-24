import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  FolderOpen,
  Settings,
  Loader2,
  Check,
} from 'lucide-react'
import { useSaveStatusStore } from '@/stores/saveStatusStore'

function TopBarSaveStatus() {
  const status = useSaveStatusStore(s => s.status)
  if (status === 'idle') return null

  return (
    <div className="flex items-center gap-1 px-1" title={
      status === 'modified' ? '수정됨' : status === 'saving' ? '저장 중...' : '저장됨'
    }>
      {status === 'modified' && (
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
      )}
      {status === 'saving' && (
        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
      )}
      {status === 'saved' && (
        <Check className="w-3.5 h-3.5 text-green-500" />
      )}
    </div>
  )
}

interface TopBarProps {
  onOpenProjectDialog?: () => void
  onOpenSettings?: () => void
}

export function TopBar({ onOpenProjectDialog, onOpenSettings }: TopBarProps) {
  const { t } = useTranslation()
  const { currentProject, currentChapter } = useProjectStore()
  const { openTabs, toggleTab, toggleFocusMode, showOpenFilesPanel, toggleOpenFilesPanel } = useEditorStore()

  const wikiOpen = openTabs.includes('wiki')

  return (
    <header className="h-10 flex items-center justify-between px-3 border-b border-border bg-bg-secondary shrink-0 select-none">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleOpenFilesPanel}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={showOpenFilesPanel ? '파일 탭 숨기기' : '파일 탭 보이기'}
        >
          {showOpenFilesPanel
            ? <PanelLeftClose className="w-4 h-4" />
            : <PanelLeftOpen className="w-4 h-4" />
          }
        </button>

        <div className="h-4 w-px bg-border" />

        <img src="/onion.svg" alt="Onion Flow" className="w-5 h-5" />
        <span className="text-xs font-bold tracking-widest text-text-muted">ONION FLOW</span>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={onOpenProjectDialog}
          className="flex items-center gap-1 text-text-secondary text-sm hover:text-text-primary transition"
          title={currentProject?.folderPath || t('project.selectProject')}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="font-medium truncate max-w-[180px]">
            {currentProject?.title || t('project.selectProject')}
          </span>
          {currentProject?.folderPath && (
            <span className="text-[10px] text-text-muted truncate max-w-[120px] hidden sm:inline">
              ({currentProject.folderPath.split(/[/\\]/).slice(-2).join('/')})
            </span>
          )}
        </button>

        {currentChapter && (
          <>
            <span className="text-text-muted text-xs">/</span>
            <span className="text-text-muted text-xs truncate max-w-[180px]">
              {currentChapter.title}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <TopBarSaveStatus />

        <button
          onClick={onOpenSettings}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title="설정"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={toggleFocusMode}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={t('editor.focusMode')}
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => toggleTab('wiki')}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={wikiOpen ? t('layout.hideWiki') : t('layout.showWiki')}
        >
          {wikiOpen
            ? <PanelRightClose className="w-4 h-4" />
            : <PanelRightOpen className="w-4 h-4" />
          }
        </button>
      </div>
    </header>
  )
}
