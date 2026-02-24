/**
 * CanvasContextMenu - Right-click / double-click context menu for the node canvas.
 * Supports: Add Node (flat scroll with tag filters), Add Group, Delete Node, Group management.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, FolderPlus, FolderMinus, Group, Search } from 'lucide-react'
import { NODE_REGISTRY, NODE_CATEGORY_COLORS, NODE_TAG_LABELS, type NodeTypeDefinition } from '@nodes/index'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Reset state when position changes
  useEffect(() => {
    setSubmenu(initialSubmenu ?? null)
    setSearchQuery('')
    setActiveTags(new Set())
  }, [position, initialSubmenu])

  // Auto-focus search when add-node opens
  useEffect(() => {
    if (submenu === 'add-node') {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [submenu])

  // Collect all unique tags from registry (excluding 'group' type nodes)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const n of NODE_REGISTRY) {
      if (n.type === 'group') continue
      for (const t of n.tags) tagSet.add(t)
    }
    return Array.from(tagSet)
  }, [])

  // Filter nodes by search + tags
  const filteredNodes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return NODE_REGISTRY.filter(n => {
      // Exclude group — it has its own button
      if (n.type === 'group') return false
      // Tag filter: node must have ALL active tags
      if (activeTags.size > 0) {
        for (const tag of activeTags) {
          if (!n.tags.includes(tag)) return false
        }
      }
      // Search filter
      if (query) {
        return (
          n.label.toLowerCase().includes(query) ||
          n.labelKo.includes(query) ||
          n.type.toLowerCase().includes(query) ||
          n.tags.some(t => t.includes(query))
        )
      }
      return true
    })
  }, [searchQuery, activeTags])

  // Group filtered nodes by category for section headers
  const groupedNodes = useMemo(() => {
    const groups: { category: string; color: string; label: string; nodes: NodeTypeDefinition[] }[] = []
    const categoryOrder = ['context', 'direction', 'processing', 'special', 'detector', 'output', 'plot']
    const categoryLabels: Record<string, string> = {
      context: '컨텍스트',
      direction: '디렉션',
      processing: '프로세싱',
      special: '스페셜',
      detector: '디텍터',
      output: '출력',
      plot: '플롯 애드온',
    }

    for (const cat of categoryOrder) {
      const catNodes = filteredNodes.filter(n => n.category === cat)
      if (catNodes.length > 0) {
        groups.push({
          category: cat,
          color: NODE_CATEGORY_COLORS[cat as keyof typeof NODE_CATEGORY_COLORS] || '#999',
          label: categoryLabels[cat] || cat,
          nodes: catNodes,
        })
      }
    }
    return groups
  }, [filteredNodes])

  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  if (!position) return null

  const canvasPos = { x: position.canvasX, y: position.canvasY }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-surface border border-border rounded-lg shadow-xl min-w-[220px] py-1 text-xs"
      style={{ left: position.x, top: position.y }}
    >
      {/* ── Main menu ── */}
      {!submenu && (
        <>
          {targetNodeId && (
            <>
              <button
                onClick={() => { onDeleteNode(targetNodeId); onClose() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 text-red-400 transition text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>노드 삭제</span>
              </button>

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

          <button
            onClick={() => setSubmenu('add-node')}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>노드 추가</span>
            <span className="ml-auto text-text-muted">{'>'}</span>
          </button>

          <button
            onClick={() => { onAddGroup(canvasPos); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left text-text-primary"
          >
            <Group className="w-3.5 h-3.5" />
            <span>그룹 추가</span>
          </button>
        </>
      )}

      {/* ── Add Node: flat 1-depth with tag filters ── */}
      {submenu === 'add-node' && (
        <>
          {/* Header with back + search */}
          <div className="px-2 py-1.5 border-b border-border space-y-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSubmenu(null)}
                className="text-text-muted hover:text-text-primary text-[10px] shrink-0"
              >
                {'< '}뒤로
              </button>
              <span className="flex-1 text-center text-text-muted font-semibold text-[11px]">노드 추가</span>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="노드 검색..."
                className="w-full pl-6 pr-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary outline-none focus:border-accent placeholder:text-text-muted/50"
              />
            </div>

            {/* Tag chips */}
            <div className="flex flex-wrap gap-0.5">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-medium transition border',
                    activeTags.has(tag)
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'bg-bg-primary text-text-muted border-transparent hover:bg-bg-hover hover:text-text-secondary',
                  )}
                >
                  {NODE_TAG_LABELS[tag] || tag}
                </button>
              ))}
            </div>
          </div>

          {/* Flat scrollable node list grouped by category */}
          <div className="max-h-[420px] overflow-y-auto">
            {groupedNodes.length === 0 && (
              <div className="px-3 py-4 text-center text-text-muted text-[10px]">
                검색 결과가 없습니다
              </div>
            )}

            {groupedNodes.map(group => (
              <div key={group.category}>
                {/* Category section header */}
                <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1 bg-bg-secondary/95 backdrop-blur-sm border-b border-border/50">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                    {group.label}
                  </span>
                  <span className="text-[9px] text-text-muted/60">{group.nodes.length}</span>
                </div>

                {/* Nodes in this category */}
                {group.nodes.map(def => (
                  <button
                    key={def.type}
                    onClick={() => { onAddNode(def, canvasPos); onClose() }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left group/item"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: def.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text-primary truncate">{def.labelKo}</div>
                      <div className="text-[9px] text-text-muted truncate">{def.label}</div>
                    </div>
                    {/* Tag pills on hover */}
                    <div className="hidden group-hover/item:flex gap-0.5 shrink-0">
                      {def.tags.slice(0, 2).map(t => (
                        <span key={t} className="px-1 py-0 rounded text-[7px] bg-bg-active text-text-muted">
                          {NODE_TAG_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Add to Group submenu ── */}
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
          <div className="max-h-[400px] overflow-y-auto py-1">
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
