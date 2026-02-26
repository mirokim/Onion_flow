/**
 * System prompt builder for AI chat.
 * Assembles project context (characters, world settings, chapters, foreshadows)
 * into a structured system prompt for the AI.
 */
import { useProjectStore } from '@/stores/projectStore'
import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import { summarizeContext } from './contextSummarizer'
import type { Character, CharacterRelation, WorldSetting, WikiEntry } from '@/types'

const MAX_CHARACTERS_IN_PROMPT = 15
const MAX_WORLD_SETTINGS_IN_PROMPT = 20
const MAX_TOTAL_WIKI_ENTRIES = 50

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  llama: 'Meta',
  grok: 'xAI',
}

// ── Section builders ──

function buildCharactersSection(
  projectChars: Character[],
  allChars: Character[],
  relations: CharacterRelation[],
  projectId: string,
): string {
  const lines: string[] = []

  if (projectChars.length > 0) {
    lines.push('## 등장인물')
    for (const ch of projectChars) {
      const tags = ch.tags.length > 0 ? ` [${ch.tags.join(', ')}]` : ''
      lines.push(`### ${ch.name} (${ch.role})${tags}`)
      if (ch.personality) lines.push(`- 성격: ${ch.personality}`)
      if (ch.appearance) lines.push(`- 외모: ${ch.appearance}`)
      if (ch.motivation) lines.push(`- 동기: ${ch.motivation}`)
      if (ch.speechPattern) lines.push(`- 말투: ${ch.speechPattern}`)
    }
    lines.push('')
  }

  const projectRelations = relations.filter(r => r.projectId === projectId)
  if (projectRelations.length > 0) {
    lines.push('## 인물 관계')
    for (const rel of projectRelations) {
      const src = allChars.find(c => c.id === rel.sourceId)?.name || '?'
      const tgt = allChars.find(c => c.id === rel.targetId)?.name || '?'
      const dir = rel.isBidirectional ? '↔' : '→'
      lines.push(`- ${src} ${dir} ${tgt}: ${rel.relationType}${rel.description ? ` (${rel.description})` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildWorldSettingsSection(settings: WorldSetting[]): string {
  if (settings.length === 0) return ''
  const lines: string[] = ['## 세계관 설정']
  for (const ws of settings) {
    const truncated = ws.content.length > 200 ? ws.content.slice(0, 200) + '...' : ws.content
    lines.push(`- [${ws.category}] ${ws.title}: ${truncated}`)
  }
  lines.push('')
  return lines.join('\n')
}

function buildWikiSection(entries: WikiEntry[]): string {
  if (entries.length === 0) return ''
  const lines: string[] = ['## 위키']

  const grouped = new Map<string, WikiEntry[]>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let totalCount = 0
  for (const [category, categoryEntries] of grouped) {
    if (totalCount >= MAX_TOTAL_WIKI_ENTRIES) break
    lines.push(`### ${category}`)
    for (const entry of categoryEntries) {
      if (totalCount >= MAX_TOTAL_WIKI_ENTRIES) break
      const truncated = entry.content.length > 100 ? entry.content.slice(0, 100) + '...' : entry.content
      const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : ''
      lines.push(`- ${entry.title}${tags}: ${truncated || '(빈 내용)'}`)
      totalCount++
    }
  }
  lines.push('')
  return lines.join('\n')
}

function buildToolReferenceSection(): string {
  return [
    '## 사용 가능한 도구',
    '반드시 아래 이름만 사용하세요. 존재하지 않는 도구 이름을 사용하면 오류가 발생합니다.',
    '',
    '### 인물',
    '- `update_character` — 인물 생성 또는 수정 (characterId 생략 시 새 인물 생성)',
    '- `delete_character` — 인물 삭제',
    '- `save_relation` — 인물 간 관계 생성/수정',
    '- `delete_relation` — 인물 간 관계 삭제',
    '- `analyze_character_emotions` — 캐릭터 감정 분석',
    '',
    '### 세계관·아이템·복선',
    '- `save_world_setting` — 세계관 설정 생성/수정',
    '- `delete_world_setting` — 세계관 설정 삭제',
    '- `save_item` — 아이템 생성/수정',
    '- `delete_item` — 아이템 삭제',
    '- `save_foreshadow` — 복선 생성/수정',
    '- `delete_foreshadow` — 복선 삭제',
    '',
    '### 위키',
    '- `create_wiki_entry` — 위키 항목 생성',
    '- `update_wiki_entry` — 위키 항목 수정',
    '- `delete_wiki_entry` — 위키 항목 삭제',
    '',
    '### 챕터·집필',
    '- `save_outline` — 챕터 아웃라인/시놉시스 저장',
    '- `write_chapter_content` — 챕터 본문 작성 (전체 교체)',
    '- `append_to_chapter` — 챕터 뒤에 내용 추가',
    '- `create_chapter` — 새 챕터 생성',
    '- `create_volume` — 새 권(볼륨) 생성',
    '- `rename_chapter` — 챕터/권 제목 변경',
    '',
    '### 조회·기타',
    '- `get_current_state` — 프로젝트 데이터 조회 (characters, world_settings, items, outline, foreshadows, relations, chapter_content, wiki_entries)',
    '- `create_version_snapshot` — 엔티티 버전 스냅샷 저장',
    '- `respond` — 사용자에게 텍스트 응답',
    '',
  ].join('\n')
}

// ── Main builder ──

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

  // ── Characters & Relations ──
  const { characters, worldSettings, relations } = useWorldStore.getState()
  const projectChars = characters.filter(c => c.projectId === projectId).slice(0, MAX_CHARACTERS_IN_PROMPT)
  parts.push(buildCharactersSection(projectChars, characters, relations, projectId))

  // ── World Settings ──
  const projectSettings = worldSettings.filter(w => w.projectId === projectId).slice(0, MAX_WORLD_SETTINGS_IN_PROMPT)
  parts.push(buildWorldSettingsSection(projectSettings))

  // ── Wiki entries ──
  const wikiEntries = useWikiStore.getState().entries.filter(e => e.projectId === projectId)
  parts.push(buildWikiSection(wikiEntries))

  // ── Chapter context ──
  const projectChapters = chapters.filter(c => c.projectId === projectId && c.type === 'chapter')
  const chapterContext = summarizeContext(projectChapters, projectId)
  if (chapterContext) {
    parts.push(chapterContext)
  }

  // ── Available tools reference ──
  parts.push(buildToolReferenceSection())

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
- 도구 실행 전에 사용자의 의도를 정확히 파악하는 것이 최우선입니다.
- **도구 실행 후에는 반드시 결과를 텍스트로 요약하여 사용자에게 응답하세요.** 같은 도구를 반복 호출하지 마세요.
- 사용자가 "하나 추가해줘"라고 하면 **정확히 1개만** 추가하세요. 여러 번 같은 도구를 호출하지 마세요.
- 도구가 성공적으로 실행되면, 추가적인 도구 호출 없이 결과를 \`respond\` 또는 텍스트로 보고하세요.`

  const nonEmptyParts = parts.filter(p => p.trim().length > 0)
  if (nonEmptyParts.length === 0) {
    return baseInstruction + '\n\n사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.'
  }

  const header = baseInstruction + '\n\n아래는 현재 프로젝트의 컨텍스트입니다. 사용자의 요청에 도구(tool)를 활용하여 캐릭터, 세계관, 아이템, 복선, 위키 등을 관리하고, 스토리 작성을 지원합니다.\n\n'
  return header + parts.join('\n')
}
