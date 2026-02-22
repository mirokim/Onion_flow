/**
 * SnapshotCard - Individual timeline snapshot display card.
 */
import { useState } from 'react'
import { Clock, RotateCcw, Trash2, ChevronDown, ChevronUp, FileText, Users, Map, BookOpen } from 'lucide-react'
import type { TimelineSnapshot } from '@/types'

interface SnapshotCardProps {
  snapshot: TimelineSnapshot
  isFirst: boolean
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onViewDiff: (snapshot: TimelineSnapshot) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${h}:${min}`
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return formatDate(ts)
}

function getSnapshotStats(snapshot: TimelineSnapshot) {
  try {
    const chapters = JSON.parse(snapshot.manuscriptData)
    const world = JSON.parse(snapshot.worldData)
    const wiki = JSON.parse(snapshot.wikiData)
    const canvas = JSON.parse(snapshot.canvasData)
    return {
      chapters: Array.isArray(chapters) ? chapters.length : 0,
      characters: Array.isArray(world.characters) ? world.characters.length : 0,
      wikiEntries: Array.isArray(wiki) ? wiki.length : 0,
      canvasNodes: Array.isArray(canvas.nodes) ? canvas.nodes.length : 0,
    }
  } catch {
    return { chapters: 0, characters: 0, wikiEntries: 0, canvasNodes: 0 }
  }
}

export function SnapshotCard({ snapshot, isFirst, onRestore, onDelete, onViewDiff }: SnapshotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stats = getSnapshotStats(snapshot)

  return (
    <div className={`
      relative border rounded-lg p-3 transition-colors
      ${isFirst
        ? 'border-blue-500/50 bg-blue-500/5'
        : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
      }
    `}>
      {/* Timeline dot */}
      <div className={`
        absolute -left-[25px] top-4 w-3 h-3 rounded-full border-2
        ${isFirst
          ? 'bg-blue-500 border-blue-400'
          : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
        }
      `} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{snapshot.label}</div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] mt-0.5">
            <Clock className="w-3 h-3" />
            <span title={formatDate(snapshot.createdAt)}>
              {formatRelativeTime(snapshot.createdAt)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick stats (always visible) */}
      <div className="flex gap-3 mt-2 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1" title="챕터">
          <BookOpen className="w-3 h-3" /> {stats.chapters}
        </span>
        <span className="flex items-center gap-1" title="캐릭터">
          <Users className="w-3 h-3" /> {stats.characters}
        </span>
        <span className="flex items-center gap-1" title="위키">
          <FileText className="w-3 h-3" /> {stats.wikiEntries}
        </span>
        <span className="flex items-center gap-1" title="노드">
          <Map className="w-3 h-3" /> {stats.canvasNodes}
        </span>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-2">
          <button
            onClick={() => onViewDiff(snapshot)}
            className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            변경 비교
          </button>
          <button
            onClick={() => onRestore(snapshot.id)}
            className="flex-1 text-xs px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> 복원
          </button>
          {confirmDelete ? (
            <button
              onClick={() => { onDelete(snapshot.id); setConfirmDelete(false) }}
              className="text-xs px-2 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              확인
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
