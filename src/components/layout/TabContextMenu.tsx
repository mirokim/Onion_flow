/**
 * TabContextMenu — Right-click context menu for panel/inner tabs.
 * Shows pin, rename, duplicate, close actions depending on tab type.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pin, Pencil, CopyPlus, X, LayoutGrid, AlignLeft } from 'lucide-react'

interface TabContextMenuProps {
  position: { x: number; y: number }
  isPinned: boolean
  canRename: boolean
  canDuplicate: boolean
  canClose: boolean
  onClose: () => void
  onTogglePin: () => void
  onRenameTab?: () => void
  onDuplicateTab?: () => void
  onCloseTab: () => void
  /** Canvas-only: current view mode */
  canvasViewMode?: 'graph' | 'document'
  /** Canvas-only: called when user selects a view mode */
  onCanvasViewModeChange?: (mode: 'graph' | 'document') => void
}

export function TabContextMenu({
  position,
  isPinned,
  canRename,
  canDuplicate,
  canClose,
  onClose,
  onTogglePin,
  onRenameTab,
  onDuplicateTab,
  onCloseTab,
  canvasViewMode,
  onCanvasViewModeChange,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const menuW = 176, menuH = canvasViewMode !== undefined ? 220 : 160
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    left: position.x + menuW > window.innerWidth ? position.x - menuW : position.x,
    top: position.y + menuH > window.innerHeight ? position.y - menuH : position.y,
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={menuRef}
        style={style}
        className="bg-bg-surface border border-border rounded-lg shadow-xl py-1 w-44 text-xs"
      >
        {/* Pin / Unpin */}
        <button
          onClick={() => { onTogglePin(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Pin className="w-3.5 h-3.5" />
          {isPinned ? '탭 고정 해제' : '탭 고정'}
        </button>

        {(canRename || canDuplicate) && <div className="h-px bg-border mx-2 my-0.5" />}

        {/* Rename */}
        {canRename && onRenameTab && (
          <button
            onClick={() => { onRenameTab(); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
          >
            <Pencil className="w-3.5 h-3.5" />
            이름변경
          </button>
        )}

        {/* Duplicate */}
        {canDuplicate && onDuplicateTab && (
          <button
            onClick={() => { onDuplicateTab(); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            탭 복제
          </button>
        )}

        {/* Canvas view mode */}
        {canvasViewMode !== undefined && onCanvasViewModeChange && (
          <>
            <div className="h-px bg-border mx-2 my-0.5" />
            <button
              onClick={() => { onCanvasViewModeChange('graph'); onClose() }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${
                canvasViewMode === 'graph'
                  ? 'text-accent font-medium bg-accent/5'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              노드뷰
              {canvasViewMode === 'graph' && <span className="ml-auto text-[10px] opacity-60">●</span>}
            </button>
            <button
              onClick={() => { onCanvasViewModeChange('document'); onClose() }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${
                canvasViewMode === 'document'
                  ? 'text-accent font-medium bg-accent/5'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              문서 뷰
              {canvasViewMode === 'document' && <span className="ml-auto text-[10px] opacity-60">●</span>}
            </button>
          </>
        )}

        <div className="h-px bg-border mx-2 my-0.5" />

        {/* Close */}
        <button
          onClick={() => { if (canClose) { onCloseTab(); onClose() } }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${
            canClose
              ? 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              : 'text-text-muted/40 cursor-not-allowed'
          }`}
          disabled={!canClose}
        >
          <X className="w-3.5 h-3.5" />
          탭 닫기
        </button>
      </div>
    </>,
    document.body,
  )
}
