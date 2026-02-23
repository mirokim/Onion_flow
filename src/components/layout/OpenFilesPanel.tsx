/**
 * OpenFilesPanel — File explorer with virtual folder structure.
 * Toolbar with creation/sort/expand actions + recursive tree view.
 */
import { useState, useEffect, useMemo } from 'react'
import { useEditorStore, type FileTreeNode } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  Folder, FolderOpen, FolderPlus, LayoutGrid, FileText, Plus,
  ArrowDownAZ, ArrowDownWideNarrow, ChevronsUpDown, ChevronsDownUp,
  ChevronRight, ChevronDown, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── helpers ── */

function sortNodeIds(
  ids: string[],
  nodes: Record<string, FileTreeNode>,
  sortBy: 'name' | 'date',
): string[] {
  return [...ids]
    .map(id => nodes[id])
    .filter(Boolean)
    .sort((a, b) => {
      // folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1
      return sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : a.createdAt - b.createdAt
    })
    .map(n => n.id)
}

/* ── FileTreeNodeComponent ── */

function FileTreeNodeComponent({
  nodeId,
  depth,
  activeCanvasTabId,
  activeEditorTabId,
  openCanvasTabIds,
  openEditorTargetIds,
  sortBy,
}: {
  nodeId: string
  depth: number
  activeCanvasTabId: string | null
  activeEditorTabId: string | null
  openCanvasTabIds: Set<string>
  openEditorTargetIds: Set<string>
  sortBy: 'name' | 'date'
}) {
  const node = useEditorStore(s => s.fileTreeNodes[nodeId])
  const fileTreeNodes = useEditorStore(s => s.fileTreeNodes)
  const toggleFileTreeNodeExpanded = useEditorStore(s => s.toggleFileTreeNodeExpanded)
  const moveFileTreeNode = useEditorStore(s => s.moveFileTreeNode)
  const renameFileTreeNode = useEditorStore(s => s.renameFileTreeNode)
  const removeFileTreeNode = useEditorStore(s => s.removeFileTreeNode)
  const setActiveCanvasTab = useEditorStore(s => s.setActiveCanvasTab)
  const setActiveEditorTab = useEditorStore(s => s.setActiveEditorTab)
  const openTabs = useEditorStore(s => s.openTabs)
  const toggleTab = useEditorStore(s => s.toggleTab)
  const editorTabs = useEditorStore(s => s.editorTabs)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [dragOverState, setDragOverState] = useState<'above' | 'inside' | 'below' | null>(null)

  if (!node) return null

  const isTargetOpen = node.type === 'canvas'
    ? openCanvasTabIds.has(node.targetId!)
    : node.type === 'chapter'
      ? openEditorTargetIds.has(node.targetId!)
      : true

  // Determine if this is the active item
  const isActive = node.type === 'canvas'
    ? (node.targetId === activeCanvasTabId && openTabs.includes('canvas'))
    : node.type === 'chapter'
      ? (editorTabs.find(t => t.targetId === node.targetId)?.id === activeEditorTabId && openTabs.includes('editor'))
      : false

  const sortedChildren = useMemo(
    () => sortNodeIds(node.children, fileTreeNodes, sortBy),
    [node.children, fileTreeNodes, sortBy],
  )

  const handleClick = () => {
    if (node.type === 'folder') {
      toggleFileTreeNodeExpanded(nodeId)
    } else if (node.type === 'canvas' && node.targetId) {
      setActiveCanvasTab(node.targetId)
      if (!openTabs.includes('canvas')) toggleTab('canvas')
    } else if (node.type === 'chapter' && node.targetId) {
      const tab = editorTabs.find(t => t.targetId === node.targetId)
      if (tab) setActiveEditorTab(tab.id)
      if (!openTabs.includes('editor')) toggleTab('editor')
    }
  }

  /* drag-and-drop */
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-filetree-node', nodeId)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height

    if (node.type === 'folder') {
      if (y < h * 0.25) setDragOverState('above')
      else if (y > h * 0.75) setDragOverState('below')
      else setDragOverState('inside')
    } else {
      setDragOverState(y < h / 2 ? 'above' : 'below')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedId = e.dataTransfer.getData('application/x-filetree-node')
    if (!draggedId || draggedId === nodeId) {
      setDragOverState(null)
      return
    }

    if (dragOverState === 'inside' && node.type === 'folder') {
      moveFileTreeNode(draggedId, nodeId)
    } else if (dragOverState === 'above') {
      moveFileTreeNode(draggedId, node.parentId, nodeId)
    } else if (dragOverState === 'below') {
      const parentChildren = node.parentId
        ? fileTreeNodes[node.parentId]?.children ?? []
        : useEditorStore.getState().fileTreeRoots
      const idx = parentChildren.indexOf(nodeId)
      const nextSibling = parentChildren[idx + 1] ?? null
      moveFileTreeNode(draggedId, node.parentId, nextSibling)
    }

    setDragOverState(null)
  }

  const icon = node.type === 'folder'
    ? (node.isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-accent/70" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-accent/70" />)
    : node.type === 'canvas'
      ? <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-accent/70" />
      : <FileText className="w-3.5 h-3.5 shrink-0 text-text-muted" />

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOverState(null)}
        onDrop={handleDrop}
        className={cn(
          'group flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors text-xs',
          isActive ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-primary',
          !isTargetOpen && node.type !== 'folder' && 'opacity-40',
          dragOverState === 'above' && 'border-t-2 border-accent',
          dragOverState === 'below' && 'border-b-2 border-accent',
          dragOverState === 'inside' && 'bg-accent/10',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={() => { setIsRenaming(true); setRenameValue(node.name) }}
      >
        {node.type === 'folder' && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFileTreeNodeExpanded(nodeId) }}
            className="shrink-0 text-text-muted hover:text-text-primary"
          >
            {node.isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}

        {icon}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim()) renameFileTreeNode(nodeId, renameValue.trim())
              setIsRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renameValue.trim()) renameFileTreeNode(nodeId, renameValue.trim())
                setIsRenaming(false)
              }
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-b border-accent outline-none text-xs px-0.5"
          />
        ) : (
          <span className="truncate flex-1">{node.name}</span>
        )}

        {node.type === 'folder' && (
          <button
            onClick={(e) => { e.stopPropagation(); removeFileTreeNode(nodeId) }}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {node.type === 'folder' && node.isExpanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map(childId => (
            <FileTreeNodeComponent
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              activeCanvasTabId={activeCanvasTabId}
              activeEditorTabId={activeEditorTabId}
              openCanvasTabIds={openCanvasTabIds}
              openEditorTargetIds={openEditorTargetIds}
              sortBy={sortBy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── OpenFilesPanel ── */

export function OpenFilesPanel() {
  const canvasTabs = useEditorStore(s => s.canvasTabs)
  const editorTabs = useEditorStore(s => s.editorTabs)
  const activeCanvasTabId = useEditorStore(s => s.activeCanvasTabId)
  const activeEditorTabId = useEditorStore(s => s.activeEditorTabId)
  const fileTreeRoots = useEditorStore(s => s.fileTreeRoots)
  const fileTreeNodes = useEditorStore(s => s.fileTreeNodes)
  const fileTreeSortBy = useEditorStore(s => s.fileTreeSortBy)
  const syncFileTreeWithTabs = useEditorStore(s => s.syncFileTreeWithTabs)
  const addFileTreeNode = useEditorStore(s => s.addFileTreeNode)
  const setFileTreeSortBy = useEditorStore(s => s.setFileTreeSortBy)
  const expandAllFolders = useEditorStore(s => s.expandAllFolders)
  const collapseAllFolders = useEditorStore(s => s.collapseAllFolders)
  const openCanvasTab = useEditorStore(s => s.openCanvasTab)

  const chapters = useProjectStore(s => s.chapters)
  const createChapter = useProjectStore(s => s.createChapter)
  const currentProject = useProjectStore(s => s.currentProject)
  const selectChapter = useProjectStore(s => s.selectChapter)

  // Sync file tree whenever tabs change
  useEffect(() => {
    syncFileTreeWithTabs()
  }, [canvasTabs.length, editorTabs.length])

  const openCanvasTabIds = useMemo(
    () => new Set(canvasTabs.map(t => t.id)),
    [canvasTabs],
  )
  const openEditorTargetIds = useMemo(
    () => new Set(editorTabs.map(t => t.targetId)),
    [editorTabs],
  )

  const sortedRoots = useMemo(
    () => sortNodeIds(fileTreeRoots, fileTreeNodes, fileTreeSortBy),
    [fileTreeRoots, fileTreeNodes, fileTreeSortBy],
  )

  const handleNewStoryflow = () => {
    openCanvasTab(null, 'New Story Flow')
  }

  const handleNewDocument = async () => {
    if (!currentProject) return
    const ch = await createChapter(`새 문서 ${chapters.length + 1}`)
    selectChapter(ch.id)
  }

  const handleNewFolder = () => {
    addFileTreeNode({
      type: 'folder',
      name: '새 폴더',
      parentId: null,
      children: [],
      isExpanded: true,
    })
  }

  // Drop on empty area → move to root
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('application/x-filetree-node')
    if (draggedId) {
      useEditorStore.getState().moveFileTreeNode(draggedId, null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1.5 border-b border-border shrink-0">
        <button onClick={handleNewStoryflow} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 스토리플로우">
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleNewDocument} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 본문">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleNewFolder} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 폴더">
          <FolderPlus className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          onClick={() => setFileTreeSortBy(fileTreeSortBy === 'name' ? 'date' : 'name')}
          className={cn(
            'p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition',
          )}
          title={fileTreeSortBy === 'name' ? '날짜순 정렬' : '이름순 정렬'}
        >
          {fileTreeSortBy === 'name'
            ? <ArrowDownAZ className="w-3.5 h-3.5" />
            : <ArrowDownWideNarrow className="w-3.5 h-3.5" />}
        </button>
        <button onClick={expandAllFolders} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="모두 펼치기">
          <ChevronsUpDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={collapseAllFolders} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="모두 접기">
          <ChevronsDownUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-y-auto py-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleRootDrop}
      >
        {sortedRoots.length === 0 ? (
          <div className="px-3 py-4 text-center text-text-muted text-xs">
            파일이 없습니다.
          </div>
        ) : (
          sortedRoots.map(rootId => (
            <FileTreeNodeComponent
              key={rootId}
              nodeId={rootId}
              depth={0}
              activeCanvasTabId={activeCanvasTabId}
              activeEditorTabId={activeEditorTabId}
              openCanvasTabIds={openCanvasTabIds}
              openEditorTargetIds={openEditorTargetIds}
              sortBy={fileTreeSortBy}
            />
          ))
        )}
      </div>
    </div>
  )
}
