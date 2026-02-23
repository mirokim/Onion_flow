import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { useEditorStore, type PanelTab } from '@/stores/editorStore'
import { useTranslation } from 'react-i18next'
import type { PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import { BottomBar } from './BottomBar'
import { OpenFilesPanel } from '@/components/layout/OpenFilesPanel'
import { ResizeHandle } from '@/components/ui/ResizeHandle'
import { MultiTabCanvas } from '@/components/canvas/MultiTabCanvas'
import { MultiTabEditor } from '@/components/editor/MultiTabEditor'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { WikiPanel } from '@/components/wiki/WikiPanel'
import { ChapterPanel } from '@/components/chapters/ChapterPanel'
import { StatsPopup } from '@/components/stats/StatsPopup'
import { ExportPopup } from '@/components/stats/ExportPopup'
import { TimelinePanel } from '@/components/version/TimelinePanel'
import { AIPanel } from '@/components/ai/AIPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ProjectDialog } from '@/components/common/ProjectDialog'
import { SettingsDialog } from '@/components/common/SettingsDialog'
import { cn } from '@/lib/utils'

const MIN_LEFT_WIDTH = 200
const MAX_LEFT_WIDTH = 1200
const MIN_RIGHT_WIDTH = 160
const MAX_RIGHT_WIDTH = 800
const MIN_OPENFILES_WIDTH = 120
const MAX_OPENFILES_WIDTH = 400

/** Panels that participate in the dynamic layout (excludes openfiles) */
const LAYOUT_PANELS = new Set<PanelTab>(['canvas', 'editor', 'wiki', 'chapters', 'ai'])

function PanelContent({ tab, panelDragHandlers }: { tab: PanelTab; panelDragHandlers?: PanelDragHandlers }) {
  switch (tab) {
    case 'canvas':
      return <MultiTabCanvas panelDragHandlers={panelDragHandlers} />
    case 'editor':
      return <MultiTabEditor panelDragHandlers={panelDragHandlers} />
    case 'wiki':
      return <WikiPanel panelDragHandlers={panelDragHandlers} />
    case 'chapters':
      return <ChapterPanel panelDragHandlers={panelDragHandlers} />
    case 'ai':
      return <AIPanel panelDragHandlers={panelDragHandlers} />
    default:
      return null
  }
}

export function AppShell() {
  const { t } = useTranslation()
  const {
    focusMode,
    showOpenFilesPanel,
    openTabs,
    canvasWidth,
    wikiWidth,
    openFilesWidth,
    setCanvasWidth,
    setWikiWidth,
    setOpenFilesWidth,
    reorderTabs,
  } = useEditorStore()

  const [showStats, setShowStats] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Panel drag-to-reorder state
  const [dragOverTab, setDragOverTab] = useState<PanelTab | null>(null)
  const dragPanelRef = useRef<PanelTab | null>(null)

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleStats: () => setShowStats(prev => !prev),
    onToggleTimeline: () => setShowTimeline(prev => !prev),
  })

  // Filter to only layout panels
  const layoutTabs = useMemo(
    () => openTabs.filter(t => LAYOUT_PANELS.has(t)),
    [openTabs],
  )

  // canvasWidth → first panel, wikiWidth → last panel
  const handleLeftResize = useCallback((delta: number) => {
    setCanvasWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, canvasWidth + delta)))
  }, [canvasWidth, setCanvasWidth])

  const handleRightResize = useCallback((delta: number) => {
    setWikiWidth(Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, wikiWidth - delta)))
  }, [wikiWidth, setWikiWidth])

  const handleOpenFilesResize = useCallback((delta: number) => {
    setOpenFilesWidth(Math.min(MAX_OPENFILES_WIDTH, Math.max(MIN_OPENFILES_WIDTH, openFilesWidth + delta)))
  }, [openFilesWidth, setOpenFilesWidth])

  // Panel drag handlers
  const handlePanelDragStart = (e: React.DragEvent, tab: PanelTab) => {
    dragPanelRef.current = tab
    e.dataTransfer.effectAllowed = 'move'
    // Use a transparent drag image so it doesn't look heavy
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handlePanelDragOver = (e: React.DragEvent, tab: PanelTab) => {
    if (!dragPanelRef.current || dragPanelRef.current === tab) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTab(tab)
  }

  const handlePanelDrop = (e: React.DragEvent, dropTab: PanelTab) => {
    e.preventDefault()
    setDragOverTab(null)
    const dragged = dragPanelRef.current
    if (!dragged || dragged === dropTab) return

    const newTabs = [...openTabs]
    const fromIdx = newTabs.indexOf(dragged)
    const toIdx = newTabs.indexOf(dropTab)
    if (fromIdx < 0 || toIdx < 0) return

    newTabs.splice(fromIdx, 1)
    newTabs.splice(toIdx, 0, dragged)
    reorderTabs(newTabs)
    dragPanelRef.current = null
  }

  const handlePanelDragEnd = () => {
    setDragOverTab(null)
    dragPanelRef.current = null
  }

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

        {/* Fixed OpenFiles panel: toggleable via TopBar button, resizable */}
        {!focusMode && showOpenFilesPanel && (
          <>
            <div className="flex flex-col shrink-0 border-r border-border bg-bg-primary" style={{ width: openFilesWidth }}>
              <OpenFilesPanel />
            </div>
            <ResizeHandle side="right" onResize={handleOpenFilesResize} />
          </>
        )}

        {/* Focus mode: only editor */}
        {focusMode && (
          <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary max-w-4xl mx-auto">
            <BlockEditor />
          </div>
        )}

        {/* Dynamic panel layout based on openTabs order */}
        {!focusMode && layoutTabs.map((tab, index) => {
          const total = layoutTabs.length
          const isSolo = total === 1
          const isFirst = index === 0
          const isLast = index === total - 1

          let style: React.CSSProperties
          if (isSolo) {
            style = { flex: 1 }
          } else if (isFirst) {
            style = { width: canvasWidth }
          } else if (isLast) {
            style = { width: wikiWidth }
          } else {
            style = { flex: 1, minWidth: 200 }
          }

          const isDragOver = dragOverTab === tab

          const borderClass = cn(
            'flex flex-col shrink-0 overflow-hidden bg-bg-primary h-full min-h-0 relative',
            !isSolo && !isFirst && 'border-l border-border',
          )

          return (
            <Fragment key={tab}>
              {/* Resize handle between panels */}
              {index === 1 && total >= 2 && (
                <ResizeHandle side="right" onResize={handleLeftResize} />
              )}
              {isLast && total >= 3 && (
                <ResizeHandle side="left" onResize={handleRightResize} />
              )}

              <div
                className={borderClass}
                style={style}
                onDragOver={(e) => handlePanelDragOver(e, tab)}
                onDragLeave={() => setDragOverTab(null)}
                onDrop={(e) => handlePanelDrop(e, tab)}
              >
                {/* Drop indicator overlay */}
                {isDragOver && (
                  <div className="absolute inset-0 bg-accent/5 border-2 border-accent/30 border-dashed rounded z-50 pointer-events-none" />
                )}

                <PanelContent
                  tab={tab}
                  panelDragHandlers={{
                    onDragStart: (e) => handlePanelDragStart(e, tab),
                    onDragEnd: handlePanelDragEnd,
                  }}
                />
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
