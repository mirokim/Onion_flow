import { useMemo } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import type { WikiCategory, WikiEntry } from '@/types'

interface CharacterNodeBodyProps {
  data: Record<string, any>
  nodeId: string
}

/** Mini-card definition for embedded sub-cards */
interface MiniCard {
  key: 'personalityWikiEntryId' | 'appearanceWikiEntryId' | 'memoryWikiEntryId'
  label: string
  category: WikiCategory
  color: string
}

const MINI_CARDS: MiniCard[] = [
  { key: 'personalityWikiEntryId', label: '성격', category: 'character_personality', color: '#6366f1' },
  { key: 'appearanceWikiEntryId', label: '외모', category: 'character_appearance', color: '#f59e0b' },
  { key: 'memoryWikiEntryId', label: '기억', category: 'character_memory', color: '#10b981' },
]

export function CharacterNodeBody({ data, nodeId }: CharacterNodeBodyProps) {
  const allWikiEntries = useWikiStore(s => s.entries)

  // Pre-filter entries for each category
  const entriesByCategory = useMemo(() => {
    const map: Record<string, WikiEntry[]> = {}
    for (const card of MINI_CARDS) {
      map[card.category] = allWikiEntries.filter(e => e.category === card.category)
    }
    return map
  }, [allWikiEntries])

  return (
    <div className="mt-2 space-y-1">
      {/* Position dropdown */}
      <select
        value={data.position || 'neutral'}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { position: e.target.value })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="neutral">중립</option>
        <option value="rival">라이벌</option>
        <option value="villain">악역</option>
        <option value="friend">친구</option>
        <option value="mentor">멘토</option>
        <option value="sidekick">조수/파트너</option>
        <option value="love_interest">연인</option>
        <option value="family">가족</option>
        <option value="subordinate">부하</option>
        <option value="custom">기타</option>
      </select>

      {/* Embedded mini-cards */}
      {MINI_CARDS.map((card) => {
        const selectedId = data[card.key] as string | null
        const entries = entriesByCategory[card.category] || []
        const selectedEntry = selectedId
          ? allWikiEntries.find(e => e.id === selectedId)
          : undefined

        return (
          <div
            key={card.key}
            className="rounded border overflow-hidden"
            style={{ borderColor: card.color + '40' }}
          >
            {/* Mini-card header */}
            <div
              className="px-2 py-0.5 text-[9px] font-semibold text-white flex items-center gap-1"
              style={{ backgroundColor: card.color + 'cc' }}
            >
              <span>{card.label}</span>
            </div>

            {/* Mini-card body */}
            <div className="px-1.5 py-1 bg-bg-primary/30">
              <select
                value={selectedId || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(nodeId, {
                    [card.key]: e.target.value || null,
                  })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1 py-0.5 text-[9px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="">선택...</option>
                {entries.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title || 'Untitled'}
                  </option>
                ))}
              </select>

              {selectedEntry?.content && (
                <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1 py-0.5 max-h-[40px] overflow-y-auto">
                  {selectedEntry.content.length > 80
                    ? selectedEntry.content.slice(0, 80) + '...'
                    : selectedEntry.content}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
