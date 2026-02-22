/**
 * DiffViewer - Compares a snapshot against current state.
 */
import { useMemo } from 'react'
import { X, Plus, Minus, Edit3 } from 'lucide-react'
import type { TimelineSnapshot, Chapter } from '@/types'
import { useProjectStore } from '@/stores/projectStore'
import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useCanvasStore } from '@/stores/canvasStore'

interface DiffViewerProps {
  snapshot: TimelineSnapshot
  onClose: () => void
}

interface DiffEntry {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  category: string
  name: string
  details?: string
}

function computeDiffs(snapshot: TimelineSnapshot): DiffEntry[] {
  const diffs: DiffEntry[] = []

  try {
    // Chapter diffs
    const snapChapters: Chapter[] = JSON.parse(snapshot.manuscriptData)
    const currentChapters = useProjectStore.getState().chapters
    const snapChapterMap = new Map(snapChapters.map(c => [c.id, c]))
    const currentChapterMap = new Map(currentChapters.map(c => [c.id, c]))

    for (const [id, ch] of currentChapterMap) {
      const snapCh = snapChapterMap.get(id)
      if (!snapCh) {
        diffs.push({ type: 'added', category: '챕터', name: ch.title })
      } else if (JSON.stringify(snapCh.content) !== JSON.stringify(ch.content)) {
        const wcDiff = ch.wordCount - snapCh.wordCount
        diffs.push({
          type: 'modified',
          category: '챕터',
          name: ch.title,
          details: wcDiff !== 0 ? `글자 수: ${wcDiff > 0 ? '+' : ''}${wcDiff}` : '내용 변경됨',
        })
      }
    }
    for (const [id, ch] of snapChapterMap) {
      if (!currentChapterMap.has(id)) {
        diffs.push({ type: 'removed', category: '챕터', name: ch.title })
      }
    }

    // Character diffs
    const snapWorld = JSON.parse(snapshot.worldData)
    const currentWorld = useWorldStore.getState()
    const snapCharMap = new Map<string, any>((snapWorld.characters || []).map((c: any) => [c.id, c]))
    const curCharMap = new Map(currentWorld.characters.map(c => [c.id, c] as const))

    for (const [id, ch] of curCharMap) {
      if (!snapCharMap.has(id)) {
        diffs.push({ type: 'added', category: '캐릭터', name: ch.name })
      } else {
        const snapCh: any = snapCharMap.get(id)
        if (snapCh.name !== ch.name || snapCh.personality !== ch.personality || snapCh.appearance !== ch.appearance) {
          diffs.push({ type: 'modified', category: '캐릭터', name: ch.name })
        }
      }
    }
    for (const [id, ch] of snapCharMap) {
      if (!curCharMap.has(id)) {
        diffs.push({ type: 'removed', category: '캐릭터', name: (ch as any).name })
      }
    }

    // Wiki diffs
    const snapWiki = JSON.parse(snapshot.wikiData)
    const currentWiki = useWikiStore.getState().entries
    const snapWikiMap = new Map<string, any>(snapWiki.map((e: any) => [e.id, e]))
    const curWikiMap = new Map(currentWiki.map(e => [e.id, e] as const))

    for (const [id, entry] of curWikiMap) {
      if (!snapWikiMap.has(id)) {
        diffs.push({ type: 'added', category: '위키', name: entry.title })
      } else {
        const snapEntry: any = snapWikiMap.get(id)
        if (snapEntry.content !== entry.content || snapEntry.title !== entry.title) {
          diffs.push({ type: 'modified', category: '위키', name: entry.title })
        }
      }
    }
    for (const [id, entry] of snapWikiMap) {
      if (!curWikiMap.has(id)) {
        diffs.push({ type: 'removed', category: '위키', name: (entry as any).title })
      }
    }

    // Canvas node diffs
    const snapCanvas = JSON.parse(snapshot.canvasData)
    const currentNodes = useCanvasStore.getState().nodes
    const snapNodeIds = new Set((snapCanvas.nodes || []).map((n: any) => n.id))
    const curNodeIds = new Set(currentNodes.map(n => n.id))

    const addedNodes = currentNodes.filter(n => !snapNodeIds.has(n.id)).length
    const removedNodes = (snapCanvas.nodes || []).filter((n: any) => !curNodeIds.has(n.id)).length
    if (addedNodes > 0) {
      diffs.push({ type: 'added', category: '캔버스', name: `노드 ${addedNodes}개 추가` })
    }
    if (removedNodes > 0) {
      diffs.push({ type: 'removed', category: '캔버스', name: `노드 ${removedNodes}개 삭제` })
    }
  } catch (err) {
    console.error('[DiffViewer] Failed to compute diffs:', err)
  }

  return diffs
}

const typeIcon = {
  added: <Plus className="w-3.5 h-3.5 text-green-400" />,
  removed: <Minus className="w-3.5 h-3.5 text-red-400" />,
  modified: <Edit3 className="w-3.5 h-3.5 text-yellow-400" />,
  unchanged: null,
}

const typeColor = {
  added: 'text-green-400',
  removed: 'text-red-400',
  modified: 'text-yellow-400',
  unchanged: 'text-[var(--color-text-secondary)]',
}

export function DiffViewer({ snapshot, onClose }: DiffViewerProps) {
  const diffs = useMemo(() => computeDiffs(snapshot), [snapshot])

  const grouped = useMemo(() => {
    const map = new Map<string, DiffEntry[]>()
    for (const d of diffs) {
      const existing = map.get(d.category) || []
      existing.push(d)
      map.set(d.category, existing)
    }
    return map
  }, [diffs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-[500px] max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-sm font-semibold">변경 비교</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              "{snapshot.label}" 이후 변경 사항
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff list */}
        <div className="flex-1 overflow-y-auto p-4">
          {diffs.length === 0 ? (
            <div className="text-center text-sm text-[var(--color-text-secondary)] py-8">
              변경 사항 없음
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([category, entries]) => (
                <div key={category}>
                  <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                    {category} ({entries.length})
                  </h3>
                  <div className="space-y-1">
                    {entries.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--color-bg-secondary)] text-sm"
                      >
                        {typeIcon[entry.type]}
                        <span className={typeColor[entry.type]}>{entry.name}</span>
                        {entry.details && (
                          <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                            {entry.details}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>
            총 {diffs.length}개 변경:
            {' '}<span className="text-green-400">{diffs.filter(d => d.type === 'added').length} 추가</span>
            {' '}<span className="text-yellow-400">{diffs.filter(d => d.type === 'modified').length} 수정</span>
            {' '}<span className="text-red-400">{diffs.filter(d => d.type === 'removed').length} 삭제</span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
