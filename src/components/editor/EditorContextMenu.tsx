/**
 * EditorContextMenu — Right-click context menu for the BlockEditor.
 * Provides formatting, paragraph, insert, clipboard, and "send to node" actions.
 */
import { useState, useEffect, useRef } from 'react'
import { type Editor } from '@tiptap/react'
import { createPortal } from 'react-dom'
import {
  Send, Type, Pilcrow, PlusCircle,
  Scissors, Copy, ClipboardPaste, ClipboardType, MousePointerClick,
  Bold, Italic, Underline, Strikethrough, Highlighter, RemoveFormatting,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote,
  Minus,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/components/common/Toast'

interface EditorContextMenuProps {
  editor: Editor
  position: { x: number; y: number } | null
  onClose: () => void
}

type Submenu = 'format' | 'paragraph' | 'insert' | null

export function EditorContextMenu({ editor, position, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [submenu, setSubmenu] = useState<Submenu>(null)
  const addNode = useCanvasStore(s => s.addNode)
  const currentProject = useProjectStore(s => s.currentProject)

  // Close on click-outside or Escape.
  // Note: mousedown fires for all buttons (left=0, right=2), so it handles
  // both left-click-outside and right-click-elsewhere (cross-panel close).
  // We intentionally do NOT listen for 'contextmenu' on document to avoid
  // a race condition where the close handler runs after the BlockEditor's
  // capture-phase handler that sets a new position.
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

  // Reset submenu when position changes
  useEffect(() => {
    setSubmenu(null)
  }, [position])

  if (!position) return null

  const hasSelection = !editor.state.selection.empty

  // ── Actions ──

  const handleSendToNode = async () => {
    if (!currentProject) {
      toast.warning('프로젝트를 먼저 선택하세요.')
      onClose()
      return
    }
    const text = hasSelection
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n')
      : ''
    if (!text.trim()) {
      toast.warning('텍스트를 선택한 후 사용하세요.')
      onClose()
      return
    }
    await addNode(currentProject.id, 'event', { x: 100, y: 100 }, { label: text.slice(0, 40), content: text })
    toast.success('선택한 텍스트가 노드로 전송되었습니다.')
    onClose()
  }

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
      const clipText = await navigator.clipboard.readText()
      if (clipText) {
        editor.chain().focus().insertContent(clipText).run()
      }
    } catch {
      document.execCommand('paste')
    }
    onClose()
  }

  const handlePastePlainText = async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      if (clipText) {
        editor.chain().focus().insertContent(clipText).run()
      }
    } catch {
      document.execCommand('paste')
    }
    onClose()
  }

  const handleSelectAll = () => {
    editor.chain().focus().selectAll().run()
    onClose()
  }

  // Keep menu within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 400),
    zIndex: 9999,
  }

  return createPortal(
    <div ref={menuRef} style={style} className="min-w-[180px] bg-bg-surface border border-border rounded-lg shadow-xl overflow-visible py-1">
      {/* 노드로 보내기 */}
      <button
        onClick={handleSendToNode}
        disabled={!hasSelection}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition text-left',
          hasSelection ? 'text-text-primary hover:bg-bg-hover' : 'text-text-muted cursor-default',
        )}
      >
        <Send className="w-3.5 h-3.5 shrink-0" />
        <span>노드로 보내기</span>
      </button>

      <div className="h-px bg-border mx-2 my-1" />

      {/* 서식 (Format) — submenu */}
      <SubmenuItem
        icon={<Type className="w-3.5 h-3.5 shrink-0" />}
        label="서식"
        isOpen={submenu === 'format'}
        onHover={() => setSubmenu('format')}
      >
        <MenuItem icon={<Bold className="w-3.5 h-3.5" />} label="굵게" shortcut="Ctrl+B"
          active={editor.isActive('bold')}
          onClick={() => { editor.chain().focus().toggleBold().run(); onClose() }} />
        <MenuItem icon={<Italic className="w-3.5 h-3.5" />} label="기울임" shortcut="Ctrl+I"
          active={editor.isActive('italic')}
          onClick={() => { editor.chain().focus().toggleItalic().run(); onClose() }} />
        <MenuItem icon={<Underline className="w-3.5 h-3.5" />} label="밑줄" shortcut="Ctrl+U"
          active={editor.isActive('underline')}
          onClick={() => { editor.chain().focus().toggleUnderline().run(); onClose() }} />
        <MenuItem icon={<Strikethrough className="w-3.5 h-3.5" />} label="취소선"
          active={editor.isActive('strike')}
          onClick={() => { editor.chain().focus().toggleStrike().run(); onClose() }} />
        <MenuItem icon={<Highlighter className="w-3.5 h-3.5" />} label="형광펜"
          active={editor.isActive('highlight')}
          onClick={() => { editor.chain().focus().toggleHighlight().run(); onClose() }} />
        <div className="h-px bg-border mx-2 my-1" />
        <MenuItem icon={<RemoveFormatting className="w-3.5 h-3.5" />} label="서식 지우기"
          onClick={() => { editor.chain().focus().unsetAllMarks().run(); onClose() }} />
      </SubmenuItem>

      {/* 단락 (Paragraph) — submenu */}
      <SubmenuItem
        icon={<Pilcrow className="w-3.5 h-3.5 shrink-0" />}
        label="단락"
        isOpen={submenu === 'paragraph'}
        onHover={() => setSubmenu('paragraph')}
      >
        <MenuItem icon={<Type className="w-3.5 h-3.5" />} label="본문"
          active={editor.isActive('paragraph')}
          onClick={() => { editor.chain().focus().setParagraph().run(); onClose() }} />
        <MenuItem icon={<Heading1 className="w-3.5 h-3.5" />} label="제목 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); onClose() }} />
        <MenuItem icon={<Heading2 className="w-3.5 h-3.5" />} label="제목 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); onClose() }} />
        <MenuItem icon={<Heading3 className="w-3.5 h-3.5" />} label="제목 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); onClose() }} />
        <div className="h-px bg-border mx-2 my-1" />
        <MenuItem icon={<List className="w-3.5 h-3.5" />} label="글머리 기호"
          active={editor.isActive('bulletList')}
          onClick={() => { editor.chain().focus().toggleBulletList().run(); onClose() }} />
        <MenuItem icon={<ListOrdered className="w-3.5 h-3.5" />} label="번호 매기기"
          active={editor.isActive('orderedList')}
          onClick={() => { editor.chain().focus().toggleOrderedList().run(); onClose() }} />
        <MenuItem icon={<Quote className="w-3.5 h-3.5" />} label="인용"
          active={editor.isActive('blockquote')}
          onClick={() => { editor.chain().focus().toggleBlockquote().run(); onClose() }} />
        <div className="h-px bg-border mx-2 my-1" />
        <MenuItem icon={<AlignLeft className="w-3.5 h-3.5" />} label="왼쪽 정렬"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => { editor.chain().focus().setTextAlign('left').run(); onClose() }} />
        <MenuItem icon={<AlignCenter className="w-3.5 h-3.5" />} label="가운데 정렬"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => { editor.chain().focus().setTextAlign('center').run(); onClose() }} />
        <MenuItem icon={<AlignRight className="w-3.5 h-3.5" />} label="오른쪽 정렬"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => { editor.chain().focus().setTextAlign('right').run(); onClose() }} />
      </SubmenuItem>

      {/* 삽입 (Insert) — submenu */}
      <SubmenuItem
        icon={<PlusCircle className="w-3.5 h-3.5 shrink-0" />}
        label="삽입"
        isOpen={submenu === 'insert'}
        onHover={() => setSubmenu('insert')}
      >
        <MenuItem icon={<Minus className="w-3.5 h-3.5" />} label="구분선"
          onClick={() => { editor.chain().focus().setHorizontalRule().run(); onClose() }} />
      </SubmenuItem>

      <div className="h-px bg-border mx-2 my-1" />

      {/* Clipboard actions */}
      <button
        onClick={handleCut}
        disabled={!hasSelection}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition text-left',
          hasSelection ? 'text-text-primary hover:bg-bg-hover' : 'text-text-muted cursor-default',
        )}
        onMouseEnter={() => setSubmenu(null)}
      >
        <Scissors className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">잘라내기</span>
        <span className="text-text-muted text-[10px]">Ctrl+X</span>
      </button>
      <button
        onClick={handleCopy}
        disabled={!hasSelection}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition text-left',
          hasSelection ? 'text-text-primary hover:bg-bg-hover' : 'text-text-muted cursor-default',
        )}
        onMouseEnter={() => setSubmenu(null)}
      >
        <Copy className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">복사</span>
        <span className="text-text-muted text-[10px]">Ctrl+C</span>
      </button>
      <button onClick={handlePaste} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left"
        onMouseEnter={() => setSubmenu(null)}
      >
        <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">붙여넣기</span>
        <span className="text-text-muted text-[10px]">Ctrl+V</span>
      </button>
      <button onClick={handlePastePlainText} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left"
        onMouseEnter={() => setSubmenu(null)}
      >
        <ClipboardType className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">일반 텍스트로 붙여넣기</span>
        <span className="text-text-muted text-[10px] shrink-0">Ctrl+Shift+V</span>
      </button>

      <div className="h-px bg-border mx-2 my-1" />

      <button onClick={handleSelectAll} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition text-left"
        onMouseEnter={() => setSubmenu(null)}
      >
        <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">모두 선택</span>
        <span className="text-text-muted text-[10px]">Ctrl+A</span>
      </button>
    </div>,
    document.body,
  )
}

