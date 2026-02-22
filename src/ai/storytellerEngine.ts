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
import { useWorldStore } from '@/stores/worldStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { callWithTools, type ProviderResponse } from './providers'
import { summarizeContext } from './contextSummarizer'
import type { CanvasNode, AIProvider } from '@/types'

interface PromptSegment {
  role: string
  content: string
  priority: number
}

/**
 * Process a canvas node into a prompt segment.
 */
function processNode(node: CanvasNode): PromptSegment | null {
  const worldStore = useWorldStore.getState()

  switch (node.type) {
    case 'character': {
      const charId = node.data.characterId as string | undefined
      if (!charId) return null
      const char = worldStore.characters.find(c => c.id === charId)
      if (!char) return null
      return {
        role: 'character_context',
        content: `[캐릭터: ${char.name}]\n역할: ${char.role}\n성격: ${char.personality}\n말투: ${char.speechPattern}\n배경: ${char.background}\n동기: ${char.motivation}`,
        priority: 10,
      }
    }
    case 'event': {
      const desc = node.data.description as string || ''
      const setting = node.data.setting as string || ''
      return {
        role: 'event_context',
        content: `[사건/환경]\n${desc}${setting ? `\n배경: ${setting}` : ''}`,
        priority: 9,
      }
    }
    case 'wiki': {
      const wikiId = node.data.wikiEntryId as string | undefined
      if (!wikiId) return null
      return {
        role: 'wiki_context',
        content: `[위키 데이터: ${node.data.title || wikiId}]\n${node.data.content || ''}`,
        priority: 8,
      }
    }
    case 'pov': {
      const perspective = node.data.perspective as string || '3인칭'
      const focusChar = node.data.focusCharacter as string || ''
      return {
        role: 'direction',
        content: `[시점 제어]\n시점: ${perspective}${focusChar ? `\n초점 캐릭터: ${focusChar}` : ''}`,
        priority: 7,
      }
    }
    case 'pacing': {
      const tension = node.data.tension as number || 5
      const pace = node.data.pace as string || '보통'
      return {
        role: 'direction',
        content: `[텐션/호흡]\n긴장감: ${tension}/10\n호흡: ${pace}`,
        priority: 7,
      }
    }
    case 'style_transfer': {
      const style = node.data.styleSample as string || ''
      return {
        role: 'direction',
        content: `[문체 학습]\n다음 문체를 참고하여 작성:\n${style}`,
        priority: 6,
      }
    }
    case 'personality': {
      const text = node.data.text as string || ''
      if (!text) return null
      return {
        role: 'character_context',
        content: `[성격 설정]\n${text}`,
        priority: 10,
      }
    }
    case 'appearance': {
      const text = node.data.text as string || ''
      if (!text) return null
      return {
        role: 'character_context',
        content: `[외모 설정]\n${text}`,
        priority: 10,
      }
    }
    case 'memory': {
      const text = node.data.text as string || ''
      if (!text) return null
      return {
        role: 'character_context',
        content: `[기억/배경]\n${text}`,
        priority: 10,
      }
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

  const response: ProviderResponse = await callWithTools(config, messages, false)
  return response.content
}
