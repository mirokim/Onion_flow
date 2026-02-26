/**
 * OpenFilesPanel — File explorer with virtual folder structure.
 * Toolbar with creation/sort/expand actions + recursive tree view.
 * Right-click context menu for file operations.
 * Supports node types: folder, canvas, chapter, volume, wiki.
 * Wiki entries are synced from wikiStore and appear inline in the file tree.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useEditorStore, type FileTreeNode } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import type { WikiEntry } from '@/types'
import { WIKI_CATEGORIES, WIKI_CATEGORY_GROUPS } from '@/components/wiki/WikiCategoryList'
import {
  Folder, FolderOpen, LayoutGrid, FileText, Plus,
  ChevronRight, ChevronDown, Trash2,
  ExternalLink, AppWindow, Copy, Download, Edit3, BookOpen,
  ArrowDownWideNarrow, Merge, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { downloadTextFile, downloadJsonFile, extractPlainText } from '@/export/exportUtils'
import { toast } from '@/components/common/Toast'
import { VersionHistoryModal } from '@/components/version/VersionHistoryModal'

/* ── types ── */

interface ContextMenuState {
  x: number
  y: number
  nodeId: string
}

interface ListContextMenuState {
  x: number
  y: number
  itemType: 'chapter' | 'wiki'
  itemId: string
  itemTitle: string
}

interface VersionHistoryState {
  entityType: string
  entityId: string
  entityTitle: string
}