/* ── Submenu wrapper ── */

function SubmenuItem({
  icon,
  label,
  isOpen,
  onHover,
  children,
}: {
  icon: React.ReactNode
  label: string
  isOpen: boolean
  onHover: () => void
  children: React.ReactNode
}) {
  const itemRef = useRef<HTMLDivElement>(null)

  // Compute submenu position relative to item
  const getSubmenuStyle = (): React.CSSProperties => {
    if (!itemRef.current) return { left: '100%', top: 0 }
    const rect = itemRef.current.getBoundingClientRect()
    const subWidth = 180
    const fitsRight = rect.right + subWidth < window.innerWidth
    return {
      position: 'fixed',
      left: fitsRight ? rect.right - 4 : rect.left - subWidth + 4,
      top: Math.min(rect.top, window.innerHeight - 300),
    }
  }

  return (
    <div ref={itemRef} className="relative" onMouseEnter={onHover}>
      <div className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition cursor-default">
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
      </div>
      {isOpen && (
        <div style={getSubmenuStyle()} className="min-w-[180px] bg-bg-surface border border-border rounded-lg shadow-xl py-1 z-[10000]">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Individual menu item ── */

function MenuItem({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition text-left',
        active ? 'text-accent bg-accent/10' : 'text-text-primary hover:bg-bg-hover',
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-text-muted text-[10px] shrink-0">{shortcut}</span>}
    </button>
  )
}
