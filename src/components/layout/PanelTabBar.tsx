/**
 * PanelTabBar — Horizontal tab bar for multi-tab panels (Obsidian-style).
 * Placed at the top of editor/canvas panels.
 * Supports two drag levels:
 *   1. Inner tab drag (reorder tabs within the panel)
 *   2. Panel-level drag (reorder panels in the layout) — via panelDragHandlers
 */
import { useState, useRef, Fragment } from 'react'
import { X, Plus, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PanelTab } from '@/stores/editorStore'
import { TabContextMenu } from './TabContextMenu'

export interface PanelDragHandlers {
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

interface Tab {
  id: string
  label: string
  isPinned?: boolean
}

interface PanelTabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onAdd?: () => void
  canClose?: boolean
  /** Called when an inner tab is dragged and dropped onto another tab to reorder */
  onReorder?: (fromId: string, toId: string) => void
  /** Toggle pin state on a tab */
  onTogglePin?: (tabId: string) => void
  /** When provided, the tab bar background becomes draggable for panel-level reorder */
  panelDragHandlers?: PanelDragHandlers
  /** Optional right-side action buttons (e.g. add wiki entry, template picker) */
  actions?: React.ReactNode
  /** Hide the grip handle (e.g. when panel is in a group and group tab bar handles dragging) */
  hideGripHandle?: boolean
  /** Panel type — used to determine which context menu items to show */
  panelType?: PanelTab
  /** Rename a tab (canvas/editor inner tabs only) */
  onRenameTab?: (tabId: string) => void
  /** Duplicate a tab */
  onDuplicateTab?: (tabId: string) => void
}

export function PanelTabBar({ tabs, activeTabId, onSelect, onClose, onAdd, canClose = true, onReorder, onTogglePin, panelDragHandlers, actions, hideGripHandle, panelType, onRenameTab, onDuplicateTab }: PanelTabBarProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragItem = useRef<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)

  // Decide whether each tab's drag triggers inner reorder or panel-level drag
  const hasMultipleTabs = tabs.length > 1 && !!onReorder

  if (tabs.length === 0 && !onAdd) return null

  const ctxTab = ctxMenu ? tabs.find(t => t.id === ctxMenu.tabId) : null
  const canRename = !!onRenameTab && (panelType === 'canvas' || panelType === 'editor')
  const canDuplicate = !!onDuplicateTab && panelType !== 'ai'

  return (
    <div
      className={cn(
        "flex items-center bg-bg-secondary border-b border-border shrink-0 overflow-x-auto h-8",
        panelDragHandlers && !hideGripHandle && 'cursor-grab active:cursor-grabbing',
      )}
      draggable={!!panelDragHandlers && !hideGripHandle}
      onDragStart={(e) => {
        // Background area drag → panel-level drag
        if (panelDragHandlers) panelDragHandlers.onDragStart(e)
      }}
      onDragEnd={() => panelDragHandlers?.onDragEnd()}
    >
      {tabs.map((tab, idx) => {
        const pinned = !!tab.isPinned
        // Show divider between pinned and unpinned sections
        const showDivider = onTogglePin && pinned && idx < tabs.length - 1 && !tabs[idx + 1]?.isPinned

        return (
          <Fragment key={tab.id}>
            <div
              draggable
              onDragStart={(e) => {
                if (hasMultipleTabs) {
                  // Inner tab reorder — stop bubbling to panel drag
                  e.stopPropagation()
                  dragItem.current = tab.id
                } else if (panelDragHandlers && !hideGripHandle) {
                  // Single tab → trigger panel-level drag from the tab title
                  e.stopPropagation()
                  panelDragHandlers.onDragStart(e)
                }
              }}
              onDragOver={(e) => { e.preventDefault(); if (hasMultipleTabs) setDragOverId(tab.id) }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={() => {
                const fromId = dragItem.current
                const toId = tab.id
                setDragOverId(null)
                dragItem.current = null
                if (fromId && toId && fromId !== toId && onReorder) {
                  onReorder(fromId, toId)
                }
              }}
              onDragEnd={() => {
                setDragOverId(null)
                dragItem.current = null
                panelDragHandlers?.onDragEnd()
              }}
              onMouseDown={(e) => {
                // Middle-click to close (skip pinned)
                if (e.button === 1 && canClose && !pinned) {
                  e.preventDefault()
                  onClose(tab.id)
                }
              }}
              onContextMenu={(e) => {
                if (!panelType) return
                e.preventDefault()
                e.stopPropagation()
                setCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              className={cn(
                'group relative flex items-center gap-1 h-full cursor-pointer select-none text-xs transition-colors shrink-0 max-w-[160px]',
                pinned ? 'px-2' : 'px-3',
                tab.id === activeTabId
                  ? 'text-text-primary border-b-2 border-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
                dragOverId === tab.id && 'bg-accent/10',
              )}
              onClick={() => onSelect(tab.id)}
            >
              {/* Pin icon for pinned tabs */}
              {pinned && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.(tab.id) }}
                  className="shrink-0 text-text-muted transition p-0.5 rounded hover:bg-bg-hover"
                  title="탭 고정 해제"
                >
                  <Pin className="w-3 h-3" />
                </button>
              )}
              <span className="truncate">{tab.label}</span>
              {/* Unpinned tabs: show pin + close on hover */}
              {!pinned && canClose && (
                <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition">
                  {onTogglePin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(tab.id) }}
                      className="text-text-muted hover:text-text-primary transition p-0.5 rounded hover:bg-bg-hover"
                      title="탭 고정"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
                    className="text-text-muted hover:text-text-primary transition p-0.5 rounded hover:bg-bg-hover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {showDivider && (
              <div className="w-px h-4 bg-border shrink-0 my-auto" />
            )}
          </Fragment>
        )
      })}

      {/* Add tab button */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-7 h-full text-text-muted hover:text-text-primary hover:bg-bg-hover transition shrink-0"
          title="탭 추가"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Panel-level action buttons (right side) */}
      {actions && (
        <div className="ml-auto flex items-center gap-1 shrink-0 pr-1">
          {actions}
        </div>
      )}

      {/* Tab context menu */}
      {ctxMenu && ctxTab && (
        <TabContextMenu
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          isPinned={!!ctxTab.isPinned}
          canRename={canRename}
          canDuplicate={canDuplicate}
          canClose={canClose && !ctxTab.isPinned}
          onClose={() => setCtxMenu(null)}
          onTogglePin={() => onTogglePin?.(ctxMenu.tabId)}
          onRenameTab={canRename ? () => onRenameTab?.(ctxMenu.tabId) : undefined}
          onDuplicateTab={canDuplicate ? () => onDuplicateTab?.(ctxMenu.tabId) : undefined}
          onCloseTab={() => onClose(ctxMenu.tabId)}
        />
      )}
    </div>
  )
}
