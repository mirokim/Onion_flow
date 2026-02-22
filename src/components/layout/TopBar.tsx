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
  BarChart3,
  History,
  Download,
  Settings,
} from 'lucide-react'

interface TopBarProps {
  onToggleStats?: () => void
  onToggleTimeline?: () => void
  onToggleExport?: () => void
  onOpenProjectDialog?: () => void
  onOpenSettings?: () => void
}

export function TopBar({ onToggleStats, onToggleTimeline, onToggleExport, onOpenProjectDialog, onOpenSettings }: TopBarProps) {
  const { t } = useTranslation()
  const { currentProject, currentChapter } = useProjectStore()
  const { openTabs, toggleTab, toggleFocusMode } = useEditorStore()

  const canvasOpen = openTabs.includes('canvas')
  const wikiOpen = openTabs.includes('wiki')

  return (
    <header className="h-10 flex items-center justify-between px-3 border-b border-border bg-bg-secondary shrink-0 select-none">
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleTab('canvas')}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={canvasOpen ? t('layout.hideCanvas') : t('layout.showCanvas')}
        >
          {canvasOpen
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
        <button
          onClick={onToggleStats}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={`${t('stats.title')} (Ctrl+Shift+S)`}
        >
          <BarChart3 className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleTimeline}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title={`타임라인 (Ctrl+Shift+T)`}
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleExport}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          title="내보내기"
        >
          <Download className="w-4 h-4" />
        </button>

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