type SortMode = 'name' | 'createdAt' | 'updatedAt'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'updatedAt', label: '최종수정순' },
  { value: 'createdAt', label: '만든날짜순' },
  { value: 'name', label: '이름순' },
]

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
      // volumes and folders first
      const aIsGroup = a.type === 'folder' || a.type === 'volume'
      const bIsGroup = b.type === 'folder' || b.type === 'volume'
      if (aIsGroup && !bIsGroup) return -1
      if (!aIsGroup && bIsGroup) return 1
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
  onContextMenu,
  renamingNodeId,
  onRenamingDone,
}: {
  nodeId: string
  depth: number
  activeCanvasTabId: string | null
  activeEditorTabId: string | null
  openCanvasTabIds: Set<string>
  openEditorTargetIds: Set<string>
  sortBy: 'name' | 'date'
  onContextMenu: (state: ContextMenuState) => void
  renamingNodeId: string | null
  onRenamingDone: () => void
}) {
  const node = useEditorStore(s => s.fileTreeNodes[nodeId])
  const fileTreeNodes = useEditorStore(s => s.fileTreeNodes)
  const toggleFileTreeNodeExpanded = useEditorStore(s => s.toggleFileTreeNodeExpanded)
  const moveFileTreeNode = useEditorStore(s => s.moveFileTreeNode)
  const renameFileTreeNode = useEditorStore(s => s.renameFileTreeNode)
  const removeFileTreeNode = useEditorStore(s => s.removeFileTreeNode)
  const setActiveCanvasTab = useEditorStore(s => s.setActiveCanvasTab)
  const setActiveEditorTab = useEditorStore(s => s.setActiveEditorTab)
  const activatePanel = useEditorStore(s => s.activatePanel)
  const openTabs = useEditorStore(s => s.openTabs)
  const toggleTab = useEditorStore(s => s.toggleTab)
  const editorTabs = useEditorStore(s => s.editorTabs)

  const deleteChapter = useProjectStore(s => s.deleteChapter)
  const isSelected = useEditorStore(s => s.selectedFileNodeIds.includes(nodeId))
  const toggleSelectFileNode = useEditorStore(s => s.toggleSelectFileNode)
  const clearFileSelection = useEditorStore(s => s.clearFileSelection)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [dragOverState, setDragOverState] = useState<'above' | 'inside' | 'below' | null>(null)

  // Trigger rename from context menu
  useEffect(() => {
    if (renamingNodeId === nodeId && node) {
      setIsRenaming(true)
      setRenameValue(node.name)
      onRenamingDone()
    }
  }, [renamingNodeId, nodeId, node, onRenamingDone])

  if (!node) return null

  const isGroupNode = node.type === 'folder' || node.type === 'volume'

  const isTargetOpen = node.type === 'canvas'
    ? openCanvasTabIds.has(node.targetId!)
    : (node.type === 'chapter' || node.type === 'wiki')
      ? openEditorTargetIds.has(node.targetId!)
      : true

  // Determine if this is the active item
  const isActive = node.type === 'canvas'
    ? (node.targetId === activeCanvasTabId && openTabs.includes('canvas'))
    : node.type === 'chapter'
      ? (editorTabs.find(t => t.targetId === node.targetId)?.id === activeEditorTabId && openTabs.includes('editor'))
      : node.type === 'wiki'
        ? (editorTabs.find(t => t.type === 'wiki' && t.targetId === node.targetId)?.id === activeEditorTabId && openTabs.includes('editor'))
        : false

  const sortedChildren = useMemo(
    () => sortNodeIds(node.children, fileTreeNodes, sortBy),
    [node.children, fileTreeNodes, sortBy],
  )

  const handleClick = (e: React.MouseEvent) => {
    if (isGroupNode) {
      toggleFileTreeNodeExpanded(nodeId)
      return
    }
    // Ctrl/Cmd+Click: toggle multi-select (chapter only)
    if ((e.ctrlKey || e.metaKey) && node.type === 'chapter') {
      toggleSelectFileNode(nodeId)
      return
    }
    // Normal click: clear selection and open
    clearFileSelection()
    if (node.type === 'canvas' && node.targetId) {
      setActiveCanvasTab(node.targetId)
      if (!openTabs.includes('canvas')) toggleTab('canvas')
      else activatePanel('canvas')
    } else if (node.type === 'chapter' && node.targetId) {
      const tab = editorTabs.find(t => t.targetId === node.targetId)
      if (tab) setActiveEditorTab(tab.id)
      if (!openTabs.includes('editor')) toggleTab('editor')
      else activatePanel('editor')
    } else if (node.type === 'wiki' && node.targetId) {
      useEditorStore.getState().openWikiTab(node.targetId, node.name)
      if (!openTabs.includes('editor')) toggleTab('editor')
      else activatePanel('editor')
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isGroupNode) return
    e.preventDefault()
    e.stopPropagation()
    // If this node is not in current selection, clear selection and select only this
    const sel = useEditorStore.getState().selectedFileNodeIds
    if (sel.length > 0 && !sel.includes(nodeId)) {
      clearFileSelection()
    }
    onContextMenu({ x: e.clientX, y: e.clientY, nodeId })
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

    if (isGroupNode) {
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

    if (dragOverState === 'inside' && isGroupNode) {
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'volume' && node.targetId) {
      // Also remove from projectStore
      deleteChapter(node.targetId)
    }
    removeFileTreeNode(nodeId)
  }

  // Icon per node type
  const icon = node.type === 'volume'
    ? <BookOpen className="w-3.5 h-3.5 shrink-0 text-accent/70" />
    : node.type === 'folder'
      ? (node.isExpanded
          ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          : <Folder className="w-3.5 h-3.5 shrink-0 text-text-muted" />)
      : node.type === 'canvas'
        ? <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        : node.type === 'wiki'
          ? <BookOpen className="w-3.5 h-3.5 shrink-0 text-purple-400/80" />
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
          'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors text-xs',
          isSelected ? 'bg-accent/15 text-text-primary' :
          isActive ? 'bg-bg-hover/60 text-text-primary' : 'hover:bg-bg-hover text-text-primary',
          !isTargetOpen && node.type !== 'folder' && node.type !== 'volume' && 'opacity-40',
          dragOverState === 'above' && 'border-t-2 border-accent',
          dragOverState === 'below' && 'border-b-2 border-accent',
          dragOverState === 'inside' && 'bg-accent/10',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => {
          // Wiki titles are edited inside WikiEntryEditor — skip inline rename
          if (node.type !== 'wiki') { setIsRenaming(true); setRenameValue(node.name) }
        }}
      >
        {/* Expand/collapse chevron for folder/volume */}
        {isGroupNode && (
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
          <span className={cn('truncate flex-1', node.type === 'volume' && 'font-semibold')}>
            {node.name}
          </span>
        )}

        {/* Delete button for folder/volume nodes */}
        {isGroupNode && (
          <button
            onClick={handleDelete}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Children */}
      {isGroupNode && node.isExpanded && sortedChildren.length > 0 && (
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
              onContextMenu={onContextMenu}
              renamingNodeId={renamingNodeId}
              onRenamingDone={onRenamingDone}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── FileTreeContextMenu ── */

function FileTreeContextMenu({
  menu,
  onClose,
  onRename,
  onOpenVersionHistory,
}: {
  menu: ContextMenuState
  onClose: () => void
  onRename: (nodeId: string) => void
  onOpenVersionHistory: (entityType: string, entityId: string, title: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const node = useEditorStore(s => s.fileTreeNodes[menu.nodeId])
  const removeFileTreeNode = useEditorStore(s => s.removeFileTreeNode)
  const openCanvasTab = useEditorStore(s => s.openCanvasTab)
  const openEditorTab = useEditorStore(s => s.openEditorTab)
  const closeCanvasTab = useEditorStore(s => s.closeCanvasTab)
  const closeEditorTab = useEditorStore(s => s.closeEditorTab)
  const editorTabs = useEditorStore(s => s.editorTabs)
  const activatePanel = useEditorStore(s => s.activatePanel)
  const openTabs = useEditorStore(s => s.openTabs)
  const toggleTab = useEditorStore(s => s.toggleTab)
  const splitTabToNewGroup = useEditorStore(s => s.splitTabToNewGroup)
  const canvasTabs = useEditorStore(s => s.canvasTabs)
  const selectedFileNodeIds = useEditorStore(s => s.selectedFileNodeIds)
  const fileTreeNodes = useEditorStore(s => s.fileTreeNodes)
  const clearFileSelection = useEditorStore(s => s.clearFileSelection)

  const chapters = useProjectStore(s => s.chapters)
  const deleteChapter = useProjectStore(s => s.deleteChapter)
  const duplicateChapter = useProjectStore(s => s.duplicateChapter)
  const mergeChapters = useProjectStore(s => s.mergeChapters)
  const selectChapter = useProjectStore(s => s.selectChapter)

  const exportCanvas = useCanvasStore(s => s.exportCanvas)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleContextMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  if (!node || node.type === 'folder' || node.type === 'volume') return null

  const style: React.CSSProperties = {
    position: 'fixed',
    left: menu.x,
    top: menu.y,
    zIndex: 9999,
  }

  const isCanvas = node.type === 'canvas'
  const isWiki = node.type === 'wiki'
  const isChapter = node.type === 'chapter'

  // Multi-select: collect all selected chapter node IDs (include the right-clicked node)
  const allSelectedIds = selectedFileNodeIds.length > 0
    ? (selectedFileNodeIds.includes(menu.nodeId) ? selectedFileNodeIds : [menu.nodeId])
    : [menu.nodeId]
  const selectedChapterNodeIds = allSelectedIds.filter(id => fileTreeNodes[id]?.type === 'chapter')
  const isMultiChapterSelect = selectedChapterNodeIds.length >= 2

  const handleMerge = async () => {
    // Get target IDs from file tree nodes
    const targetIds = selectedChapterNodeIds
      .map(id => fileTreeNodes[id]?.targetId)
      .filter((id): id is string => !!id)
    if (targetIds.length < 2) return

    // Sort by chapter order, merge into first
    const sorted = targetIds
      .map(id => chapters.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.order - b.order)
    if (sorted.length < 2) return

    const targetId = sorted[0].id
    const sourceIds = sorted.slice(1).map(c => c.id)
    await mergeChapters(targetId, sourceIds)

    // Remove merged source nodes from file tree
    for (const nid of selectedChapterNodeIds) {
      const ftNode = fileTreeNodes[nid]
      if (ftNode?.targetId && sourceIds.includes(ftNode.targetId)) {
        useEditorStore.getState().removeFileTreeNode(nid)
      }
    }

    clearFileSelection()
    toast.success(`${sorted.length}개의 챕터가 합쳐졌습니다.`)
    onClose()
  }

  const handleVersionHistory = () => {
    if (!node.targetId) return
    const entityType = isWiki ? 'character' : 'chapter'  // wiki can be various types
    onOpenVersionHistory(entityType, node.targetId, node.name)
    onClose()
  }

  const handleOpenInNewTab = () => {
    if (isCanvas && node.targetId) {
      openCanvasTab(node.targetId, node.name)
      if (!openTabs.includes('canvas')) toggleTab('canvas')
      else activatePanel('canvas')
    } else if (isWiki && node.targetId) {
      useEditorStore.getState().openWikiTab(node.targetId, node.name)
      if (!openTabs.includes('editor')) toggleTab('editor')
      else activatePanel('editor')
    } else if (node.targetId) {
      openEditorTab(node.targetId, node.name)
      if (!openTabs.includes('editor')) toggleTab('editor')
      else activatePanel('editor')
    }
    onClose()
  }

  const handleOpenInNewPane = () => {
    const panelType = isCanvas ? 'canvas' as const : 'editor' as const
    if (isCanvas && node.targetId) {
      openCanvasTab(node.targetId, node.name)
    } else if (isWiki && node.targetId) {
      useEditorStore.getState().openWikiTab(node.targetId, node.name)
    } else if (node.targetId) {
      openEditorTab(node.targetId, node.name)
    }
    if (!openTabs.includes(panelType)) toggleTab(panelType)
    splitTabToNewGroup(panelType)
    onClose()
  }

  const handleDuplicate = async () => {
    if (isCanvas && node.targetId) {
      const { generateId } = await import('@/lib/utils')
      openCanvasTab(generateId(), `${node.name} (복사본)`)
      toast.success('캔버스 복사본이 생성되었습니다.')
    } else if (isWiki) {
      toast.warning('위키 항목은 복사를 지원하지 않습니다.')
    } else if (node.targetId) {
      const copy = await duplicateChapter(node.targetId)
      if (copy) {
        selectChapter(copy.id)
        toast.success('문서 복사본이 생성되었습니다.')
      }
    }
    onClose()
  }

  const handleExport = () => {
    if (isCanvas) {
      const data = exportCanvas()
      downloadJsonFile(data, `${node.name}.json`)
      toast.success('캔버스가 내보내기되었습니다.')
    } else if (isWiki && node.targetId) {
      const entry = useWikiStore.getState().entries.find(e => e.id === node.targetId)
      if (entry) {
        downloadTextFile(entry.content || '(빈 항목)', `${node.name}.txt`)
        toast.success('위키 항목이 내보내기되었습니다.')
      }
    } else if (node.targetId) {
      const chapter = chapters.find(c => c.id === node.targetId)
      if (chapter) {
        const text = chapter.content ? extractPlainText(chapter.content) : ''
        downloadTextFile(text || '(빈 문서)', `${node.name}.txt`)
        toast.success('문서가 내보내기되었습니다.')
      }
    }
    onClose()
  }

  const handleRename = () => {
    if (isWiki) return // wiki rename happens inside WikiEntryEditor
    onRename(menu.nodeId)
    onClose()
  }

  const handleDelete = async () => {
    if (isCanvas && node.targetId) {
      const tab = canvasTabs.find(t => t.targetId === node.targetId)
      if (tab) closeCanvasTab(tab.id)
      removeFileTreeNode(menu.nodeId)
      toast.success('캔버스가 삭제되었습니다.')
    } else if (isWiki && node.targetId) {
      // Close wiki editor tab if open
      const wikiTab = editorTabs.find(t => t.type === 'wiki' && t.targetId === node.targetId)
      if (wikiTab) closeEditorTab(wikiTab.id)
      // wikiStore.deleteEntry also removes the file tree node
      await useWikiStore.getState().deleteEntry(node.targetId)
      toast.success('위키 항목이 삭제되었습니다.')
    } else if (node.targetId) {
      // Close the editor tab if open
      const editorTab = editorTabs.find(t => t.targetId === node.targetId)
      if (editorTab) closeEditorTab(editorTab.id)
      await deleteChapter(node.targetId)
      removeFileTreeNode(menu.nodeId)
      toast.success('문서가 삭제되었습니다.')
    }
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="min-w-[160px] bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden py-1"
    >
      <button onClick={handleOpenInNewTab} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>새 탭에서 열기</span>
      </button>
      <button onClick={handleOpenInNewPane} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <AppWindow className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>새 창에서 열기</span>
      </button>

      <div className="h-px bg-border mx-2 my-1" />

      <button onClick={handleDuplicate} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <Copy className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>복사본 생성</span>
      </button>
      <button onClick={handleExport} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <Download className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>내보내기</span>
      </button>
      {isMultiChapterSelect && (
        <button onClick={handleMerge} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
          <Merge className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>합치기 ({selectedChapterNodeIds.length})</span>
        </button>
      )}
      {(isChapter || isWiki) && !isMultiChapterSelect && (
        <button onClick={handleVersionHistory} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
          <History className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>버전 내역</span>
        </button>
      )}

      <div className="h-px bg-border mx-2 my-1" />

      <button onClick={handleRename} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <Edit3 className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>이름변경</span>
      </button>
      <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-bg-hover transition text-left">
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        <span>삭제</span>
      </button>
    </div>,
    document.body,
  )
}

/* ── CreateDropdown ── */

function CreateDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentProject = useProjectStore(s => s.currentProject)
  const openCanvasTab = useEditorStore(s => s.openCanvasTab)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const handleNewChapter = async () => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); setOpen(false); return }
    const ps = useProjectStore.getState()
    const count = ps.chapters.filter(c => c.type === 'chapter').length
    const ch = await ps.createChapter(`챕터 ${count + 1}`)
    ps.selectChapter(ch.id)
    const s = useEditorStore.getState()
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    else s.activatePanel('editor')
    setOpen(false)
  }

  const handleNewCanvas = () => {
    openCanvasTab(null, '새 캔버스')
    setOpen(false)
  }

  const handleNewWikiItem = async () => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); setOpen(false); return }
    const entry = await useWikiStore.getState().createEntry(currentProject.id, 'custom', '새 위키항목')
    const s = useEditorStore.getState()
    s.openWikiTab(entry.id, entry.title || '새 위키항목')
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    else s.activatePanel('editor')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-0.5 px-2 py-1 rounded text-[11px] transition',
          open ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
        )}
        title="새 항목 만들기"
      >
        <Plus className="w-3.5 h-3.5" />
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-0.5 bg-bg-surface border border-border rounded-lg shadow-xl py-1 w-36 z-50 text-xs">
          <button
            onClick={handleNewChapter}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-text-primary hover:bg-bg-hover transition text-left"
          >
            <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
            새 본문
          </button>
          <button
            onClick={handleNewCanvas}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-text-primary hover:bg-bg-hover transition text-left"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-text-muted shrink-0" />
            새 캔버스
          </button>
          <button
            onClick={handleNewWikiItem}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-text-primary hover:bg-bg-hover transition text-left"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
            새 위키항목
          </button>
        </div>
      )}
    </div>
  )
}

