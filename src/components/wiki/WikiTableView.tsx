import { useMemo, useState, useRef, useEffect } from 'react'
import type { WikiEntry } from '@/types'
import { WIKI_CATEGORIES } from './WikiCategoryList'
import { WikiItemContextMenu } from './WikiItemContextMenu'
import { cn } from '@/lib/utils'
import { ArrowUpDown } from 'lucide-react'
import { updateEntryWithUndo } from '@/stores/undoWikiActions'

interface WikiTableViewProps {
  entries: WikiEntry[]
  onSelect: (id: string) => void
}

type SortField = 'title' | 'category' | 'updatedAt'
type SortDir = 'asc' | 'desc'

const CATEGORY_COLORS: Record<string, string> = {
  character: 'bg-blue-500/15 text-blue-400',
  character_memory: 'bg-emerald-500/15 text-emerald-400',
  character_motivation: 'bg-pink-500/15 text-pink-400',
  event: 'bg-yellow-500/15 text-yellow-500',
  story: 'bg-slate-500/15 text-slate-400',
  item: 'bg-orange-500/15 text-orange-400',
  custom: 'bg-gray-500/15 text-gray-400',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-gray-500/15 text-gray-400'
}

function getCategoryLabel(category: string): string {
  const cat = WIKI_CATEGORIES.find(c => c.key === category)
  return cat?.labelKo || category
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  return `${months}개월 전`
}

export function WikiTableView({ entries, onSelect }: WikiTableViewProps) {
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entryId: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'updatedAt' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '')
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        case 'updatedAt':
          cmp = a.updatedAt - b.updatedAt
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [entries, sortField, sortDir])

  const handleContextMenu = (e: React.MouseEvent, entryId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entryId })
  }

  const contextEntry = contextMenu ? entries.find(e => e.id === contextMenu.entryId) : null

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-muted text-sm">
        항목이 없습니다
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-bg-secondary z-10">
          <tr className="border-b border-border">
            <th className="text-left px-3 py-1 w-28">
              <button
                onClick={() => toggleSort('category')}
                className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition"
              >
                카테고리
                {sortField === 'category' && (
                  <ArrowUpDown className="w-3 h-3 text-accent" />
                )}
              </button>
            </th>
            <th className="text-left px-3 py-1">
              <button
                onClick={() => toggleSort('title')}
                className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition"
              >
                제목
                {sortField === 'title' && (
                  <ArrowUpDown className="w-3 h-3 text-accent" />
                )}
              </button>
            </th>
            <th className="text-left px-3 py-1 w-40 hidden xl:table-cell">
              <span className="text-xs font-medium text-text-muted">태그</span>
            </th>
            <th className="text-left px-3 py-1 w-20">
              <button
                onClick={() => toggleSort('updatedAt')}
                className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition"
              >
                수정
                {sortField === 'updatedAt' && (
                  <ArrowUpDown className="w-3 h-3 text-accent" />
                )}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(entry => (
            <WikiTableRow
              key={entry.id}
              entry={entry}
              onSelect={onSelect}
              onContextMenu={handleContextMenu}
              renamingId={renamingId}
              onRenameComplete={() => setRenamingId(null)}
            />
          ))}
        </tbody>
      </table>

      {/* Context menu */}
      {contextMenu && contextEntry && (
        <WikiItemContextMenu
          entry={contextEntry}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onRename={(id) => setRenamingId(id)}
        />
      )}
    </div>
  )
}

/** Individual table row — extracted so inline rename can have its own state */
function WikiTableRow({ entry, onSelect, onContextMenu, renamingId, onRenameComplete }: {
  entry: WikiEntry
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, entryId: string) => void
  renamingId: string | null
  onRenameComplete: () => void
}) {
  const isRenaming = renamingId === entry.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [renameValue, setRenameValue] = useState(entry.title)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(entry.title)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, entry.title])

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== entry.title) {
      updateEntryWithUndo(entry.id, { title: trimmed })
    }
    onRenameComplete()
  }

  return (
    <tr
      onClick={() => !isRenaming && onSelect(entry.id)}
      onContextMenu={(e) => onContextMenu(e, entry.id)}
      className="border-b border-border/30 hover:bg-bg-hover cursor-pointer transition group"
    >
      <td className="px-3 py-1">
        <span className={cn(
          'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium',
          getCategoryColor(entry.category),
        )}>
          {getCategoryLabel(entry.category)}
        </span>
      </td>
      <td className="px-3 py-1">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') onRenameComplete()
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-bg-hover border border-accent rounded px-1.5 py-0.5 focus:outline-none text-text-primary w-full"
          />
        ) : (
          <span className="text-xs text-text-primary group-hover:text-accent transition truncate block">
            {entry.title || 'Untitled'}
          </span>
        )}
      </td>
      <td className="px-3 py-1 hidden xl:table-cell">
        <div className="flex gap-1 flex-wrap">
          {entry.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[11px] px-1.5 py-0.5 bg-bg-hover text-text-muted rounded"
            >
              {tag}
            </span>
          ))}
          {entry.tags.length > 3 && (
            <span className="text-[11px] text-text-muted">
              +{entry.tags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1">
        <span className="text-xs text-text-muted whitespace-nowrap">
          {formatRelativeTime(entry.updatedAt)}
        </span>
      </td>
    </tr>
  )
}
