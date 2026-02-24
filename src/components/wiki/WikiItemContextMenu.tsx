/**
 * WikiItemContextMenu — Right-click context menu for wiki entries in the table view.
 * Actions: open in new pane, duplicate, export, rename, delete.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Columns2, CopyPlus, Download, Pencil, Trash2,
} from 'lucide-react'
import type { WikiEntry } from '@/types'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { createEntryWithUndo, deleteEntryWithUndo } from '@/stores/undoWikiActions'
import { downloadTextFile } from '@/export/exportUtils'
import { toast } from '@/components/common/Toast'
import { WIKI_CATEGORIES } from './WikiCategoryList'

interface WikiItemContextMenuProps {
  entry: WikiEntry
  position: { x: number; y: number }
  onClose: () => void
  onRename: (id: string) => void
}

export function WikiItemContextMenu({ entry, position, onClose, onRename }: WikiItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectEntry = useWikiStore(s => s.selectEntry)

  // Close on click-outside or Escape
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

  // Viewport-aware position
  const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }
  const menuW = 200, menuH = 220
  style.left = position.x + menuW > window.innerWidth ? position.x - menuW : position.x
  style.top = position.y + menuH > window.innerHeight ? position.y - menuH : position.y

  const handleOpenInNewPane = () => {
    // Split wiki tab to a new group
    useEditorStore.getState().splitTabToNewGroup('wiki')
    selectEntry(entry.id)
    onClose()
  }

  const handleDuplicate = async () => {
    const project = useProjectStore.getState().currentProject
    if (!project) return
    const newEntry = await createEntryWithUndo(project.id, entry.category, entry.title + ' (복사본)')
    // Copy content and tags
    await useWikiStore.getState().updateEntry(newEntry.id, {
      content: entry.content,
      tags: [...entry.tags],
    })
    toast.success('위키 항목이 복사되었습니다.')
    onClose()
  }

  const handleExport = () => {
    const catMeta = WIKI_CATEGORIES.find(c => c.key === entry.category)
    const catLabel = catMeta?.labelKo ?? entry.category
    const lines = [
      `# ${entry.title || 'Untitled'}`,
      `카테고리: ${catLabel}`,
      entry.tags.length > 0 ? `태그: ${entry.tags.join(', ')}` : '',
      '',
      entry.content,
    ].filter(Boolean)
    downloadTextFile(lines.join('\n'), `${entry.title || 'wiki_entry'}.txt`)
    toast.success('위키 항목이 내보내기되었습니다.')
    onClose()
  }

  const handleRename = () => {
    onRename(entry.id)
    onClose()
  }

  const handleDelete = () => {
    deleteEntryWithUndo(entry.id)
    toast.success('위키 항목이 삭제되었습니다.')
    onClose()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={menuRef}
        style={style}
        className="bg-bg-surface border border-border rounded-lg shadow-xl py-1 w-48 text-xs"
      >
        {/* Open in new pane */}
        <button
          onClick={handleOpenInNewPane}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Columns2 className="w-3.5 h-3.5" />
          새 창에서 열기
        </button>

        <div className="h-px bg-border mx-2 my-0.5" />

        {/* Duplicate */}
        <button
          onClick={handleDuplicate}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <CopyPlus className="w-3.5 h-3.5" />
          복사본 생성
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Download className="w-3.5 h-3.5" />
          내보내기
        </button>

        <div className="h-px bg-border mx-2 my-0.5" />

        {/* Rename */}
        <button
          onClick={handleRename}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          이름변경
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-400 hover:bg-red-500/10 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          삭제
        </button>
      </div>
    </>,
    document.body,
  )
}
