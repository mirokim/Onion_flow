/**
 * Output node plugins: save_content, preview_content
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { useCanvasStore } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'

// ── save_content ──────────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'save_content',
    label: 'Save Content',
    labelKo: '콘텐츠 저장',
    category: 'output',
    tags: ['output'],
    color: NODE_CATEGORY_COLORS.output,
    inputs: [{ id: 'content', label: 'Content', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [],
    defaultData: { filename: 'content.md', label: 'Save Content' },
  },
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '저장할 콘텐츠가 없습니다.'
    const { nodes } = useCanvasStore.getState()
    const projectId = node.projectId || nodes[0]?.projectId
    if (!projectId) return '프로젝트 ID를 찾을 수 없습니다.'

    // Collect character names from upstream nodes for tags
    const wikiEntries = useWikiStore.getState().entries
    const { wires } = useCanvasStore.getState()
    const characterTags: string[] = []
    const visited = new Set<string>()
    const collectCharNames = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      const incoming = wires.filter(w => w.targetNodeId === nodeId)
      for (const wire of incoming) {
        const srcNode = nodes.find(n => n.id === wire.sourceNodeId)
        if (!srcNode) continue
        if (srcNode.type === 'character' && srcNode.data.wikiEntryId) {
          const entry = wikiEntries.find(e => e.id === srcNode.data.wikiEntryId)
          if (entry?.title) characterTags.push(entry.title)
        }
        collectCharNames(srcNode.id)
      }
    }
    collectCharNames(node.id)

    const dateTag = new Date().toISOString().slice(0, 10)
    const title = `Content - ${new Date().toLocaleString('ko-KR')}`
    const tags = [dateTag, ...characterTags]

    const wikiStore = useWikiStore.getState()
    const entry = await wikiStore.createEntry(projectId, 'story', title)
    await wikiStore.updateEntry(entry.id, { content: context, tags })

    return `위키에 "${title}" 저장 완료 (${context.length}자, 태그: ${tags.join(', ')})\n\n---\n\n${context}`
  },
})

// ── preview_content ───────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'preview_content',
    label: 'Preview Content',
    labelKo: '콘텐츠 미리보기',
    category: 'output',
    tags: ['output'],
    color: NODE_CATEGORY_COLORS.output,
    inputs: [{ id: 'content', label: 'Content', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [],
    defaultData: { label: 'Preview Content' },
  },
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '미리볼 콘텐츠가 없습니다.'
    return context
  },
})
