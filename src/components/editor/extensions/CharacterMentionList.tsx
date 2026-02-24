import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { Character } from '@/types'

interface CharacterMentionListProps {
  items: Character[]
  command: (attrs: { id: string; label: string }) => void
}

export const CharacterMentionList = forwardRef<any, CharacterMentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => setSelectedIndex(0), [items])

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) {
        command({ id: item.id, label: item.name })
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="bg-bg-surface border border-border rounded-lg shadow-xl p-2 text-xs text-text-muted">
          캐릭터를 찾을 수 없습니다
        </div>
      )
    }

    const STATUS_COLORS: Record<string, string> = {
      alive: 'text-green-400',
      dead: 'text-red-400 line-through',
      missing: 'text-yellow-400',
      unknown: 'text-gray-400',
    }

    return (
      <div className="bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden max-h-[200px] overflow-y-auto min-w-[200px]">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition ${
              index === selectedIndex ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            {/* Avatar */}
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                {item.name.charAt(0)}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium truncate ${STATUS_COLORS[item.status] || ''}`}>
                  {item.name}
                </span>
                {item.status === 'dead' && (
                  <span className="text-[9px] text-red-400">&#x26A0;</span>
                )}
              </div>
              {(item.archetype && item.archetype !== 'other') && (
                <span className="text-[10px] text-text-muted truncate block">
                  {item.archetype}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  },
)

CharacterMentionList.displayName = 'CharacterMentionList'
