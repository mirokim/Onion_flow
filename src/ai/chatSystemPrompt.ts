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

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  llama: 'Meta',
  grok: 'xAI',
}

export function buildChatSystemPrompt(projectId: string, provider?: string, model?: string): string {
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

  // ── Available tools reference ──
  parts.push('## 사용 가능한 도구')
  parts.push('반드시 아래 이름만 사용하세요. 존재하지 않는 도구 이름을 사용하면 오류가 발생합니다.')
  parts.push('')
  parts.push('### 인물')
  parts.push('- `update_character` — 인물 생성 또는 수정 (characterId 생략 시 새 인물 생성)')
  parts.push('- `delete_character` — 인물 삭제')
  parts.push('- `save_relation` — 인물 간 관계 생성/수정')
  parts.push('- `delete_relation` — 인물 간 관계 삭제')
  parts.push('- `analyze_character_emotions` — 캐릭터 감정 분석')
  parts.push('')
  parts.push('### 세계관·아이템·복선')
  parts.push('- `save_world_setting` — 세계관 설정 생성/수정')
  parts.push('- `delete_world_setting` — 세계관 설정 삭제')
  parts.push('- `save_item` — 아이템 생성/수정')
  parts.push('- `delete_item` — 아이템 삭제')
  parts.push('- `save_foreshadow` — 복선 생성/수정')
  parts.push('- `delete_foreshadow` — 복선 삭제')
  parts.push('')
  parts.push('### 위키')
  parts.push('- `create_wiki_entry` — 위키 항목 생성')
  parts.push('- `update_wiki_entry` — 위키 항목 수정')
  parts.push('- `delete_wiki_entry` — 위키 항목 삭제')
  parts.push('')
  parts.push('### 챕터·집필')
  parts.push('- `save_outline` — 챕터 아웃라인/시놉시스 저장')
  parts.push('- `write_chapter_content` — 챕터 본문 작성 (전체 교체)')
  parts.push('- `append_to_chapter` — 챕터 뒤에 내용 추가')
  parts.push('- `create_chapter` — 새 챕터 생성')
  parts.push('- `create_volume` — 새 권(볼륨) 생성')
  parts.push('- `rename_chapter` — 챕터/권 제목 변경')
  parts.push('')
  parts.push('### 조회·기타')
  parts.push('- `get_current_state` — 프로젝트 데이터 조회 (characters, world_settings, items, outline, foreshadows, relations, chapter_content, wiki_entries)')
  parts.push('- `create_version_snapshot` — 엔티티 버전 스냅샷 저장')
  parts.push('- `respond` — 사용자에게 텍스트 응답')
  parts.push('')

  const providerName = provider ? (PROVIDER_DISPLAY_NAMES[provider] || provider) : ''
  const modelName = model || ''
  const identityLine = providerName && modelName
    ? `\n\n## 당신의 정보\n- 제조사: ${providerName}\n- 모델: ${modelName}\n- 사용자가 당신의 이름이나 별명을 지어주면, 그것은 당신(AI)에 대한 호칭이지 소설 캐릭터가 아닙니다.`
    : ''

  const baseInstruction = `당신은 소설 집필을 돕는 AI 어시스턴트입니다.${identityLine}

## 중요 행동 규칙
- 도구는 사용자가 **명확하게 작업을 요청**했을 때만 사용하세요.
- 인사, 질문, 잡담, 감상 등 일반적인 대화에는 도구를 사용하지 말고 텍스트로만 응답하세요.
- 사용자가 이름을 언급하는 것만으로 캐릭터를 생성/수정하지 마세요. "~를 만들어줘", "~를 등록해줘", "~를 추가해줘" 같은 명시적 요청이 있어야 합니다.
- 사용자가 당신에게 이름/별명을 지어주거나 당신의 이름을 부르는 것은 대화일 뿐, 캐릭터 생성 요청이 아닙니다.
- 애매한 경우에는 먼저 "~을(를) 원하시나요?"라고 확인하세요.
- 도구 실행 전에 사용자의 의도를 정확히 파악하는 것이 최우선입니다.`

  if (parts.length === 0) {
    return baseInstruction + '\n\n사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.'
  }

  const header = baseInstruction + '\n\n아래는 현재 프로젝트의 컨텍스트입니다. 사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.\n\n'
  return header + parts.join('\n')
}
