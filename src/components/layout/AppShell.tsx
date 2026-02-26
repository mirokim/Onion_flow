import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { useEditorStore, type PanelTab, type PanelGroup, minWidthForGroup } from '@/stores/editorStore'

/** Compute which group should be the flex group from raw panelGroups.
 *  The FIRST layout group is always flex — it fills the space between openfiles
 *  and any fixed-width panels on the right.  This way shrinking openfiles
 *  automatically widens the primary (leftmost) panel, and dragging the
 *  canvas/editor handle explicitly sets the right panel's fixed width. */
function computeFlexGroupId(groups: PanelGroup[]): string | null {
  const layout = groups
    .map(g => ({ ...g, tabs: g.tabs.filter(t => LAYOUT_PANELS.has(t)) }))
    .filter(g => g.tabs.length > 0)
  return layout[0]?.id ?? null
}
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
import { ChapterPanel } from '@/components/chapters/ChapterPanel'
import { AIPanel } from '@/components/ai/AIPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ProjectDialog } from '@/components/common/ProjectDialog'
import { SettingsDialog, type SettingsSection } from '@/components/common/SettingsDialog'
import { cn } from '@/lib/utils'

const MIN_OPENFILES_WIDTH = 144
const MAX_OPENFILES_WIDTH = 480

