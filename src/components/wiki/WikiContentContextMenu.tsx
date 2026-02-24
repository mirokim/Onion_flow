/**
 * WikiContentContextMenu — Right-click context menu for the wiki entry editor textarea.
 * Actions: cut, copy, paste, select all, divider, export, delete.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Scissors, Copy, ClipboardPaste, MousePointerClick,
  Download, Trash2,
} from 'lucide-react'
import type { WikiEntry } from '@/types'
import { deleteEntryWithUndo } from '@/stores/undoWikiActions'
import { downloadTextFile } from '@/export/exportUtils'
import { toast } from '@/components/common/Toast'
import { WIKI_CATEGORIES } from './WikiCategoryList'

interface WikiContentContextMenuProps {
  entry: WikiEntry
  position: { x: number; y: number } | null
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onClose: () => void
  onDelete: () => void
}

export function WikiContentContextMenu({ entry, position, textareaRef, onClose, onDelete }: WikiContentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click-outside or Escape
  useEffect(() => {
    if (!position) return
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
  }, [position, onClose])

  if (!position) return null

  // Viewport-aware position
  const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }
  const menuW = 200, menuH = 280
  style.left = position.x + menuW > window.innerWidth ? position.x - menuW : position.x
  style.top = position.y + menuH > window.innerHeight ? position.y - menuH : position.y

  const handleCut = () => {
    document.execCommand('cut')
    onClose()
  }

  const handleCopy = () => {
    document.execCommand('copy')
    onClose()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const ta = textareaRef.current
      if (ta) {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const val = ta.value
        const newValue = val.slice(0, start) + text + val.slice(end)
        // Trigger React-compatible change via native setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set
        nativeInputValueSetter?.call(ta, newValue)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        // Move cursor
        const newPos = start + text.length
        ta.setSelectionRange(newPos, newPos)
      }
    } catch {
      // Fallback
      document.execCommand('paste')
    }
    onClose()
  }

  const handleSelectAll = () => {
    const ta = textareaRef.current
    if (ta) {
      ta.focus()
      ta.setSelectionRange(0, ta.value.length)
    }
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

  const handleDelete = () => {
    deleteEntryWithUndo(entry.id)
    toast.success('위키 항목이 삭제되었습니다.')
    onDelete()
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
        {/* Cut */}
        <button
          onClick={handleCut}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Scissors className="w-3.5 h-3.5" />
          잘라내기
          <span className="ml-auto text-text-muted text-[10px]">Ctrl+X</span>
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Copy className="w-3.5 h-3.5" />
          복사
          <span className="ml-auto text-text-muted text-[10px]">Ctrl+C</span>
        </button>

        {/* Paste */}
        <button
          onClick={handlePaste}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          붙여넣기
          <span className="ml-auto text-text-muted text-[10px]">Ctrl+V</span>
        </button>

        {/* Select All */}
        <button
          onClick={handleSelectAll}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          모두 선택
          <span className="ml-auto text-text-muted text-[10px]">Ctrl+A</span>
        </button>

        <div className="h-px bg-border mx-2 my-0.5" />

        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
        >
          <Download className="w-3.5 h-3.5" />
          내보내기
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
