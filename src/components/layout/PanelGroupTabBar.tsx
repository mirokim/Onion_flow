/**
 * PanelGroupTabBar — Tab bar shown when multiple panels share one column (stacked).
 * Displays panel icons + names. Click to switch, drag to move, X to split out.
 * Styled identically to PanelTabBar for visual consistency.
 */
import { useState, useRef } from 'react'
import { X, LayoutGrid, FileText, BookOpen, Library, MessageSquare } from 'lucide-react'
import { useEditorStore, type PanelTab, type PanelGroup } from '@/stores/editorStore'
import { cn } from '@/lib/utils'
import { TabContextMenu } from './TabContextMenu'

const PANEL_META: Record<PanelTab, { label: string; icon: typeof LayoutGrid }> = {
  canvas: { label: 'Canvas', icon: LayoutGrid },
  editor: { label: 'Editor', icon: FileText },
  wiki: { label: 'Wiki', icon: BookOpen },
  chapters: { label: '챕터', icon: Library },
  ai: { label: 'AI', icon: MessageSquare },
  openfiles: { label: 'Files', icon: FileText }, // not used in groups but needed for type
}

/** Get dynamic label for canvas/editor (active inner tab name), static for others */
function usePanelLabel(tab: PanelTab): string {
  const canvasTabs = useEditorStore(s => s.canvasTabs)
  const activeCanvasTabId = useEditorStore(s => s.activeCanvasTabId)
  const editorTabs = useEditorStore(s => s.editorTabs)
  const activeEditorTabId = useEditorStore(s => s.activeEditorTabId)

  if (tab === 'canvas') {
    const active = canvasTabs.find(t => t.id === activeCanvasTabId)
    return active?.label || PANEL_META.canvas.label
  }
  if (tab === 'editor') {
    const active = editorTabs.find(t => t.id === activeEditorTabId)
    return active?.label || PANEL_META.editor.label
  }
  return PANEL_META[tab]?.label || tab
}

interface PanelGroupTabBarProps {
  group: PanelGroup
  onSelectTab: (tab: PanelTab) => void
  onCloseTab: (tab: PanelTab) => void
  /** Drag handlers for the entire group (column reorder) */
  groupDragHandlers: {
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
  /** Called when a tab is dragged OUT of this group (cross-group drag) */
  onTabDragStart?: (e: React.DragEvent, tab: PanelTab) => void
  onTabDragEnd?: () => void
  /** Called when user duplicates a panel tab via context menu */
  onDuplicateTab?: (tab: PanelTab) => void
  /** Called when user toggles pin on a panel tab via context menu */
  onTogglePanelPin?: (tab: PanelTab) => void
}

/** Single tab item in the group bar — extracted so usePanelLabel hook can be called per-tab */
function GroupTab({
  tab,
  isActive,
  isDragOver,
  canClose,
  onSelect,
  onClose,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onContextMenu,
}: {
  tab: PanelTab
  isActive: boolean
  isDragOver: boolean
  canClose: boolean
  onSelect: () => void
  onClose: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onDragEnd: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const meta = PANEL_META[tab]
  if (!meta) return null
  const Icon = meta.icon
  const label = usePanelLabel(tab)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative flex items-center gap-1.5 h-full cursor-grab active:cursor-grabbing select-none text-xs px-3 transition-colors shrink-0 max-w-[160px]',
        isActive
          ? 'text-text-primary border-b-2 border-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
        isDragOver && 'bg-accent/10',
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {/* Close (split out) button — only show when >1 tab */}
      {canClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition p-0.5 rounded hover:bg-bg-hover"
          title="패널 분리"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

export function PanelGroupTabBar({
  group,
  onSelectTab,
  onCloseTab,
  groupDragHandlers,
  onTabDragStart,
  onTabDragEnd,
  onDuplicateTab,
  onTogglePanelPin,
}: PanelGroupTabBarProps) {
  const [dragOverTab, setDragOverTab] = useState<PanelTab | null>(null)
  const dragItem = useRef<PanelTab | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: PanelTab } | null>(null)

  const pinnedPanels = useEditorStore(s => s.pinnedPanels)

  const ctxPinned = ctxMenu ? pinnedPanels.includes(ctxMenu.tab) : false
  const ctxCanDuplicate = ctxMenu ? ctxMenu.tab !== 'ai' : false

  return (
    <div
      className="flex items-center bg-bg-secondary border-b border-border shrink-0 h-8 overflow-x-auto cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => groupDragHandlers.onDragStart(e)}
      onDragEnd={() => groupDragHandlers.onDragEnd()}
    >
      {group.tabs.map((tab) => (
        <GroupTab
          key={tab}
          tab={tab}
          isActive={tab === group.activeTab}
          isDragOver={dragOverTab === tab}
          canClose={group.tabs.length > 1}
          onSelect={() => onSelectTab(tab)}
          onClose={() => onCloseTab(tab)}
          onDragStart={(e) => {
            e.stopPropagation()
            dragItem.current = tab
            onTabDragStart?.(e, tab)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverTab(tab)
          }}
          onDragLeave={() => setDragOverTab(null)}
          onDrop={() => {
            setDragOverTab(null)
            dragItem.current = null
          }}
          onDragEnd={() => {
            setDragOverTab(null)
            dragItem.current = null
            onTabDragEnd?.()
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setCtxMenu({ x: e.clientX, y: e.clientY, tab })
          }}
        />
      ))}

      {/* Tab context menu */}
      {ctxMenu && (
        <TabContextMenu
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          isPinned={ctxPinned}
          canRename={false}
          canDuplicate={ctxCanDuplicate && !!onDuplicateTab}
          canClose={group.tabs.length > 1}
          onClose={() => setCtxMenu(null)}
          onTogglePin={() => onTogglePanelPin?.(ctxMenu.tab)}
          onDuplicateTab={ctxCanDuplicate ? () => onDuplicateTab?.(ctxMenu.tab) : undefined}
          onCloseTab={() => onCloseTab(ctxMenu.tab)}
        />
      )}
    </div>
  )
}
