/**
 * Execution Engine — ComfyUI-style canvas execution.
 *
 * Flow:
 * 1. Collect all nodes at current depth
 * 2. Build dependency graph from wires
 * 3. Topological sort (Kahn's algorithm)
 * 4. Execute each executable node in order
 * 5. Report status via callback
 *
 * Non-executable nodes (context, direction, structure) are skipped.
 * Their data is collected by upstream traversal when executable nodes run.
 */
import { useCanvasStore, type NodeOutput } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useAIStore } from '@/stores/aiStore'
import { runStoryteller, buildStorytellerPrompt } from './storytellerEngine'
import { processWhatIf } from './nodeProcessors/whatIfProcessor'
import { processShowDontTell } from './nodeProcessors/showDontTellProcessor'
import { processTikitaka } from './nodeProcessors/tikitakaProcessor'
import { processCliffhanger } from './nodeProcessors/cliffhangerProcessor'
import { processVirtualReader } from './nodeProcessors/virtualReaderProcessor'
import type { CanvasNode, CanvasWire } from '@/types'

/** Node types that can be executed (have AI processing) */
const EXECUTABLE_TYPES = new Set([
  'storyteller',
  'summarizer',
  'save_story',
  'what_if',
  'show_dont_tell',
  'tikitaka',
  'cliffhanger',
  'virtual_reader',
  'emotion_tracker',
  'foreshadow_detector',
  'conflict_defense',
])

/**
 * Topological sort using Kahn's algorithm.
 * Returns nodes in execution order (upstream first).
 */
function topologicalSort(nodes: CanvasNode[], wires: CanvasWire[]): CanvasNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // Initialize
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  }

  // Build adjacency from wires
  for (const w of wires) {
    if (!nodeMap.has(w.sourceNodeId) || !nodeMap.has(w.targetNodeId)) continue
    adjacency.get(w.sourceNodeId)!.push(w.targetNodeId)
    inDegree.set(w.targetNodeId, (inDegree.get(w.targetNodeId) || 0) + 1)
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: CanvasNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  return sorted
}

/**
 * Collect upstream context text for a given node.
 */
function collectUpstreamContext(nodeId: string): string {
  const { nodes, wires, nodeOutputs } = useCanvasStore.getState()
  const visited = new Set<string>()
  const parts: string[] = []

  const traverse = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const incoming = wires.filter(w => w.targetNodeId === id)
    for (const wire of incoming) {
      const sourceNode = nodes.find(n => n.id === wire.sourceNodeId)
      if (!sourceNode) continue

      // If the upstream node has already been executed, use its output
      const output = nodeOutputs[sourceNode.id]
      if (output?.status === 'completed' && output.content) {
        parts.push(output.content)
      } else {
        // For context/direction nodes, extract their data
        const nodeData = extractNodeDataText(sourceNode)
        if (nodeData) parts.push(nodeData)
      }

      traverse(sourceNode.id)
    }
  }

  traverse(nodeId)
  return parts.join('\n\n')
}

/**
 * Collect character names from upstream character nodes (for tagging).
 */
function collectUpstreamCharacterNames(nodeId: string): string[] {
  const { nodes, wires } = useCanvasStore.getState()
  const wikiEntries = useWikiStore.getState().entries
  const visited = new Set<string>()
  const names: string[] = []

  const traverse = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const incoming = wires.filter(w => w.targetNodeId === id)
    for (const wire of incoming) {
      const sourceNode = nodes.find(n => n.id === wire.sourceNodeId)
      if (!sourceNode) continue
      if (sourceNode.type === 'character' && sourceNode.data.wikiEntryId) {
        const entry = wikiEntries.find(e => e.id === sourceNode.data.wikiEntryId)
        if (entry?.title) names.push(entry.title)
      }
      traverse(sourceNode.id)
    }
  }

  traverse(nodeId)
  return names
}

/**
 * Extract displayable text from a context/direction node's data.
 * Wiki-linked nodes (character, personality, appearance, memory, event) fetch content from wiki store.
 */