/* ── SortDropdown ── */

function SortDropdown({ sortBy, onChange }: { sortBy: SortMode; onChange: (s: SortMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-0.5 px-1.5 py-1 rounded transition',
          open ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
        )}
        title="정렬"
      >
        <ArrowDownWideNarrow className="w-3.5 h-3.5" />
        <ChevronDown className="w-2 h-2" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-0.5 bg-bg-surface border border-border rounded-lg shadow-xl py-1 w-32 z-50 text-xs">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center px-3 py-1.5 text-left transition',
                sortBy === opt.value
                  ? 'text-accent font-medium bg-accent/5'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              <span className="flex-1">{opt.label}</span>
              {sortBy === opt.value && <span className="text-[10px] opacity-60">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── WikiGroupSection ── */

const CATEGORY_LABEL_MAP = Object.fromEntries(
  WIKI_CATEGORIES.map(c => [c.key, { labelKo: c.labelKo, icon: c.icon }]),
)

function WikiGroupSection({
  group,
  onOpenEntry,
  onEntryContextMenu,
}: {
  group: { id: string; labelKo: string; icon: React.ReactNode; entries: WikiEntry[] }
  onOpenEntry: (entry: WikiEntry) => void
  onEntryContextMenu?: (e: React.MouseEvent, entry: WikiEntry) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 shrink-0" />
          : <ChevronDown className="w-3 h-3 shrink-0" />}
        <span className="shrink-0">{group.icon}</span>
        <span>{group.labelKo}</span>
        <span className="ml-auto opacity-60">{group.entries.length}</span>
      </button>

      {!collapsed && group.entries.map(entry => {
        const catInfo = CATEGORY_LABEL_MAP[entry.category]
        return (
          <div
            key={entry.id}
            onClick={() => onOpenEntry(entry)}
            onContextMenu={(e) => onEntryContextMenu?.(e, entry)}
            className="flex items-center gap-1.5 py-1 cursor-pointer hover:bg-bg-hover text-xs text-text-primary transition"
            style={{ paddingLeft: '28px' }}
          >
            <span className="shrink-0 text-purple-400/80">
              {catInfo?.icon ?? <BookOpen className="w-3 h-3" />}
            </span>
            <span className="truncate flex-1">{entry.title || '제목 없음'}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── VolumeGroup ── */

type ChapterItem = { id: string; title: string }

function VolumeGroup({
  volume,
  chapters,
  onOpenChapter,
  onChapterClick,
  onChapterContextMenu,
  selectedChapterIds,
  onAddChapter,
}: {
  volume: ChapterItem
  chapters: ChapterItem[]
  onOpenChapter: (ch: ChapterItem) => void
  onChapterClick?: (e: React.MouseEvent, ch: ChapterItem) => void
  onChapterContextMenu?: (e: React.MouseEvent, ch: ChapterItem) => void
  selectedChapterIds?: string[]
  onAddChapter?: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="group flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 shrink-0" />
          : <ChevronDown className="w-3 h-3 shrink-0" />}
        <BookOpen className="w-3 h-3 shrink-0 text-accent/70" />
        <span className="flex-1 text-left truncate">{volume.title || '볼륨'}</span>
        <span className="flex items-center gap-1 shrink-0">
          {onAddChapter && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onAddChapter() }}
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
              title="새 챕터"
            >
              <Plus className="w-2.5 h-2.5" />
            </span>
          )}
          <span className="opacity-60">{chapters.length}</span>
        </span>
      </button>
      {!collapsed && chapters.map(ch => (
        <div
          key={ch.id}
          onClick={(e) => onChapterClick ? onChapterClick(e, ch) : onOpenChapter(ch)}
          onContextMenu={(e) => onChapterContextMenu?.(e, ch)}
          className={cn(
            'flex items-center gap-1.5 py-1 cursor-pointer hover:bg-bg-hover text-xs text-text-primary transition',
            selectedChapterIds?.includes(ch.id) && 'bg-accent/15',
          )}
          style={{ paddingLeft: '28px' }}
        >
          <FileText className="w-3 h-3 shrink-0 text-text-muted" />
          <span className="truncate">{ch.title || '제목 없음'}</span>
        </div>
      ))}
    </div>
  )
}

/* ── ListContextMenu (WikiListView용 우클릭 메뉴) ── */

function ListContextMenu({
  menu,
  onClose,
  onOpenVersionHistory,
}: {
  menu: ListContextMenuState
  onClose: () => void
  onOpenVersionHistory: (entityType: string, entityId: string, title: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const chapters = useProjectStore(s => s.chapters)
  const deleteChapter = useProjectStore(s => s.deleteChapter)
  const duplicateChapter = useProjectStore(s => s.duplicateChapter)
  const mergeChapters = useProjectStore(s => s.mergeChapters)
  const selectChapter = useProjectStore(s => s.selectChapter)
  const selectedChapterIds = useEditorStore(s => s.selectedFileNodeIds)
  const clearFileSelection = useEditorStore(s => s.clearFileSelection)
  const exportCanvas = useCanvasStore(s => s.exportCanvas)

  const isChapter = menu.itemType === 'chapter'
  const isWiki = menu.itemType === 'wiki'

  // Multi-select: include clicked item + all selected items (chapter only)
  const allMergeIds = isChapter
    ? Array.from(new Set([menu.itemId, ...selectedChapterIds]))
    : []
  const isMultiChapterSelect = allMergeIds.length >= 2

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const handleOpenInNewPane = () => {
    const s = useEditorStore.getState()
    if (isChapter) {
      s.openEditorTab(menu.itemId, menu.itemTitle)
    } else {
      s.openWikiTab(menu.itemId, menu.itemTitle)
    }
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    s.splitTabToNewGroup('editor')
    onClose()
  }

  const handleDuplicate = async () => {
    if (isChapter) {
      const copy = await duplicateChapter(menu.itemId)
      if (copy) {
        selectChapter(copy.id)
        toast.success('문서 복사본이 생성되었습니다.')
      }
    } else {
      toast.warning('위키 항목은 복사를 지원하지 않습니다.')
    }
    onClose()
  }

  const handleExport = () => {
    if (isChapter) {
      const chapter = chapters.find(c => c.id === menu.itemId)
      if (chapter) {
        const text = chapter.content ? extractPlainText(chapter.content) : ''
        downloadTextFile(text || '(빈 문서)', `${menu.itemTitle}.txt`)
        toast.success('문서가 내보내기되었습니다.')
      }
    } else {
      const entry = useWikiStore.getState().entries.find(e => e.id === menu.itemId)
      if (entry) {
        downloadTextFile(entry.content || '(빈 항목)', `${menu.itemTitle}.txt`)
        toast.success('위키 항목이 내보내기되었습니다.')
      }
    }
    onClose()
  }

  const handleMerge = async () => {
    if (allMergeIds.length < 2) return
    const sorted = allMergeIds
      .map(id => chapters.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.order - b.order)
    if (sorted.length < 2) return
    const targetId = sorted[0].id
    const sourceIds = sorted.slice(1).map(c => c.id)
    await mergeChapters(targetId, sourceIds)
    clearFileSelection()
    toast.success(`${sorted.length}개의 챕터가 합쳐졌습니다.`)
    onClose()
  }

  const handleVersionHistory = () => {
    const entityType = isChapter ? 'chapter' : 'character'
    onOpenVersionHistory(entityType, menu.itemId, menu.itemTitle)
    onClose()
  }

  const handleRename = () => {
    if (isChapter) {
      // Trigger inline rename not easily possible here; open in editor instead
      const s = useEditorStore.getState()
      s.openEditorTab(menu.itemId, menu.itemTitle)
      if (!s.openTabs.includes('editor')) s.toggleTab('editor')
      else s.activatePanel('editor')
    }
    onClose()
  }

  const handleDelete = async () => {
    if (isChapter) {
      const tab = useEditorStore.getState().editorTabs.find(t => t.targetId === menu.itemId)
      if (tab) useEditorStore.getState().closeEditorTab(tab.id)
      await deleteChapter(menu.itemId)
      toast.success('문서가 삭제되었습니다.')
    } else {
      const tab = useEditorStore.getState().editorTabs.find(t => t.type === 'wiki' && t.targetId === menu.itemId)
      if (tab) useEditorStore.getState().closeEditorTab(tab.id)
      await useWikiStore.getState().deleteEntry(menu.itemId)
      toast.success('위키 항목이 삭제되었습니다.')
    }
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999 }}
      className="min-w-[160px] bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden py-1"
    >
      <button onClick={handleOpenInNewPane} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <AppWindow className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>새 창에서 열기</span>
      </button>

      <div className="h-px bg-border mx-2 my-1" />

      <button onClick={handleDuplicate} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <Copy className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>복사본 생성</span>
      </button>
      <button onClick={handleExport} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
        <Download className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span>내보내기</span>
      </button>
      {isMultiChapterSelect && (
        <button onClick={handleMerge} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
          <Merge className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>합치기 ({allMergeIds.length})</span>
        </button>
      )}
      {!isMultiChapterSelect && (
        <button onClick={handleVersionHistory} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
          <History className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>버전 내역</span>
        </button>
      )}

      <div className="h-px bg-border mx-2 my-1" />

      {isChapter && (
        <button onClick={handleRename} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left">
          <Edit3 className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>이름변경</span>
        </button>
      )}
      <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-bg-hover transition text-left">
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        <span>삭제</span>
      </button>
    </div>,
    document.body,
  )
}

/* ── BonbunSection ── */

function BonbunSection({
  volumes,
  volumeChildMap,
  orphanChapters,
  onOpenChapter,
  onChapterClick,
  onChapterContextMenu,
  selectedChapterIds,
  onAddVolume,
  onAddOrphanChapter,
  onAddChapterToVolume,
}: {
  volumes: ChapterItem[]
  volumeChildMap: Map<string | null, ChapterItem[]>
  orphanChapters: ChapterItem[]
  onOpenChapter: (ch: ChapterItem) => void
  onChapterClick?: (e: React.MouseEvent, ch: ChapterItem) => void
  onChapterContextMenu?: (e: React.MouseEvent, ch: ChapterItem) => void
  selectedChapterIds?: string[]
  onAddVolume: () => void
  onAddOrphanChapter: () => void
  onAddChapterToVolume: (volumeId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const total = volumes.reduce((acc, v) => acc + (volumeChildMap.get(v.id)?.length ?? 0), 0)
    + orphanChapters.length

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="group flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 shrink-0" />
          : <ChevronDown className="w-3 h-3 shrink-0" />}
        <FileText className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left">본문</span>
        <span className="opacity-60 mr-1">{total}</span>
      </button>

      {!collapsed && (
        <>
          {volumes.map(vol => (
            <VolumeGroup
              key={vol.id}
              volume={vol}
              chapters={volumeChildMap.get(vol.id) ?? []}
              onOpenChapter={onOpenChapter}
              onChapterClick={onChapterClick}
              onChapterContextMenu={onChapterContextMenu}
              selectedChapterIds={selectedChapterIds}
              onAddChapter={() => onAddChapterToVolume(vol.id)}
            />
          ))}
          {orphanChapters.map(ch => (
            <div
              key={ch.id}
              onClick={(e) => onChapterClick ? onChapterClick(e, ch) : onOpenChapter(ch)}
              onContextMenu={(e) => onChapterContextMenu?.(e, ch)}
              className={cn(
                'flex items-center gap-1.5 py-1 cursor-pointer hover:bg-bg-hover text-xs text-text-primary transition',
                selectedChapterIds?.includes(ch.id) && 'bg-accent/15',
              )}
              style={{ paddingLeft: '20px' }}
            >
              <FileText className="w-3 h-3 shrink-0 text-text-muted" />
              <span className="truncate">{ch.title || '제목 없음'}</span>
            </div>
          ))}
          {/* Inline creation */}
          <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: '20px' }}>
            <button
              onClick={onAddOrphanChapter}
              className="flex items-center gap-0.5 text-[10px] text-text-muted hover:text-text-primary px-1 py-0.5 rounded hover:bg-bg-hover transition"
              title="새 챕터"
            >
              <Plus className="w-2.5 h-2.5" />챕터
            </button>
            <button
              onClick={onAddVolume}
              className="flex items-center gap-0.5 text-[10px] text-text-muted hover:text-text-primary px-1 py-0.5 rounded hover:bg-bg-hover transition"
              title="새 볼륨"
            >
              <Plus className="w-2.5 h-2.5" />볼륨
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── WikiListView (통합: 본문 + 위키항목) ── */

function WikiListView({ search, sortBy }: { search: string; sortBy: SortMode }) {
  const entries = useWikiStore(s => s.entries)
  const allChapters = useProjectStore(s => s.chapters)
  const createChapter = useProjectStore(s => s.createChapter)
  const selectChapter = useProjectStore(s => s.selectChapter)
  const currentProject = useProjectStore(s => s.currentProject)

  const q = search.trim().toLowerCase()

  // ── 본문 ──
  const volumes = useMemo(() => allChapters.filter(c => c.type === 'volume'), [allChapters])
  const leafChapters = useMemo(() => allChapters.filter(c => c.type === 'chapter'), [allChapters])

  const filteredLeaf = useMemo(() => {
    let result = q ? leafChapters.filter(c => c.title.toLowerCase().includes(q)) : leafChapters
    if (sortBy === 'name') result = [...result].sort((a, b) => a.title.localeCompare(b.title))
    else if (sortBy === 'createdAt') result = [...result].sort((a, b) => b.createdAt - a.createdAt)
    else result = [...result].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    return result
  }, [leafChapters, q, sortBy])

  const volumeChildMap = useMemo(() => {
    const map = new Map<string | null, ChapterItem[]>()
    const volumeIds = new Set(volumes.map(v => v.id))
    for (const ch of filteredLeaf) {
      const key = ch.parentId && volumeIds.has(ch.parentId) ? ch.parentId : null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ id: ch.id, title: ch.title })
    }
    return map
  }, [filteredLeaf, volumes])

  // When searching: only show volumes with matching content or title
  // When not searching: show all volumes (including empty ones)
  const bonbunVolumes = useMemo(
    () => q
      ? volumes.filter(v =>
          (volumeChildMap.get(v.id)?.length ?? 0) > 0
          || v.title.toLowerCase().includes(q),
        ).map(v => ({ id: v.id, title: v.title }))
      : volumes.map(v => ({ id: v.id, title: v.title })),
    [volumes, volumeChildMap, q],
  )
  const orphanChapters: ChapterItem[] = volumeChildMap.get(null) ?? []

  const showBonbun = !q || bonbunVolumes.length > 0 || orphanChapters.length > 0

  // ── 위키 ──
  const filteredEntries = useMemo(() => {
    let result = q ? entries.filter(e => (e.title ?? '').toLowerCase().includes(q)) : entries
    if (sortBy === 'name') result = [...result].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    else if (sortBy === 'createdAt') result = [...result].sort((a, b) => b.createdAt - a.createdAt)
    else result = [...result].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    return result
  }, [entries, q, sortBy])
  const grouped = useMemo(
    () => WIKI_CATEGORY_GROUPS
      .map(g => ({
        id: g.id,
        labelKo: g.labelKo,
        icon: g.icon,
        entries: filteredEntries.filter(e => g.categories.some(c => c.key === e.category)),
      }))
      .filter(g => g.entries.length > 0),
    [filteredEntries],
  )

  // ── helpers ──
  const openEditorPanel = useCallback(() => {
    const s = useEditorStore.getState()
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    else s.activatePanel('editor')
  }, [])

  const handleOpenChapter = useCallback((ch: ChapterItem) => {
    const s = useEditorStore.getState()
    s.openEditorTab(ch.id, ch.title || '제목 없음')
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    else s.activatePanel('editor')
  }, [])

  const handleOpenEntry = useCallback((entry: WikiEntry) => {
    const s = useEditorStore.getState()
    s.openWikiTab(entry.id, entry.title || '새 항목')
    if (!s.openTabs.includes('editor')) s.toggleTab('editor')
    else s.activatePanel('editor')
  }, [])

  const handleAddVolume = useCallback(async () => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); return }
    const count = useProjectStore.getState().chapters.filter(c => c.type === 'volume').length
    await createChapter(`볼륨 ${count + 1}`, null, 'volume')
  }, [currentProject, createChapter])

  const handleAddOrphanChapter = useCallback(async () => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); return }
    const count = useProjectStore.getState().chapters.filter(c => c.type === 'chapter').length
    const ch = await createChapter(`챕터 ${count + 1}`)
    selectChapter(ch.id)
    openEditorPanel()
  }, [currentProject, createChapter, selectChapter, openEditorPanel])

  const handleAddChapterToVolume = useCallback(async (volumeId: string) => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); return }
    const count = useProjectStore.getState().chapters.filter(
      c => c.type === 'chapter' && c.parentId === volumeId,
    ).length
    const ch = await createChapter(`챕터 ${count + 1}`, volumeId)
    selectChapter(ch.id)
    openEditorPanel()
  }, [currentProject, createChapter, selectChapter, openEditorPanel])

  const noResults = !!q && !showBonbun && grouped.length === 0

  // ── Context menu & version history modal state ──
  const [listMenu, setListMenu] = useState<ListContextMenuState | null>(null)
  const [versionHistory, setVersionHistory] = useState<VersionHistoryState | null>(null)
  const selectedChapterIds = useEditorStore(s => s.selectedFileNodeIds)
  const toggleSelectFileNode = useEditorStore(s => s.toggleSelectFileNode)
  const clearFileSelection = useEditorStore(s => s.clearFileSelection)

  const handleChapterContextMenu = useCallback((e: React.MouseEvent, ch: ChapterItem) => {
    e.preventDefault()
    e.stopPropagation()
    setListMenu({ x: e.clientX, y: e.clientY, itemType: 'chapter', itemId: ch.id, itemTitle: ch.title || '제목 없음' })
  }, [])

  const handleEntryContextMenu = useCallback((e: React.MouseEvent, entry: WikiEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setListMenu({ x: e.clientX, y: e.clientY, itemType: 'wiki', itemId: entry.id, itemTitle: entry.title || '제목 없음' })
  }, [])

  const handleChapterClick = useCallback((e: React.MouseEvent, ch: ChapterItem) => {
    // Ctrl/Cmd+Click: toggle multi-select for merge
    if (e.ctrlKey || e.metaKey) {
      toggleSelectFileNode(ch.id)
      return
    }
    clearFileSelection()
    handleOpenChapter(ch)
  }, [handleOpenChapter, toggleSelectFileNode, clearFileSelection])

  const handleOpenVersionHistory = useCallback((entityType: string, entityId: string, title: string) => {
    setVersionHistory({ entityType, entityId, entityTitle: title })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {noResults ? (
          <div className="px-3 py-4 text-center text-text-muted text-xs">검색 결과 없음</div>
        ) : (
          <>
            {/* 본문 category */}
            {showBonbun && (
              <BonbunSection
                volumes={bonbunVolumes}
                volumeChildMap={volumeChildMap}
                orphanChapters={orphanChapters}
                onOpenChapter={handleOpenChapter}
                onChapterClick={handleChapterClick}
                onChapterContextMenu={handleChapterContextMenu}
                selectedChapterIds={selectedChapterIds}
                onAddVolume={handleAddVolume}
                onAddOrphanChapter={handleAddOrphanChapter}
                onAddChapterToVolume={handleAddChapterToVolume}
              />
            )}

            {/* 위키 categories */}
            {grouped.map(g => (
              <WikiGroupSection key={g.id} group={g} onOpenEntry={handleOpenEntry} onEntryContextMenu={handleEntryContextMenu} />
            ))}
          </>
        )}
      </div>

      {/* Context menu */}
      {listMenu && (
        <ListContextMenu
          menu={listMenu}
          onClose={() => setListMenu(null)}
          onOpenVersionHistory={handleOpenVersionHistory}
        />
      )}

      {/* Version history modal */}
      {versionHistory && (
        <VersionHistoryModal
          entityType={versionHistory.entityType}
          entityId={versionHistory.entityId}
          entityTitle={versionHistory.entityTitle}
          onClose={() => setVersionHistory(null)}
        />
      )}
    </div>
  )
}

/* ── OpenFilesPanel ── */

export function OpenFilesPanel() {
  const canvasTabs = useEditorStore(s => s.canvasTabs)
  const editorTabs = useEditorStore(s => s.editorTabs)
  const syncFileTreeWithTabs = useEditorStore(s => s.syncFileTreeWithTabs)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortMode>('updatedAt')

  // Keep file tree synced (wiki nodes depend on this)
  useEffect(() => {
    syncFileTreeWithTabs()
  }, [canvasTabs.length, editorTabs.length])

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1 shrink-0 border-b border-border/40">
        <CreateDropdown />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="검색..."
          className="flex-1 min-w-0 bg-bg-secondary border border-border rounded px-2 py-0.5 text-[11px] text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
        />
        <SortDropdown sortBy={sortBy} onChange={setSortBy} />
      </div>

      {/* Integrated content view */}
      <WikiListView search={search} sortBy={sortBy} />
    </div>
  )
}