/** Panels that participate in the dynamic layout (excludes openfiles and chapters) */
const LAYOUT_PANELS = new Set<PanelTab>(['canvas', 'editor', 'ai'])

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
    openFilesWidth,
    setGroupWidth,
    setOpenFilesWidth,
    setActiveGroupTab,
    moveTabToGroup,
    mergeGroupInto,
    splitTabToNewGroup,
    reorderGroups,
    toggleTab,
    togglePanelPin,
  } = useEditorStore()

  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const showSettings = useEditorStore(s => s.settingsOpen)
  const settingsSection = useEditorStore(s => s.settingsSection) as SettingsSection
  const openSettings = useEditorStore(s => s.openSettings)
  const closeSettings = useEditorStore(s => s.closeSettings)

  // Group drag-to-reorder state
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  /** 'merge' = center drop, 'before' = left-edge split, 'after' = right-edge split */
  const [dragOverMode, setDragOverMode] = useState<'merge' | 'before' | 'after' | null>(null)
  const dragGroupRef = useRef<string | null>(null) // group being dragged
  const dragTabRef = useRef<PanelTab | null>(null) // individual tab being dragged (for cross-group)

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

  // Determine which group is the "flex" group (fills remaining space) — for rendering
  const flexGroupId = useMemo(() => computeFlexGroupId(panelGroups), [panelGroups])

  // Unified panel resize handler — reads fresh state to avoid stale closure issues
  const handlePanelResize = useCallback((leftGroupId: string, rightGroupId: string, delta: number) => {
    const { panelGroups: groups } = useEditorStore.getState()
    const currentFlexGroupId = computeFlexGroupId(groups)
    const leftGroup = groups.find(g => g.id === leftGroupId)
    const rightGroup = groups.find(g => g.id === rightGroupId)
    if (!leftGroup || !rightGroup) return

    if (leftGroupId === currentFlexGroupId) {
      // Left is flex: adjust right group (drag right = narrower)
      setGroupWidth(rightGroupId, rightGroup.width - delta)
    } else {
      // Left is fixed (or both fixed): adjust left group (drag right = wider)
      setGroupWidth(leftGroupId, leftGroup.width + delta)
    }
  }, [setGroupWidth])

  // Read openFilesWidth directly from store to avoid stale closure
  const handleOpenFilesResize = useCallback((delta: number) => {
    const { openFilesWidth: w } = useEditorStore.getState()
    setOpenFilesWidth(Math.min(MAX_OPENFILES_WIDTH, Math.max(MIN_OPENFILES_WIDTH, w + delta)))
  }, [setOpenFilesWidth])

  // ── Group-level drag (reorder groups / merge) ──
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    dragGroupRef.current = groupId
    dragTabRef.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-onion-panel', `group:${groupId}`)
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  // ── Tab-level drag (from PanelGroupTabBar, cross-group) ──
  const handleTabDragStart = (e: React.DragEvent, tab: PanelTab) => {
    dragTabRef.current = tab
    dragGroupRef.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-onion-panel', `tab:${tab}`)
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

    // Determine mode based on mouse position within the panel
    // Left edge (≤15%) = insert before, right edge (≥85%) = insert after, center = merge
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const mode: 'merge' | 'before' | 'after' =
      relX <= 0.15 ? 'before' : relX >= 0.85 ? 'after' : 'merge'

    setDragOverGroupId(groupId)
    setDragOverMode(mode)
  }

  const handleGroupDrop = (e: React.DragEvent, dropGroupId: string) => {
    e.preventDefault()
    setDragOverGroupId(null)
    setDragOverMode(null)

    const draggedGroupId = dragGroupRef.current
    const draggedTab = dragTabRef.current

    // Compute mode from mouse position (avoid stale React state)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const shouldMerge = relX > 0.15 && relX < 0.85

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
        // Merge: move all tabs from dragged group into drop group (single state update)
        mergeGroupInto(draggedGroupId, dropGroupId)
      } else {
        // Reorder groups
        reorderGroups(draggedGroupId, dropGroupId)
      }
      dragGroupRef.current = null
    }
  }

  const handleDragEnd = () => {
    setDragOverGroupId(null)
    setDragOverMode(null)
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
            <div className="flex flex-col shrink-0 bg-bg-primary" style={{ width: openFilesWidth }}>
              <OpenFilesPanel />
            </div>
            <ResizeHandle onResize={handleOpenFilesResize} />
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
          const isFlexGroup = isSolo || group.id === flexGroupId

          const style: React.CSSProperties = isFlexGroup
            ? { flex: 1, minWidth: minWidthForGroup(group.tabs) }
            : { width: group.width }

          const isDragOver = dragOverGroupId === group.id

          const borderClass = cn(
            'flex flex-col overflow-hidden bg-bg-primary h-full min-h-0 relative',
            !isFlexGroup && 'shrink-0',
            isFlexGroup && 'shrink min-w-0',
          )

          return (
            <Fragment key={group.id}>
              {/* Resize handle between every adjacent pair */}
              {!isFirst && !isSolo && (
                <ResizeHandle
                  onResize={(delta) => handlePanelResize(layoutGroups[index - 1].id, group.id, delta)}
                />
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
                    setDragOverMode(null)
                  }
                }}
                onDrop={(e) => handleGroupDrop(e, group.id)}
              >
                {/* Drop indicator — merge: full panel overlay */}
                {isDragOver && dragOverMode === 'merge' && (
                  <div className="absolute inset-0 z-50 pointer-events-none bg-accent/15 border-2 border-accent rounded" />
                )}
                {/* Drop indicator — before: thick left-edge bar */}
                {isDragOver && dragOverMode === 'before' && (
                  <div className="absolute inset-y-0 left-0 w-[3px] z-50 pointer-events-none bg-accent rounded-r-full shadow-[2px_0_8px_0px] shadow-accent/60" />
                )}
                {/* Drop indicator — after: thick right-edge bar */}
                {isDragOver && dragOverMode === 'after' && (
                  <div className="absolute inset-y-0 right-0 w-[3px] z-50 pointer-events-none bg-accent rounded-l-full shadow-[-2px_0_8px_0px] shadow-accent/60" />
                )}

                {/* Group tab bar (only when 2+ panels stacked) */}
                {isMultiTab && (
                  <PanelGroupTabBar
                    group={group}
                    onSelectTab={(tab) => setActiveGroupTab(group.id, tab)}
                    onCloseTab={(tab) => {
                      const insertIdx = panelGroups.findIndex(g => g.id === group.id) + 1
                      splitTabToNewGroup(tab, insertIdx)
                    }}
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
      <SettingsDialog open={showSettings} onClose={closeSettings} initialSection={settingsSection} />
    </div>
  )
}
