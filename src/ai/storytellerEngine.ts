/**
 * Storyteller Engine: Assembles canvas node data into AI prompts.
 *
 * Flow:
 * 1. Collect all upstream nodes connected to StorytellerNode
 * 2. Process each node through its plugin's buildPromptSegment method
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
import { getPlugin } from '@nodes/index'
import type { CanvasNode, AIProvider, AIAttachment } from '@/types'
import type { PromptSegment } from '@nodes/plugin'

/**
 * Process a canvas node into a prompt segment via its plugin.
 */
function processNode(node: CanvasNode): PromptSegment | null {
  const wikiEntries = useWikiStore.getState().entries
  return getPlugin(node.type)?.buildPromptSegment?.(node, wikiEntries) ?? null
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
