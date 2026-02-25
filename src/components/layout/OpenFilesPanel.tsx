/**
 * OpenFilesPanel — File explorer with virtual folder structure.
 * Toolbar with creation/sort/expand actions + recursive tree view.
 * Right-click context menu for file operations.
 * Supports node types: folder, canvas, chapter, volume.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useEditorStore, type FileTreeNode } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useCanvasStore } from '@/stores/canvasStore'
import {
  Folder, FolderOpen, FolderPlus, LayoutGrid, FileText, Plus,
  ArrowDownAZ, ArrowDownWideNarrow, ChevronsUpDown, ChevronsDownUp,
  ChevronRight, ChevronDown, Trash2,
  ExternalLink, AppWindow, Copy, Download, Edit3, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { downloadTextFile, downloadJsonFile, extractPlainText } from '@/export/exportUtils'
import { toast } from '@/components/common/Toast'

/* ── types ── */

interface ContextMenuState {
  x: number
  y: number
  nodeId: string
}

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
    if (isGroupNode) {
      toggleFileTreeNodeExpanded(nodeId)
    } else if (node.type === 'canvas' && node.targetId) {
      setActiveCanvasTab(node.targetId)
      if (!openTabs.includes('canvas')) toggleTab('canvas')
      else activatePanel('canvas')
    } else if (node.type === 'chapter' && node.targetId) {
      const tab = editorTabs.find(t => t.targetId === node.targetId)
      if (tab) setActiveEditorTab(tab.id)
      if (!openTabs.includes('editor')) toggleTab('editor')
      else activatePanel('editor')
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isGroupNode) return
    e.preventDefault()
    e.stopPropagation()
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
          isActive ? 'bg-bg-hover/60 text-text-primary' : 'hover:bg-bg-hover text-text-primary',
          !isTargetOpen && node.type !== 'folder' && node.type !== 'volume' && 'opacity-40',
          dragOverState === 'above' && 'border-t-2 border-accent',
          dragOverState === 'below' && 'border-b-2 border-accent',
          dragOverState === 'inside' && 'bg-accent/10',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => { setIsRenaming(true); setRenameValue(node.name) }}
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
}: {
  menu: ContextMenuState
  onClose: () => void
  onRename: (nodeId: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const node = useEditorStore(s => s.fileTreeNodes[menu.nodeId])
  const removeFileTreeNode = useEditorStore(s => s.removeFileTreeNode)
  const openCanvasTab = useEditorStore(s => s.openCanvasTab)
  const openEditorTab = useEditorStore(s => s.openEditorTab)
  const closeCanvasTab = useEditorStore(s => s.closeCanvasTab)
  const activatePanel = useEditorStore(s => s.activatePanel)
  const openTabs = useEditorStore(s => s.openTabs)
  const toggleTab = useEditorStore(s => s.toggleTab)
  const splitTabToNewGroup = useEditorStore(s => s.splitTabToNewGroup)
  const canvasTabs = useEditorStore(s => s.canvasTabs)

  const chapters = useProjectStore(s => s.chapters)
  const deleteChapter = useProjectStore(s => s.deleteChapter)
  const duplicateChapter = useProjectStore(s => s.duplicateChapter)
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

  const handleOpenInNewTab = () => {
    if (isCanvas && node.targetId) {
      openCanvasTab(node.targetId, node.name)
      if (!openTabs.includes('canvas')) toggleTab('canvas')
      else activatePanel('canvas')
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
    onRename(menu.nodeId)
    onClose()
  }

  const handleDelete = async () => {
    if (isCanvas && node.targetId) {
      const tab = canvasTabs.find(t => t.targetId === node.targetId)
      if (tab) closeCanvasTab(tab.id)
      removeFileTreeNode(menu.nodeId)
      toast.success('캔버스가 삭제되었습니다.')
    } else if (node.targetId) {
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

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)

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

  const handleNewVolume = async () => {
    if (!currentProject) { toast.warning('프로젝트를 먼저 생성하세요.'); return }
    const volumeCount = chapters.filter(c => c.type === 'volume').length
    const name = `볼륨 ${volumeCount + 1}`
    const vol = await createChapter(name, null, 'volume')
    addFileTreeNode({
      type: 'volume',
      name,
      parentId: null,
      targetId: vol.id,
      children: [],
      isExpanded: true,
    })
  }

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('application/x-filetree-node')
    if (draggedId) {
      useEditorStore.getState().moveFileTreeNode(draggedId, null)
    }
  }

  const handleContextMenuClose = useCallback(() => setContextMenu(null), [])
  const handleContextMenuRename = useCallback((nodeId: string) => setRenamingNodeId(nodeId), [])
  const handleRenamingDone = useCallback(() => setRenamingNodeId(null), [])

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-0.5 px-1.5 py-1.5 shrink-0 flex-wrap">
        <button onClick={handleNewStoryflow} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 스토리플로우">
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleNewDocument} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 본문">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleNewFolder} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 폴더">
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleNewVolume} className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition" title="새 볼륨">
          <BookOpen className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          onClick={() => setFileTreeSortBy(fileTreeSortBy === 'name' ? 'date' : 'name')}
          className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition"
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
              onContextMenu={setContextMenu}
              renamingNodeId={renamingNodeId}
              onRenamingDone={handleRenamingDone}
            />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileTreeContextMenu
          menu={contextMenu}
          onClose={handleContextMenuClose}
          onRename={handleContextMenuRename}
        />
      )}
    </div>
  )
}
