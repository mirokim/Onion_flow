/**
 * CharacterProminence - Bar chart showing character mention frequency.
 */
import { useMemo } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useWorldStore } from '@/stores/worldStore'

interface CharMention {
  name: string
  count: number
  role: string
}

function countCharacterMentions(): CharMention[] {
  const chapters = useProjectStore.getState().chapters
  const characters = useWorldStore.getState().characters
  if (characters.length === 0) return []

  // Combine all chapter text
  const fullText = chapters
    .map(ch => {
      if (!ch.content) return ''
      return JSON.stringify(ch.content)
    })
    .join(' ')

  return characters
    .map(char => {
      const names = [char.name, ...char.aliases]
      let count = 0
      for (const name of names) {
        if (!name) continue
        const matches = fullText.split(name).length - 1
        count += matches
      }
      return { name: char.name, count, role: char.role }
    })
    .sort((a, b) => b.count - a.count)
}

const roleColors: Record<string, string> = {
  protagonist: 'bg-blue-500',
  antagonist: 'bg-red-500',
  supporting: 'bg-green-500',
  minor: 'bg-gray-400',
}

export function CharacterProminence() {
  const characters = useWorldStore(s => s.characters)
  const mentions = useMemo(() => countCharacterMentions(), [characters])

  if (mentions.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-secondary)] text-center py-4">
        등록된 캐릭터가 없습니다
      </div>
    )
  }

  const maxCount = Math.max(1, mentions[0]?.count || 1)

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-[var(--color-text-secondary)]">캐릭터 비중</h3>
      <div className="space-y-1.5">
        {mentions.slice(0, 10).map(m => (
          <div key={m.name} className="flex items-center gap-2">
            <span className="text-xs w-16 truncate text-right">{m.name}</span>
            <div className="flex-1 h-4 bg-[var(--color-bg-tertiary)] rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm ${roleColors[m.role] || 'bg-gray-400'} transition-all`}
                style={{ width: `${Math.max(2, (m.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] w-8 text-right">{m.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
