/**
 * System prompt builder for AI chat.
 * Assembles project context (characters, world settings, chapters, foreshadows)
 * into a structured system prompt for the AI.
 */
import { useProjectStore } from '@/stores/projectStore'
import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import { summarizeContext } from './contextSummarizer'

const MAX_CHARACTERS_IN_PROMPT = 15
const MAX_WORLD_SETTINGS_IN_PROMPT = 20

export function buildChatSystemPrompt(projectId: string): string {
  const parts: string[] = []

  // ── Project info ──
  const { currentProject, chapters } = useProjectStore.getState()
  if (currentProject && currentProject.id === projectId) {
    parts.push('## 프로젝트 정보')
    parts.push(`- 제목: ${currentProject.title}`)
    if (currentProject.genre) parts.push(`- 장르: ${currentProject.genre}`)
    if (currentProject.synopsis) parts.push(`- 시놉시스: ${currentProject.synopsis}`)
    parts.push('')
  }

  // ── Characters ──
  const { characters, worldSettings, foreshadows, relations } = useWorldStore.getState()
  const projectChars = characters.filter(c => c.projectId === projectId).slice(0, MAX_CHARACTERS_IN_PROMPT)
  if (projectChars.length > 0) {
    parts.push('## 등장인물')
    for (const ch of projectChars) {
      const tags = ch.tags.length > 0 ? ` [${ch.tags.join(', ')}]` : ''
      parts.push(`### ${ch.name} (${ch.role})${tags}`)
      if (ch.personality) parts.push(`- 성격: ${ch.personality}`)
      if (ch.appearance) parts.push(`- 외모: ${ch.appearance}`)
      if (ch.motivation) parts.push(`- 동기: ${ch.motivation}`)
      if (ch.speechPattern) parts.push(`- 말투: ${ch.speechPattern}`)
    }
    parts.push('')
  }

  // ── Character Relations ──
  const projectRelations = relations.filter(r => r.projectId === projectId)
  if (projectRelations.length > 0) {
    parts.push('## 인물 관계')
    for (const rel of projectRelations) {
      const src = characters.find(c => c.id === rel.sourceId)?.name || '?'
      const tgt = characters.find(c => c.id === rel.targetId)?.name || '?'
      const dir = rel.isBidirectional ? '↔' : '→'
      parts.push(`- ${src} ${dir} ${tgt}: ${rel.relationType}${rel.description ? ` (${rel.description})` : ''}`)
    }
    parts.push('')
  }

  // ── World Settings ──
  const projectSettings = worldSettings.filter(w => w.projectId === projectId).slice(0, MAX_WORLD_SETTINGS_IN_PROMPT)
  if (projectSettings.length > 0) {
    parts.push('## 세계관 설정')
    for (const ws of projectSettings) {
      const truncated = ws.content.length > 200 ? ws.content.slice(0, 200) + '...' : ws.content
      parts.push(`- [${ws.category}] ${ws.title}: ${truncated}`)
    }
    parts.push('')
  }

  // ── Wiki entries ──
  const wikiEntries = useWikiStore.getState().entries.filter(e => e.projectId === projectId)
  if (wikiEntries.length > 0) {
    parts.push('## 위키')
    const grouped = new Map<string, typeof wikiEntries>()
    for (const entry of wikiEntries) {
      const list = grouped.get(entry.category) || []
      list.push(entry)
      grouped.set(entry.category, list)
    }
    for (const [category, entries] of grouped) {
      parts.push(`### ${category}`)
      for (const entry of entries.slice(0, 20)) {
        const truncated = entry.content.length > 100 ? entry.content.slice(0, 100) + '...' : entry.content
        const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : ''
        parts.push(`- ${entry.title}${tags}: ${truncated || '(빈 내용)'}`)
      }
    }
    parts.push('')
  }

  // ── Chapter context ──
  const projectChapters = chapters.filter(c => c.projectId === projectId && c.type === 'chapter')
  const chapterContext = summarizeContext(projectChapters)
  if (chapterContext) {
    parts.push(chapterContext)
  }

  // ── Active foreshadows (already included in summarizeContext, but ensure coverage) ──
  const activeForeshadows = foreshadows.filter(
    f => f.projectId === projectId && (f.status === 'planted' || f.status === 'hinted')
  )
  // summarizeContext already adds foreshadows, skip if already included

  if (parts.length === 0) {
    return '당신은 소설 집필을 돕는 AI 어시스턴트입니다. 사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.'
  }

  const header = '당신은 소설 집필을 돕는 AI 어시스턴트입니다. 아래는 현재 프로젝트의 컨텍스트입니다. 사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.\n\n'
  return header + parts.join('\n')
}
