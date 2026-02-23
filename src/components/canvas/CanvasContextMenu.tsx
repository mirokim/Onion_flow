/**
 * CanvasContextMenu - Right-click context menu for the node canvas.
 * Supports: Add Node (by category), Add Group, Delete Node, Group management.
 */
import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, FolderPlus, FolderMinus, Group } from 'lucide-react'
import { NODE_REGISTRY, NODE_CATEGORY_COLORS, type NodeTypeDefinition } from '@nodes/index'
import type { CanvasNodeCategory } from '@/types'
import { cn } from '@/lib/utils'

interface ContextMenuPosition {
  x: number
  y: number
  canvasX: number
  canvasY: number
}

interface CanvasContextMenuProps {
  position: ContextMenuPosition | null
  targetNodeId: string | null
  targetNodeGroupId: string | null
  groupNodeIds: string[]
  initialSubmenu?: 'add-node' | null
  onAddNode: (def: NodeTypeDefinition, position: { x: number; y: number }) => void
  onAddGroup: (position: { x: number; y: number }) => void
  onDeleteNode: (nodeId: string) => void
  onAddToGroup: (nodeId: string, groupId: string) => void
  onRemoveFromGroup: (nodeId: string) => void
  onClose: () => void
}

const CATEGORIES: { key: CanvasNodeCategory; label: string; labelKo: string }[] = [
  { key: 'context', label: 'Context', labelKo: '컨텍스트' },
  { key: 'direction', label: 'Direction', labelKo: '디렉션' },
  { key: 'processing', label: 'Processing', labelKo: '프로세싱' },
  { key: 'special', label: 'Special', labelKo: '스페셜' },
  { key: 'detector', label: 'Detector', labelKo: '디텍터' },
  { key: 'output', label: 'Output', labelKo: '출력' },
  { key: 'plot', label: 'Plot', labelKo: '플롯' },
]

export function CanvasContextMenu({
  position,
  targetNodeId,
  targetNodeGroupId,
  groupNodeIds,
  initialSubmenu,
  onAddNode,
  onAddGroup,
  onDeleteNode,
  onAddToGroup,
  onRemoveFromGroup,
  onClose,
}: CanvasContextMenuProps) {
  const [submenu, setSubmenu] = useState<'add-node' | 'add-to-group' | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CanvasNodeCategory>('context')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!position) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose()
      }
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
  }, [position, onClose])

  // Reset submenu when position changes; use initialSubmenu if provided (e.g. double-click → add-node)
  useEffect(() => {
    setSubmenu(initialSubmenu ?? null)
    setSelectedCategory('context')
  }, [position, initialSubmenu])

  if (!position) return null

  const filteredNodes = NODE_REGISTRY.filter(n => n.category === selectedCategory)
  const canvasPos = { x: position.canvasX, y: position.canvasY }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-surface border border-border rounded-lg shadow-xl min-w-[200px] py-1 text-xs"
      style={{ left: position.x, top: position.y }}
    >
      {/* Main menu */}
      {!submenu && (
        <>
          {/* Context-specific: Node actions */}
          {targetNodeId && (
            <>
              <button
                onClick={() => { onDeleteNode(targetNodeId); onClose() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 text-red-400 transition text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>노드 삭제</span>
              </button>

              {/* Add to group */}
              {groupNodeIds.length > 0 && !targetNodeGroupId && (
                <button
                  onClick={() => setSubmenu('add-to-group')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>그룹에 추가</span>
                  <span className="ml-auto text-text-muted">{'>'}</span>
                </button>
              )}

              {/* Remove from group */}
              {targetNodeGroupId && (
                <button
                  onClick={() => { onRemoveFromGroup(targetNodeId); onClose() }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
                >
                  <FolderMinus className="w-3.5 h-3.5" />
                  <span>그룹에서 제거</span>
                </button>
              )}

              <div className="border-t border-border my-1" />
            </>
          )}

          {/* Add node */}
          <button
            onClick={() => setSubmenu('add-node')}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>노드 추가</span>
            <span className="ml-auto text-text-muted">{'>'}</span>
          </button>

          {/* Add group */}
          <button
            onClick={() => { onAddGroup(canvasPos); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
          >
            <Group className="w-3.5 h-3.5" />
            <span>그룹 추가</span>
          </button>
        </>
      )}

      {/* Submenu: Add Node */}
      {submenu === 'add-node' && (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
            <button
              onClick={() => setSubmenu(null)}
              className="text-text-muted hover:text-text-primary text-[10px]"
            >
              {'< '}뒤로
            </button>
            <span className="flex-1 text-center text-text-muted font-semibold">노드 추가</span>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap border-b border-border px-1 py-1 gap-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition',
                  selectedCategory === cat.key
                    ? 'text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
                )}
                style={selectedCategory === cat.key ? {
                  backgroundColor: NODE_CATEGORY_COLORS[cat.key],
                } : undefined}
              >
                {cat.labelKo}
              </button>
            ))}
          </div>

          {/* Node list */}
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filteredNodes.map(def => (
              <button
                key={def.type}
                onClick={() => { onAddNode(def, canvasPos); onClose() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: def.color }}
                />
                <div>
                  <div className="text-xs text-text-primary">{def.labelKo}</div>
                  <div className="text-[10px] text-text-muted">{def.label}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Submenu: Add to Group */}
      {submenu === 'add-to-group' && (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
            <button
              onClick={() => setSubmenu(null)}
              className="text-text-muted hover:text-text-primary text-[10px]"
            >
              {'< '}뒤로
            </button>
            <span className="flex-1 text-center text-text-muted font-semibold">그룹 선택</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {groupNodeIds.map(gId => (
              <button
                key={gId}
                onClick={() => {
                  if (targetNodeId) onAddToGroup(targetNodeId, gId)
                  onClose()
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: NODE_CATEGORY_COLORS.structure }}
                />
                <span className="text-xs text-text-primary">{gId.slice(0, 8)}...</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
