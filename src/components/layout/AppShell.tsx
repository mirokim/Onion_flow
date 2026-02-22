import { Fragment, useCallback, useState } from 'react'
import { useEditorStore, type PanelTab } from '@/stores/editorStore'
import { useTranslation } from 'react-i18next'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import { BottomBar } from './BottomBar'
import { DepthBreadcrumb } from './DepthBreadcrumb'
import { ResizeHandle } from '@/components/ui/ResizeHandle'
import { NodeCanvas } from '@/components/canvas/NodeCanvas'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { WikiPanel } from '@/components/wiki/WikiPanel'
import { StatsPopup } from '@/components/stats/StatsPopup'
import { ExportPopup } from '@/components/stats/ExportPopup'
import { TimelinePanel } from '@/components/version/TimelinePanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ProjectDialog } from '@/components/common/ProjectDialog'
import { SettingsDialog } from '@/components/common/SettingsDialog'
import { cn } from '@/lib/utils'

const MIN_LEFT_WIDTH = 280
const MAX_LEFT_WIDTH = 900
const MIN_RIGHT_WIDTH = 200
const MAX_RIGHT_WIDTH = 600

function PanelContent({ tab }: { tab: PanelTab }) {
  switch (tab) {
    case 'canvas':
      return (
        <>
          <DepthBreadcrumb />
          <div className="flex-1 overflow-hidden">
            <NodeCanvas />
          </div>
        </>
      )
    case 'editor':
      return <BlockEditor />
    case 'wiki':
      return <WikiPanel />
  }
}

export function AppShell() {
  const { t } = useTranslation()
  const {
    focusMode,
    openTabs,
    canvasWidth,
    wikiWidth,
    setCanvasWidth,
    setWikiWidth,
  } = useEditorStore()

  const [showStats, setShowStats] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleStats: () => setShowStats(prev => !prev),
    onToggleTimeline: () => setShowTimeline(prev => !prev),
  })

  // canvasWidth → first panel, wikiWidth → last panel
  const handleLeftResize = useCallback((delta: number) => {
    setCanvasWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, canvasWidth + delta)))
  }, [canvasWidth, setCanvasWidth])

  const handleRightResize = useCallback((delta: number) => {
    setWikiWidth(Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, wikiWidth - delta)))
  }, [wikiWidth, setWikiWidth])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-primary text-text-primary">
      <TopBar
        onToggleStats={() => setShowStats(true)}
        onToggleTimeline={() => setShowTimeline(true)}
        onToggleExport={() => setShowExport(true)}
        onOpenProjectDialog={() => setShowProjectDialog(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Vertical TabBar: hidden in focus mode */}
        {!focusMode && <TabBar />}

        {/* Focus mode: only editor */}
        {focusMode && (
          <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary max-w-4xl mx-auto">
            <BlockEditor />
          </div>
        )}

        {/* Dynamic panel layout based on openTabs order */}
        {!focusMode && openTabs.map((tab, index) => {
          const total = openTabs.length
          const isSolo = total === 1
          const isFirst = index === 0
          const isLast = index === total - 1

          // Width logic:
          // - Solo panel: flex-1
          // - 2 panels: first = canvasWidth, second = flex-1
          // - 3 panels: first = canvasWidth, middle = flex-1, last = wikiWidth
          let style: React.CSSProperties
          if (isSolo) {
            style = { flex: 1 }
          } else if (total === 2) {
            style = isFirst ? { width: canvasWidth } : { flex: 1 }
          } else {
            // 3 panels
            style = isFirst
              ? { width: canvasWidth }
              : isLast
                ? { width: wikiWidth }
                : { flex: 1 }
          }

          const borderClass = cn(
            'flex flex-col shrink-0 overflow-hidden bg-bg-primary',
            !isSolo && isFirst && 'border-r border-border',
            !isSolo && isLast && 'border-l border-border',
          )

          return (
            <Fragment key={tab}>
              {/* Resize handle between panels */}
              {index === 1 && total >= 2 && (
                <ResizeHandle side="right" onResize={handleLeftResize} />
              )}
              {index === 2 && total === 3 && (
                <ResizeHandle side="left" onResize={handleRightResize} />
              )}

              <div className={borderClass} style={style}>
                <PanelContent tab={tab} />
              </div>
            </Fragment>
          )
        })}
      </div>

      <BottomBar />

      {/* Popups / Panels */}
      {showStats && <StatsPopup onClose={() => setShowStats(false)} />}
      {showTimeline && <TimelinePanel onClose={() => setShowTimeline(false)} />}
      {showExport && <ExportPopup onClose={() => setShowExport(false)} />}
      <ProjectDialog open={showProjectDialog} onClose={() => setShowProjectDialog(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