function extractNodeDataText(node: CanvasNode): string | null {
  const wikiEntries = useWikiStore.getState().entries

  // Helper: lookup wiki entry with warning on missing
  const findWikiEntry = (nodeType: string) => {
    const wikiEntryId = node.data.wikiEntryId
    if (!wikiEntryId) {
      console.warn(`[ExecutionEngine] ${nodeType} 노드(${node.id})에 위키 항목이 선택되지 않았습니다.`)
      return null
    }
    const entry = wikiEntries.find(e => e.id === wikiEntryId)
    if (!entry) {
      console.warn(`[ExecutionEngine] ${nodeType} 노드(${node.id})의 위키 항목(${wikiEntryId})을 찾을 수 없습니다. (총 ${wikiEntries.length}개 로드됨)`)
    }
    return entry ?? null
  }

  switch (node.type) {
    case 'character': {
      const entry = findWikiEntry('character')
      const parts: string[] = []
      if (entry) parts.push(`[캐릭터: ${entry.title}] ${entry.content}`)
      // Embedded sub-cards (personality, appearance, memory)
      const embeddedCards = [
        { key: 'personalityWikiEntryId', label: '성격' },
        { key: 'appearanceWikiEntryId', label: '외모' },
        { key: 'memoryWikiEntryId', label: '기억' },
      ] as const
      for (const card of embeddedCards) {
        const id = node.data[card.key]
        if (id) {
          const sub = wikiEntries.find(e => e.id === id)
          if (sub) parts.push(`[${card.label}] ${sub.content}`)
        }
      }
      return parts.length > 0 ? parts.join('\n') : null
    }
    case 'event': {
      const entry = findWikiEntry('event')
      return entry ? `[사건] ${entry.content}` : null
    }
    case 'wiki': {
      const entry = findWikiEntry('wiki')
      return entry ? `[위키: ${entry.title}] ${entry.content}` : null
    }
    case 'pov': {
      const perspective = node.data.perspective || '3인칭'
      return `[시점] ${perspective}`
    }
    case 'pacing': {
      const tension = node.data.tension || 5
      return `[텐션] ${tension}/10`
    }
    case 'style_transfer': {
      const style = node.data.styleSample || ''
      return style ? `[문체] ${style.slice(0, 100)}...` : null
    }
    case 'personality': {
      const entry = findWikiEntry('personality')
      return entry ? `[성격] ${entry.content}` : null
    }
    case 'appearance': {
      const entry = findWikiEntry('appearance')
      return entry ? `[외모] ${entry.content}` : null
    }
    case 'memory': {
      const entry = findWikiEntry('memory')
      return entry ? `[기억] ${entry.content}` : null
    }
    case 'image_load': {
      const images = (node.data.images || []) as Array<{ name: string }>
      if (images.length === 0) return null
      return `[이미지 데이터] ${images.length}개 이미지 첨부됨: ${images.map(i => i.name).join(', ')}`
    }
    case 'document_load': {
      const docs = (node.data.documents || []) as Array<{ name: string; content: string; mimeType: string }>
      if (docs.length === 0) return null
      const textParts = docs
        .filter(d => d.content)
        .map(d => `[문서: ${d.name}]\n${d.content}`)
      const pdfNames = docs
        .filter(d => d.mimeType === 'application/pdf' && !d.content)
        .map(d => d.name)
      const parts: string[] = [...textParts]
      if (pdfNames.length > 0) {
        parts.push(`[PDF 파일: ${pdfNames.join(', ')}]`)
      }
      return parts.length > 0 ? parts.join('\n\n') : null
    }
    case 'plot_context': {
      // plot_context passes through connected plot node data via upstream traversal
      return null
    }
    default: {
      // Handle plot nodes dynamically
      if (node.type.startsWith('plot_')) {
        const plotName = node.data.label || node.type
        const desc = node.data.description || ''
        return `[플롯: ${plotName}] ${desc}`
      }
      return null
    }
  }
}

/**
 * Execute a single node based on its type.
 */
