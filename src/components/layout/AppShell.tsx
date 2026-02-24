import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { useEditorStore, type PanelTab, type PanelGroup } from '@/stores/editorStore'
import { useTranslation } from 'react-i18next'
import type { PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { PanelGroupTabBar } from '@/components/layout/PanelGroupTabBar'
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
import { AIPanel } from '@/components/ai/AIPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ProjectDialog } from '@/components/common/ProjectDialog'
import { SettingsDialog, type SettingsSection } from '@/components/common/SettingsDialog'
import { cn } from '@/lib/utils'

const MIN_LEFT_WIDTH = 200
const MAX_LEFT_WIDTH = 1200
const MIN_RIGHT_WIDTH = 160
const MAX_RIGHT_WIDTH = 800
const MIN_OPENFILES_WIDTH = 120
const MAX_OPENFILES_WIDTH = 400

/** Panels that participate in the dynamic layout (excludes openfiles) */
const LAYOUT_PANELS = new Set<PanelTab>(['canvas', 'editor', 'wiki', 'chapters', 'ai'])

function PanelContent({ tab, panelDragHandlers, isGrouped }: {
  tab: PanelTab
  panelDragHandlers?: PanelDragHandlers
  isGrouped?: boolean
}) {
  switch (tab) {
    case 'canvas':
      return <MultiTabCanvas panelDragHandlers={panelDragHandlers} isGrouped={isGrouped} />
    case 'editor':
      return <MultiTabEditor panelDragHandlers={panelDragHandlers} isGrouped={isGrouped} />
    case 'wiki':
      return <WikiPanel panelDragHandlers={panelDragHandlers} isGrouped={isGrouped} />
    case 'chapters':
      return <ChapterPanel panelDragHandlers={panelDragHandlers} isGrouped={isGrouped} />
    case 'ai':
      return <AIPanel panelDragHandlers={panelDragHandlers} isGrouped={isGrouped} />
    default:
      return null
  }
}

export function AppShell() {
  const { t } = useTranslation()
  const {
    focusMode,
    showOpenFilesPanel,
    panelGroups,
    canvasWidth,
    wikiWidth,
    openFilesWidth,
    setCanvasWidth,
    setWikiWidth,
    setOpenFilesWidth,
    setActiveGroupTab,
    moveTabToGroup,
    splitTabToNewGroup,
    reorderGroups,
    toggleTab,
    togglePanelPin,
  } = useEditorStore()

  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')

  // Group drag-to-reorder state
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [dragOverMerge, setDragOverMerge] = useState(false) // true = merge, false = reorder
  const dragGroupRef = useRef<string | null>(null) // group being dragged
  const dragTabRef = useRef<PanelTab | null>(null) // individual tab being dragged (for cross-group)

  const openSettings = useCallback((section?: SettingsSection) => {
    if (section) setSettingsSection(section)
    setShowSettings(true)
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenSettings: openSettings,
  })

  // Filter groups to only layout panels
  const layoutGroups = useMemo(
    () => panelGroups
      .map(g => ({
        ...g,
        tabs: g.tabs.filter(t => LAYOUT_PANELS.has(t)),
      }))
      .filter(g => g.tabs.length > 0),
    [panelGroups],
  )

  // canvasWidth → first group, wikiWidth → last group
  const handleLeftResize = useCallback((delta: number) => {
    setCanvasWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, canvasWidth + delta)))
  }, [canvasWidth, setCanvasWidth])

  const handleRightResize = useCallback((delta: number) => {
    setWikiWidth(Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, wikiWidth - delta)))
  }, [wikiWidth, setWikiWidth])

  const handleOpenFilesResize = useCallback((delta: number) => {
    setOpenFilesWidth(Math.min(MAX_OPENFILES_WIDTH, Math.max(MIN_OPENFILES_WIDTH, openFilesWidth + delta)))
  }, [openFilesWidth, setOpenFilesWidth])

  // ── Group-level drag (reorder groups / merge) ──
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    dragGroupRef.current = groupId
    dragTabRef.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `group:${groupId}`)
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  // ── Tab-level drag (from PanelGroupTabBar, cross-group) ──
  const handleTabDragStart = (e: React.DragEvent, tab: PanelTab) => {
    dragTabRef.current = tab
    dragGroupRef.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `tab:${tab}`)
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    const draggedGroupId = dragGroupRef.current
    const draggedTab = dragTabRef.current
    if (!draggedGroupId && !draggedTab) return
    // Don't allow dropping group on itself
    if (draggedGroupId && draggedGroupId === groupId) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Determine merge vs split/reorder based on mouse position
    // Edge zone (8% each side) = split/reorder, center 84% = merge
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const isMerge = relX > 0.08 && relX < 0.92

    setDragOverGroupId(groupId)
    setDragOverMerge(isMerge)
  }

  const handleGroupDrop = (e: React.DragEvent, dropGroupId: string) => {
    e.preventDefault()
    setDragOverGroupId(null)
    setDragOverMerge(false)

    const draggedGroupId = dragGroupRef.current
    const draggedTab = dragTabRef.current

    // Compute merge vs split from mouse position (avoid stale React state)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const shouldMerge = relX > 0.08 && relX < 0.92

    if (draggedTab) {
      if (shouldMerge) {
        // Tab dragged to center → merge into target group
        moveTabToGroup(draggedTab, dropGroupId)
      } else {
        // Tab dragged to edge → split to a new group adjacent to the drop target
        // Use panelGroups (store) for index since splitTabToNewGroup operates on it
        const dropIdx = panelGroups.findIndex(g => g.id === dropGroupId)
        const insertIdx = relX <= 0.08 ? dropIdx : dropIdx + 1
        splitTabToNewGroup(draggedTab, insertIdx)
      }
      dragTabRef.current = null
      return
    }

    if (draggedGroupId && draggedGroupId !== dropGroupId) {
      if (shouldMerge) {
        // Merge: move all tabs from dragged group into drop group
        const sourceGroup = panelGroups.find(g => g.id === draggedGroupId)
        if (sourceGroup) {
          for (const tab of sourceGroup.tabs) {
            moveTabToGroup(tab, dropGroupId)
          }
        }
      } else {
        // Reorder groups
        reorderGroups(draggedGroupId, dropGroupId)
      }
      dragGroupRef.current = null
    }
  }

  const handleDragEnd = () => {
    setDragOverGroupId(null)
    setDragOverMerge(false)
    dragGroupRef.current = null
    dragTabRef.current = null
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-primary text-text-primary">
      <TopBar
        onOpenProjectDialog={() => setShowProjectDialog(true)}
        onOpenSettings={() => openSettings()}
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

        {/* Dynamic panel layout based on panelGroups */}
        {!focusMode && layoutGroups.map((group, index) => {
          const total = layoutGroups.length
          const isSolo = total === 1
          const isFirst = index === 0
          const isLast = index === total - 1
          const isMultiTab = group.tabs.length > 1

          let style: React.CSSProperties
          if (isSolo) {
            style = { flex: 1 }
          } else if (isFirst) {
            style = { width: canvasWidth }
          } else if (isLast && total >= 3) {
            style = { width: wikiWidth }
          } else {
            style = { flex: 1, minWidth: 200 }
          }

          const isDragOver = dragOverGroupId === group.id

          const borderClass = cn(
            'flex flex-col shrink-0 overflow-hidden bg-bg-primary h-full min-h-0 relative',
            !isSolo && !isFirst && 'border-l border-border',
          )

          return (
            <Fragment key={group.id}>
              {/* Resize handle between groups */}
              {index === 1 && total >= 2 && (
                <ResizeHandle side="right" onResize={handleLeftResize} />
              )}
              {isLast && total >= 3 && (
                <ResizeHandle side="left" onResize={handleRightResize} />
              )}

              <div
                className={borderClass}
                style={style}
                data-panel={group.activeTab}
                onDragOver={(e) => handleGroupDragOver(e, group.id)}
                onDragLeave={(e) => {
                  // Only clear if actually leaving this container (not entering a child)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverGroupId(null)
                    setDragOverMerge(false)
                  }
                }}
                onDrop={(e) => handleGroupDrop(e, group.id)}
              >
                {/* Drop indicator overlay */}
                {isDragOver && dragOverMerge && (
                  <div className="absolute inset-0 z-50 pointer-events-none rounded bg-accent/10 border-2 border-accent/50 border-dashed" />
                )}
                {isDragOver && !dragOverMerge && (
                  <div className="absolute inset-y-0 left-0 w-1 z-50 pointer-events-none bg-accent rounded-full" />
                )}

                {/* Group tab bar (only when 2+ panels stacked) */}
                {isMultiTab && (
                  <PanelGroupTabBar
                    group={group}
                    onSelectTab={(tab) => setActiveGroupTab(group.id, tab)}
                    onCloseTab={(tab) => splitTabToNewGroup(tab)}
                    groupDragHandlers={{
                      onDragStart: (e) => handleGroupDragStart(e, group.id),
                      onDragEnd: handleDragEnd,
                    }}
                    onTabDragStart={(e, tab) => handleTabDragStart(e, tab)}
                    onTabDragEnd={handleDragEnd}
                    onDuplicateTab={(tab) => splitTabToNewGroup(tab)}
                    onTogglePanelPin={(tab) => togglePanelPin(tab)}
                  />
                )}

                <PanelContent
                  tab={group.activeTab}
                  isGrouped={isMultiTab}
                  panelDragHandlers={isMultiTab ? undefined : {
                    onDragStart: (e) => handleGroupDragStart(e, group.id),
                    onDragEnd: handleDragEnd,
                  }}
                />
              </div>
            </Fragment>
          )
        })}
      </div>

      <BottomBar />

      {/* Dialogs */}
      <ProjectDialog open={showProjectDialog} onClose={() => setShowProjectDialog(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} initialSection={settingsSection} />
    </div>
  )
}
