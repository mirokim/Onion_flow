/**
 * Storyteller Engine: Assembles canvas node data into AI prompts.
 *
 * Flow:
 * 1. Collect all upstream nodes connected to StorytellerNode
 * 2. Process each node through its node processor
 * 3. Compress previous chapters via contextSummarizer
 * 4. Build system prompt from segments
 * 5. Call AI provider
 * 6. Return generated text
 */
import { useCanvasStore } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { callWithTools, type ProviderResponse } from './providers'
import { summarizeContext } from './contextSummarizer'
import { PLOT_GENRE_OPTIONS, PLOT_STRUCTURE_OPTIONS } from '@nodes/index'
import type { CanvasNode, AIProvider, AIAttachment } from '@/types'

interface PromptSegment {
  role: string
  content: string
  priority: number
}

/**
 * Process a canvas node into a prompt segment.
 * Wiki-linked nodes (character, personality, appearance, memory, event) fetch content from wiki store.
 */
function processNode(node: CanvasNode): PromptSegment | null {
  const wikiEntries = useWikiStore.getState().entries

  // Helper: lookup wiki entry with warning on missing
  const findWikiEntry = (nodeType: string) => {
    const wikiEntryId = node.data.wikiEntryId
    if (!wikiEntryId) {
      console.warn(`[StorytellerEngine] ${nodeType} 노드(${node.id})에 위키 항목이 선택되지 않았습니다.`)
      return null
    }
    const entry = wikiEntries.find(e => e.id === wikiEntryId)
    if (!entry) {
      console.warn(`[StorytellerEngine] ${nodeType} 노드(${node.id})의 위키 항목(${wikiEntryId})을 찾을 수 없습니다. (총 ${wikiEntries.length}개 로드됨)`)
    }
    return entry ?? null
  }

  switch (node.type) {
    case 'character': {
      const entry = findWikiEntry('character')
      const parts: string[] = []
      if (entry) parts.push(`[캐릭터: ${entry.title}]\n${entry.content}`)
      // Embedded sub-cards (personality, appearance, memory)
      const embeddedCards = [
        { key: 'personalityWikiEntryId', label: '성격 설정' },
        { key: 'appearanceWikiEntryId', label: '외모 설정' },
        { key: 'memoryWikiEntryId', label: '기억/배경' },
      ] as const
      for (const card of embeddedCards) {
        const id = node.data[card.key]
        if (id) {
          const sub = wikiEntries.find(e => e.id === id)
          if (sub) parts.push(`[${card.label}]\n${sub.content}`)
        }
      }
      if (parts.length === 0) return null
      return {
        role: 'character_context',
        content: parts.join('\n'),
        priority: 10,
      }
    }
    case 'event': {
      const entry = findWikiEntry('event')
      if (!entry) return null
      return {
        role: 'event_context',
        content: `[사건/환경]\n${entry.content}`,
        priority: 9,
      }
    }
    case 'wiki': {
      const entry = findWikiEntry('wiki')
      if (!entry) return null
      return {
        role: 'wiki_context',
        content: `[위키 데이터: ${entry.title}]\n${entry.content}`,
        priority: 8,
      }
    }
    case 'pov': {
      const povTypes: Record<string, string> = {
        first: '1인칭', second: '2인칭',
        third_limited: '3인칭 제한', third_omniscient: '3인칭 전지적',
      }
      const povType = node.data.povType as string || 'third_limited'
      const povLabel = povTypes[povType] || povType
      const charId = node.data.characterId as string | undefined
      const focusChar = charId
        ? wikiEntries.find(e => e.id === charId)?.title
        : undefined
      return {
        role: 'direction',
        content: `[시점 제어]\n시점: ${povLabel}${focusChar ? `\n초점 캐릭터: ${focusChar}` : ''}`,
        priority: 7,
      }
    }
    case 'pacing': {
      const tension = node.data.tension as number || 5
      const speedLabels: Record<string, string> = { slow: '느림', normal: '보통', fast: '빠름' }
      const speed = node.data.speed as string || 'normal'
      return {
        role: 'direction',
        content: `[텐션/호흡]\n긴장감: ${tension}/10\n호흡: ${speedLabels[speed] || speed}`,
        priority: 7,
      }
    }
    case 'style_transfer': {
      const sampleText = node.data.sampleText as string || ''
      const authorName = node.data.authorName as string || ''
      const parts: string[] = ['[문체 학습]']
      if (authorName) parts.push(`참고 작가: ${authorName}`)
      if (sampleText) parts.push(`다음 문체를 참고하여 작성:\n${sampleText}`)
      if (parts.length <= 1) return null
      return {
        role: 'direction',
        content: parts.join('\n'),
        priority: 6,
      }
    }
    case 'personality': {
      const entry = findWikiEntry('personality')
      if (!entry) return null
      return {
        role: 'character_context',
        content: `[성격 설정]\n${entry.content}`,
        priority: 10,
      }
    }
    case 'appearance': {
      const entry = findWikiEntry('appearance')
      if (!entry) return null
      return {
        role: 'character_context',
        content: `[외모 설정]\n${entry.content}`,
        priority: 10,
      }
    }
    case 'motivation': {
      const entry = findWikiEntry('motivation')
      if (!entry) return null
      return {
        role: 'character_context',
        content: `[캐릭터 동기]\n${entry.content}`,
        priority: 10,
      }
    }
    case 'memory': {
      const entry = findWikiEntry('memory')
      if (!entry) return null
      return {
        role: 'character_context',
        content: `[기억/배경]\n${entry.content}`,
        priority: 10,
      }
    }
    case 'image_load': {
      const images = (node.data.images || []) as Array<{ name: string }>
      if (images.length === 0) return null
      return {
        role: 'image_context',
        content: `[이미지 데이터] ${images.length}개 이미지가 첨부되었습니다 (${images.map(i => i.name).join(', ')}). 이미지를 참고하여 캐릭터의 외모, 분위기, 배경 등을 반영하세요.`,
        priority: 9,
      }
    }
    case 'document_load': {
      const docs = (node.data.documents || []) as Array<{ name: string; content: string; mimeType: string }>
      if (docs.length === 0) return null
      const textContent = docs
        .filter(d => d.content)
        .map(d => `[문서: ${d.name}]\n${d.content}`)
        .join('\n\n')
      if (!textContent) return null
      return {
        role: 'document_context',
        content: textContent,
        priority: 8,
      }
    }
    case 'plot_context': {
      // Unified plot node: genre + structure + wiki entry
      const parts: string[] = []
      const genreId = node.data.selectedGenre as string | undefined
      if (genreId) {
        const opt = PLOT_GENRE_OPTIONS.find(o => o.id === genreId)
        if (opt) {
          parts.push(`[플롯 장르: ${opt.label} (${opt.labelEn})]`)
          parts.push(opt.description)
        }
      }
      const structId = node.data.selectedStructure as string | undefined
      if (structId) {
        const opt = PLOT_STRUCTURE_OPTIONS.find(o => o.id === structId)
        if (opt) {
          parts.push(`[플롯 형식: ${opt.label} (${opt.labelEn})]`)
          parts.push(opt.description)
        }
      }
      const plotWikiId = node.data.wikiEntryId as string | undefined
      if (plotWikiId) {
        const plotEntry = wikiEntries.find(e => e.id === plotWikiId)
        if (plotEntry) {
          parts.push(`[플롯 상세: ${plotEntry.title}]`)
          if (plotEntry.content) parts.push(plotEntry.content)
        }
      }
      if (parts.length === 0) return null
      return { role: 'plot_context', content: parts.join('\n'), priority: 9 }
    }
    default:
      return null
  }
}

