/**
 * Context Summarizer: Compresses previous chapter data for AI context window.
 *
 * Strategy:
 * - Recent chapters get full/higher weight
 * - Older chapters get bullet-point summaries
 * - Active hooks (unresolved foreshadows) are always preserved,
 *   filtered to the current project only
 */
import type { Chapter } from '@/types'
import { useWorldStore } from '@/stores/worldStore'

const MAX_RECENT_CHAPTERS = 3
const MAX_SYNOPSIS_LENGTH = 200
const MAX_OLDER_CHAPTERS = 10

/**
 * Build a compressed summary of all chapters for AI context.
 *
 * @param chapters - Chapters already filtered to the current project.
 * @param projectId - Used to filter foreshadows to the current project only.
 */
export function summarizeContext(chapters: Chapter[], projectId: string): string {
  if (chapters.length === 0) return ''

  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const parts: string[] = []

  // Recent chapters (full synopsis)
  const recent = sorted.slice(-MAX_RECENT_CHAPTERS)
  const older = sorted.slice(0, Math.max(0, sorted.length - MAX_RECENT_CHAPTERS)).slice(-MAX_OLDER_CHAPTERS)

  if (older.length > 0) {
    parts.push('### 이전 챕터 요약')
    for (const ch of older) {
      const synopsis = ch.synopsis
        ? ch.synopsis.slice(0, MAX_SYNOPSIS_LENGTH) + (ch.synopsis.length > MAX_SYNOPSIS_LENGTH ? '...' : '')
        : '(시놉시스 없음)'
      parts.push(`- ${ch.title}: ${synopsis}`)
    }
    parts.push('')
  }

  if (recent.length > 0) {
    parts.push('### 최근 챕터')
    for (const ch of recent) {
      parts.push(`#### ${ch.title}`)
      if (ch.synopsis) {
        parts.push(ch.synopsis)
      } else {
        parts.push('(시놉시스 없음)')
      }
      parts.push('')
    }
  }

  // Active hooks: only foreshadows belonging to this project
  const foreshadows = useWorldStore.getState().foreshadows
  const activeHooks = foreshadows.filter(
    f => f.projectId === projectId && (f.status === 'planted' || f.status === 'hinted')
  )
  if (activeHooks.length > 0) {
    parts.push('### 미회수 복선')
    for (const hook of activeHooks) {
      const importance = hook.importance === 'critical' ? '⚠️' : hook.importance === 'high' ? '❗' : ''
      parts.push(`- ${importance}${hook.title}: ${hook.description || '(설명 없음)'}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}
