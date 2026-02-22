/**
 * Foreshadow Detector
 * Detects foreshadowing patterns and item acquisitions in text.
 */
import { useWorldStore } from '@/stores/worldStore'

export interface ForeshadowMatch {
  foreshadowId: string
  title: string
  matchedText: string
  position: number
}

export interface ItemMention {
  itemId: string
  itemName: string
  context: 'acquired' | 'mentioned' | 'lost'
  position: number
}

/**
 * Scan text for mentions of existing foreshadows.
 */
export function detectForeshadowMentions(text: string): ForeshadowMatch[] {
  const foreshadows = useWorldStore.getState().foreshadows
  const matches: ForeshadowMatch[] = []

  for (const fs of foreshadows) {
    if (!fs.title) continue
    // Check title and keywords in description
    const keywords = [fs.title]
    if (fs.description) {
      // Extract key nouns from description (simple: split by spaces, take 2+ char words)
      const descWords = fs.description.split(/\s+/).filter(w => w.length >= 2).slice(0, 5)
      keywords.push(...descWords)
    }

    for (const kw of keywords) {
      const idx = text.indexOf(kw)
      if (idx >= 0) {
        matches.push({
          foreshadowId: fs.id,
          title: fs.title,
          matchedText: kw,
          position: idx,
        })
        break // one match per foreshadow is enough
      }
    }
  }

  return matches
}

/**
 * Scan text for item acquisitions/mentions.
 */
export function detectItemMentions(text: string): ItemMention[] {
  const items = useWorldStore.getState().items
  const mentions: ItemMention[] = []

  const acquireKeywords = ['획득', '얻', '받았', '손에 넣', '주웠', '발견']
  const lostKeywords = ['잃', '빼앗', '떨어뜨', '버렸', '파괴']

  for (const item of items) {
    const idx = text.indexOf(item.name)
    if (idx < 0) continue

    // Check surrounding context (100 chars around)
    const start = Math.max(0, idx - 50)
    const end = Math.min(text.length, idx + item.name.length + 50)
    const context = text.slice(start, end)

    let mentionType: 'acquired' | 'mentioned' | 'lost' = 'mentioned'
    if (acquireKeywords.some(kw => context.includes(kw))) {
      mentionType = 'acquired'
    } else if (lostKeywords.some(kw => context.includes(kw))) {
      mentionType = 'lost'
    }

    mentions.push({
      itemId: item.id,
      itemName: item.name,
      context: mentionType,
      position: idx,
    })
  }

  return mentions
}