async function executeNode(node: CanvasNode): Promise<string> {
  const context = collectUpstreamContext(node.id)

  switch (node.type) {
    case 'storyteller': {
      return await runStoryteller(node.id)
    }

    case 'summarizer': {
      // Summarizer condenses upstream context
      if (!context) return '요약할 컨텍스트가 없습니다.'
      const { callWithTools } = await import('./providers')
      const aiStore = useAIStore.getState()
      const provider = aiStore.activeProviders[0]
      if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
      const config = aiStore.configs[provider]
      const messages = [
        { role: 'system', content: '당신은 소설 요약 전문가입니다. 주어진 텍스트를 핵심만 남겨 간결하게 요약하세요.' },
        { role: 'user', content: `다음 내용을 요약해 주세요:\n\n${context}` },
      ]
      const resp = await callWithTools(config, messages, false)
      return resp.content
    }

    case 'what_if': {
      const currentScene = node.data.scene || context || ''
      const result = await processWhatIf(currentScene, context)
      return `## 분기 A\n${result.branchA}\n\n## 분기 B\n${result.branchB}`
    }

    case 'show_dont_tell': {
      const inputText = node.data.inputText || context || ''
      if (!inputText) return '변환할 텍스트가 없습니다.'
      return await processShowDontTell(inputText)
    }

    case 'tikitaka': {
      const characterIds = (node.data.characterIds || []) as string[]
      const topic = (node.data.topic || '') as string
      if (characterIds.length < 2) return '최소 2명의 캐릭터가 필요합니다.'
      return await processTikitaka(characterIds, topic, context)
    }

    case 'cliffhanger': {
      const chapterContent = node.data.chapterContent || context || ''
      if (!chapterContent) return '분석할 챕터 내용이 없습니다.'
      const suggestions = await processCliffhanger(chapterContent)
      return suggestions.map((s, i) => `${i + 1}. [${s.type}] ${s.text}`).join('\n\n')
    }

    case 'virtual_reader': {
      const content = node.data.content || context || ''
      if (!content) return '분석할 콘텐츠가 없습니다.'
      const personas = node.data.selectedPersonas as string[] | undefined
      const comments = await processVirtualReader(content, personas)
      return comments.map(c => `**${c.persona}** (${c.rating}/10)\n${c.comment}`).join('\n\n')
    }

    case 'save_story': {
      if (!context) return '저장할 스토리 내용이 없습니다.'
      const { nodes } = useCanvasStore.getState()
      const projectId = node.projectId || nodes[0]?.projectId
      if (!projectId) return '프로젝트 ID를 찾을 수 없습니다.'

      // Collect character names from upstream for tags
      const characterTags = collectUpstreamCharacterNames(node.id)
      const dateTag = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const title = `Story - ${new Date().toLocaleString('ko-KR')}`
      const tags = [dateTag, ...characterTags]

      const wikiStore = useWikiStore.getState()
      const entry = await wikiStore.createEntry(projectId, 'story', title)
      await wikiStore.updateEntry(entry.id, { content: context, tags })

      return `위키에 "${title}" 저장 완료 (${context.length}자, 태그: ${tags.join(', ')})\n\n---\n\n${context}`
    }

    case 'emotion_tracker':
    case 'foreshadow_detector':
    case 'conflict_defense': {
      // Detector nodes — analyze upstream context
      if (!context) return '분석할 데이터가 없습니다.'
      const { callWithTools } = await import('./providers')
      const aiStore = useAIStore.getState()
      const provider = aiStore.activeProviders[0]
      if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
      const config = aiStore.configs[provider]

      const prompts: Record<string, string> = {
        emotion_tracker: '다음 텍스트에서 각 캐릭터의 감정 변화를 추적하고 분석해 주세요.',
        foreshadow_detector: '다음 텍스트에서 복선(foreshadowing) 요소를 찾아 분석해 주세요.',
        conflict_defense: '다음 텍스트에서 갈등 구조를 분석하고, 서사적 방어 메커니즘을 점검해 주세요.',
      }

      const messages = [
        { role: 'system', content: `당신은 소설 분석 전문가입니다. ${prompts[node.type]}` },
        { role: 'user', content: context },
      ]
      const resp = await callWithTools(config, messages, false)
      return resp.content
    }

    default:
      return `노드 타입 "${node.type}"은(는) 실행할 수 없습니다.`
  }
}

/**
 * Execute the entire canvas graph.
 * Follows topological order, executing only EXECUTABLE_TYPES nodes.
 */
export async function executeCanvas(
  callback: (nodeId: string, output: NodeOutput) => void,
): Promise<void> {
  const { nodes, wires } = useCanvasStore.getState()
  const parentId = useCanvasStore.getState().getCurrentParentCanvasId()

  // Filter to current depth
  const depthNodes = nodes.filter(n => n.parentCanvasId === parentId)
  const depthWires = wires.filter(w => w.parentCanvasId === parentId)

  // Topological sort
  const sorted = topologicalSort(depthNodes, depthWires)

  // Filter to executable nodes only
  const executableNodes = sorted.filter(n => EXECUTABLE_TYPES.has(n.type))

  // Mark all executable nodes as queued
  for (const node of executableNodes) {
    callback(node.id, { status: 'queued', content: '' })
  }

  // Execute in order
  for (const node of executableNodes) {
    callback(node.id, { status: 'running', content: '' })

    try {
      const result = await executeNode(node)
      callback(node.id, { status: 'completed', content: result })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      callback(node.id, { status: 'error', content: '', error: errorMsg })
    }
  }
}