/**
 * Collect all upstream nodes connected to a storyteller node.
 */
function collectUpstreamNodes(storytellerNodeId: string): CanvasNode[] {
  const canvasStore = useCanvasStore.getState()
  return canvasStore.getUpstreamNodes(storytellerNodeId)
}

/**
 * Collect AIAttachment[] from upstream image_load and document_load nodes for multimodal AI.
 */
function collectUpstreamAttachments(storytellerNodeId: string): AIAttachment[] {
  const upstream = collectUpstreamNodes(storytellerNodeId)
  const attachments: AIAttachment[] = []

  for (const node of upstream) {
    if (node.type === 'image_load') {
      const images = (node.data.images || []) as Array<{
        id: string; name: string; data: string; mimeType: string
      }>
      for (const img of images) {
        attachments.push({
          type: 'image',
          name: img.name,
          data: img.data,
          mimeType: img.mimeType,
        })
      }
    }
    if (node.type === 'document_load') {
      const docs = (node.data.documents || []) as Array<{
        id: string; name: string; content: string; data?: string; mimeType: string
      }>
      for (const doc of docs) {
        if (doc.mimeType === 'application/pdf' && doc.data) {
          attachments.push({
            type: 'file',
            name: doc.name,
            data: doc.data,
            mimeType: 'application/pdf',
          })
        }
      }
    }
  }

  return attachments
}

/**
 * Build a complete prompt from canvas node data.
 */
export function buildStorytellerPrompt(storytellerNodeId: string): string {
  const upstream = collectUpstreamNodes(storytellerNodeId)
  const segments: PromptSegment[] = []

  for (const node of upstream) {
    const segment = processNode(node)
    if (segment) segments.push(segment)
  }

  // Sort by priority (higher first)
  segments.sort((a, b) => b.priority - a.priority)

  // Get story context from previous chapters
  const projectStore = useProjectStore.getState()
  const chapters = projectStore.chapters.filter(c => c.type === 'chapter')
  const contextSummary = summarizeContext(chapters)

  // Build the system prompt
  const parts: string[] = [
    '당신은 소설 집필 AI 어시스턴트입니다. 주어진 설정과 지시에 따라 소설 본문을 생성합니다.',
    '',
  ]

  if (contextSummary) {
    parts.push('## 이전 이야기 요약', contextSummary, '')
  }

  for (const seg of segments) {
    parts.push(seg.content, '')
  }

  // Add storyteller node's own instructions
  const storytellerNode = useCanvasStore.getState().nodes.find(n => n.id === storytellerNodeId)
  if (storytellerNode?.data.instructions) {
    parts.push('## 작가 지시사항', storytellerNode.data.instructions as string, '')
  }

  return parts.join('\n')
}

/**
 * Run the storyteller engine: build prompt from canvas, call AI, return text.
 */
export async function runStoryteller(storytellerNodeId: string): Promise<string> {
  const prompt = buildStorytellerPrompt(storytellerNodeId)
  const attachments = collectUpstreamAttachments(storytellerNodeId)
  const aiStore = useAIStore.getState()
  const canvasStore = useCanvasStore.getState()

  // Per-node provider override: use node.data.provider if set and enabled
  const node = canvasStore.nodes.find(n => n.id === storytellerNodeId)
  const nodeProvider = node?.data.provider as AIProvider | null | undefined
  const provider = (nodeProvider && aiStore.configs[nodeProvider]?.enabled)
    ? nodeProvider
    : aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const config = aiStore.configs[provider]
  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: '위 설정을 바탕으로 소설 본문을 이어 작성해 주세요.' },
  ]

  const response: ProviderResponse = await callWithTools(
    config,
    messages,
    false,
    attachments.length > 0 ? attachments : undefined,
  )
  return response.content
}
